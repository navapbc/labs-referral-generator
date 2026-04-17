import json
from io import BytesIO
from textwrap import dedent

from fastapi import UploadFile
from haystack.dataclasses.chat_message import ChatMessage

from src.adapters import db
from src.common.components import (
    DocumentCapture,
    EmailResponses,
    LlmOutputValidator,
    LoadResultOptional,
    ReadableLogger,
    RemoveResourcesForEmail,
    SaveResult,
    UploadFilesToByteStreams,
)
from src.db.models.api_data_models import LlmResponse
from src.pipelines.generate_referrals_rag.pipeline_wrapper import ResourceList


def test_UploadFilesToByteStreams():
    # Mock UploadFile instances
    file1 = UploadFile(filename="test1.txt", file=BytesIO(b"Hello, World!"))
    file2 = UploadFile(filename="test2.txt", file=BytesIO(b"Another file."))

    # Run
    component = UploadFilesToByteStreams()
    output = component.run(files=[file1, file2])

    # Verify
    byte_streams = output["byte_streams"]
    assert len(byte_streams) == 2
    assert byte_streams[0].meta["filename"] == "test1.txt"
    assert byte_streams[0].data == b"Hello, World!"
    assert byte_streams[1].meta["filename"] == "test2.txt"
    assert byte_streams[1].data == b"Another file."


def test_SaveResult_and_LoadResult(enable_factory_create, db_session: db.Session):
    db_session.query(LlmResponse).delete()

    llm_response = 'This is a test response with JSON: {"somekey": "somevalue"}'
    replies = [ChatMessage.from_assistant(llm_response)]
    component = SaveResult()
    output = component.run(replies=replies)

    result_id = output["result_id"]
    db_record = db_session.query(LlmResponse).filter(LlmResponse.id == result_id).one_or_none()

    assert db_record is not None
    assert db_record.raw_text == llm_response

    # Now test loading it via the LoadResultOptional component
    component = LoadResultOptional()
    output = component.run(result_id=str(result_id))

    result_json = output["result_json"]
    assert result_json == {"somekey": "somevalue"}


def test_LoadResultOptional_with_valid_id(enable_factory_create, db_session: db.Session):
    """Test LoadResultOptional with a valid result_id."""
    db_session.query(LlmResponse).delete()

    llm_response = 'This is a test response with JSON: {"somekey": "somevalue"}'
    replies = [ChatMessage.from_assistant(llm_response)]
    save_component = SaveResult()
    save_output = save_component.run(replies=replies)
    result_id = save_output["result_id"]

    # Test loading with LoadResultOptional
    load_component = LoadResultOptional()
    output = load_component.run(result_id=result_id)

    assert output["result_json"] == {"somekey": "somevalue"}


def test_LoadResultOptional_with_none_id():
    """Test LoadResultOptional with None result_id returns empty dict."""
    component = LoadResultOptional()
    output = component.run(result_id=None)

    assert output["result_json"] == {}


def test_LoadResultOptional_with_empty_string():
    """Test LoadResultOptional with empty string result_id returns empty dict."""
    component = LoadResultOptional()
    output = component.run(result_id="")

    assert output["result_json"] == {}


def test_EmailResponses_resources_only(enable_factory_create, db_session: db.Session, monkeypatch):
    """Test EmailResponses with only resources (no action plan)."""
    resources = {
        "resources": [
            {
                "name": "Resource 1",
                "referral_type": "external",
                "description": "Description for Resource 1",
                "website": "http://resource1.com",
                "phones": ["555-1234"],
                "emails": ["resource1@example.com"],
                "addresses": ["123 Main St"],
                "justification": "Justification for Resource 1",
            },
            {
                "name": "Resource 2",
            },
        ]
    }

    # Mock send_email to always return success
    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: True)

    component = EmailResponses()
    output = component.run(email="test@example.com", resources_dict=resources, action_plan_dict={})

    assert output["status"] == "success"
    assert output["email"] == "test@example.com"
    assert output["message"] == dedent(
        """\
        Hello,

        Here is your personalized report with resources your case manager recommends to support your goals.
        You've already taken a great first step by exploring these options.

        **Your next step**: Look over the resources to see contact info and details about how to get started.

        ### Resource 1
        - Referral Type: external
        - Description: Description for Resource 1
        - Website: http://resource1.com
        - Phone: 555-1234
        - Email: resource1@example.com
        - Addresses: 123 Main St

        ### Resource 2
        - Referral Type: None
        - Description: None
        - Website: None
        - Phone: None
        - Email: None
        - Addresses: None"""
    )


VALID_JSON_OBJ = {
    "resources": [
        {
            "name": "Resource 1",
            "addresses": ["123 Main St"],
            "phones": ["555-1234"],
            "emails": ["resource1@example.com"],
            "website": "http://resource1.com",
            "description": "Description for Resource 1",
            "justification": "Justification for Resource 1",
        },
    ]
}
VALID_JSON_STR = json.dumps(VALID_JSON_OBJ)


def test_LlmOutputValidator():
    component = LlmOutputValidator(pydantic_model=ResourceList)
    valid_replies_output = component.run(replies=[ChatMessage.from_assistant(text=VALID_JSON_STR)])
    assert "valid_replies" in valid_replies_output
    assert valid_replies_output["valid_replies"][0].text == VALID_JSON_STR
    assert "invalid_replies" not in valid_replies_output
    assert "error_message" not in valid_replies_output

    invalid_json_str = f"Based on your query, the resources are:\n{VALID_JSON_STR}"
    invalid_replies_output = component.run(
        replies=[ChatMessage.from_assistant(text=invalid_json_str)]
    )
    assert "valid_replies" not in invalid_replies_output
    assert "invalid_replies" in invalid_replies_output
    assert "error_message" in invalid_replies_output


def test_ReadableLogger():
    manual_logs = [
        {"user_question": "What is the capital of France?"},
    ]
    messages = [
        ChatMessage.from_system("System message"),
        ChatMessage.from_user("User message"),
        ChatMessage.from_assistant("Not a JSON message"),
        ChatMessage.from_assistant(VALID_JSON_STR),
    ]

    component = ReadableLogger()
    output = component.run(messages_list=[manual_logs, messages])

    assert output["logs"] == [
        {"user_question": "What is the capital of France?"},
        "User message",
        "Not a JSON message",
        VALID_JSON_OBJ,
    ]


def test_EmailResponses_with_resources_and_action_plan(monkeypatch):
    """Test EmailResponses with both resources and action plan."""
    resources_dict = {
        "resources": [
            {
                "name": "Resource 1",
                "referral_type": "external",
                "description": "Description for Resource 1",
                "website": "http://resource1.com",
                "phones": ["555-1234"],
                "emails": ["resource1@example.com"],
                "addresses": ["123 Main St"],
            },
            {
                "name": "Resource 2",
                "referral_type": "internal",
                "description": "Description for Resource 2",
                "website": "http://resource2.com",
                "phones": ["555-5678", "555-9012"],
                "emails": ["resource2@example.com"],
                "addresses": ["456 Oak Ave"],
            },
        ]
    }

    action_plan_dict = {
        "title": "Your Action Plan",
        "summary": "This is a summary of your action plan.",
        "content": "Step 1: Contact Resource 1\nStep 2: Follow up with Resource 2",
    }

    # Mock send_email to always return success
    email_calls = []

    def mock_send_email(recipient, subject, body):
        email_calls.append({"recipient": recipient, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("src.common.components.send_email", mock_send_email)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    assert output["status"] == "success"
    assert output["email"] == "test@example.com"
    assert "Resource 1" in output["message"]
    assert "Resource 2" in output["message"]
    assert "Your Action Plan" in output["message"]
    assert "This is a summary of your action plan." in output["message"]
    assert "Step 1: Contact Resource 1" in output["message"]

    # Verify email was sent with correct parameters
    assert len(email_calls) == 1
    assert email_calls[0]["recipient"] == "test@example.com"
    assert email_calls[0]["subject"] == "Your Requested Resources and Action Plan"


def test_EmailResponses_action_plan_only(monkeypatch):
    """Test EmailResponses with only action plan (no resources)."""
    resources_dict = {"resources": []}

    action_plan_dict = {
        "title": "Your Action Plan",
        "summary": "Summary text",
        "content": "Content text",
    }

    # Mock send_email
    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: True)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    assert output["status"] == "success"
    assert "Your Action Plan" in output["message"]
    # Should not contain any resource headers
    assert "###" not in output["message"]


def test_EmailResponses_with_missing_resource_fields(monkeypatch):
    """Test EmailResponses with resources missing optional fields."""
    resources_dict = {
        "resources": [
            {
                "name": "Resource With Missing Fields",
                # Missing all other fields
            }
        ]
    }

    action_plan_dict = {}

    # Mock send_email
    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: True)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    assert output["status"] == "success"
    assert "Resource With Missing Fields" in output["message"]
    assert "- Referral Type: None" in output["message"]
    assert "- Description: None" in output["message"]
    assert "- Website: None" in output["message"]
    assert "- Phone: None" in output["message"]
    assert "- Email: None" in output["message"]
    assert "- Addresses: None" in output["message"]


def test_EmailResponses_send_email_failure(monkeypatch):
    """Test EmailResponses when send_email fails."""
    resources_dict = {
        "resources": [
            {
                "name": "Resource 1",
                "referral_type": "external",
                "description": "Description",
                "website": "http://resource1.com",
                "phones": ["555-1234"],
                "emails": ["resource1@example.com"],
                "addresses": ["123 Main St"],
            }
        ]
    }

    action_plan_dict = {
        "title": "Your Action Plan",
        "summary": "Summary",
        "content": "Content",
    }

    # Mock send_email to return failure
    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: False)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    assert output["status"] == "failed"
    assert output["email"] == "test@example.com"
    assert "Resource 1" in output["message"]
    assert "Your Action Plan" in output["message"]


def test_EmailResponses_with_action_plan_missing_fields(monkeypatch):
    """Test EmailResponses with action plan missing optional fields."""
    resources_dict = {"resources": []}

    # Test with missing summary
    action_plan_dict = {
        "title": "Action Plan Title",
        "content": "Some content",
    }

    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: True)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    assert output["status"] == "success"
    assert "Action Plan Title" in output["message"]
    assert "Some content" in output["message"]


def test_EmailResponses_with_action_plan_only_title(monkeypatch):
    """Test EmailResponses with action plan containing only title."""
    resources_dict = {"resources": []}

    action_plan_dict = {
        "title": "Just A Title",
    }

    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: True)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    assert output["status"] == "success"
    assert "Just A Title" in output["message"]


def test_EmailResponses_message_format(monkeypatch):
    """Test that EmailResponses formats the message correctly."""
    resources_dict = {
        "resources": [
            {
                "name": "Test Resource",
                "referral_type": "test_type",
                "description": "Test description",
                "website": "http://test.com",
                "phones": ["111-1111"],
                "emails": ["test@test.com"],
                "addresses": ["Test Address"],
            }
        ]
    }

    action_plan_dict = {
        "title": "Test Plan",
        "summary": "Test summary",
        "content": "Test content",
    }

    monkeypatch.setattr("src.common.components.send_email", lambda **kwargs: True)

    component = EmailResponses()
    output = component.run(
        email="test@example.com", resources_dict=resources_dict, action_plan_dict=action_plan_dict
    )

    message = output["message"]

    # Check that message starts with EMAIL_INTRO
    assert message.startswith("Hello,")
    assert "Here is your personalized report" in message

    # Check resource formatting
    assert "### Test Resource" in message
    assert "- Referral Type: test_type" in message
    assert "- Description: Test description" in message

    # Check action plan formatting
    assert "## Test Plan" in message
    assert "Test summary" in message
    assert "Test content" in message


def test_RemoveResourcesForEmail_with_exclusions():
    """Test RemoveResourcesForEmail filters out excluded resources."""
    result_json = {
        "resources": [
            {"name": "Resource A", "description": "First resource"},
            {"name": "Resource B", "description": "Second resource"},
            {"name": "Resource C", "description": "Third resource"},
        ]
    }
    excluded_names = ["Resource B"]

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=excluded_names)

    assert "resources_dict" in output
    resources_dict = output["resources_dict"]
    assert len(resources_dict["resources"]) == 2
    assert resources_dict["resources"][0]["name"] == "Resource A"
    assert resources_dict["resources"][1]["name"] == "Resource C"


def test_RemoveResourcesForEmail_with_multiple_exclusions():
    """Test RemoveResourcesForEmail filters out multiple excluded resources."""
    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
            {"name": "Resource C"},
            {"name": "Resource D"},
        ]
    }
    excluded_names = ["Resource A", "Resource C"]

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=excluded_names)

    resources_dict = output["resources_dict"]
    assert len(resources_dict["resources"]) == 2
    assert resources_dict["resources"][0]["name"] == "Resource B"
    assert resources_dict["resources"][1]["name"] == "Resource D"


def test_RemoveResourcesForEmail_no_exclusions():
    """Test RemoveResourcesForEmail passes through when no exclusions provided."""
    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
        ]
    }

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=None)

    resources_dict = output["resources_dict"]
    assert len(resources_dict["resources"]) == 2
    assert resources_dict["resources"][0]["name"] == "Resource A"
    assert resources_dict["resources"][1]["name"] == "Resource B"


def test_RemoveResourcesForEmail_empty_exclusions_list():
    """Test RemoveResourcesForEmail passes through with empty exclusions list."""
    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
        ]
    }

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=[])

    resources_dict = output["resources_dict"]
    assert len(resources_dict["resources"]) == 2


def test_RemoveResourcesForEmail_empty_result_json():
    """Test RemoveResourcesForEmail handles empty result_json."""
    component = RemoveResourcesForEmail()
    output = component.run(result_json={}, excluded_resource_names=["Resource A"])

    assert output["resources_dict"] == {}


def test_RemoveResourcesForEmail_no_resources_key():
    """Test RemoveResourcesForEmail handles result_json without resources key."""
    result_json = {"other_key": "value"}

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=["Resource A"])

    resources_dict = output["resources_dict"]
    assert resources_dict == result_json


def test_RemoveResourcesForEmail_nonexistent_exclusion(caplog):
    """Test RemoveResourcesForEmail handles exclusion of nonexistent resource."""
    import logging

    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
        ]
    }
    excluded_names = ["Resource Z"]  # Does not exist

    component = RemoveResourcesForEmail()

    with caplog.at_level(logging.ERROR):
        output = component.run(result_json=result_json, excluded_resource_names=excluded_names)

    resources_dict = output["resources_dict"]
    # Should return all resources unchanged since "Resource Z" doesn't exist
    assert len(resources_dict["resources"]) == 2
    assert resources_dict["resources"][0]["name"] == "Resource A"
    assert resources_dict["resources"][1]["name"] == "Resource B"

    # Verify error was logged
    assert any("Resource Z" in record.message for record in caplog.records)
    assert any(
        "not found in original resources list" in record.message for record in caplog.records
    )


def test_RemoveResourcesForEmail_all_excluded():
    """Test RemoveResourcesForEmail when all resources are excluded."""
    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
        ]
    }
    excluded_names = ["Resource A", "Resource B"]

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=excluded_names)

    resources_dict = output["resources_dict"]
    # Should return empty resources list
    assert len(resources_dict["resources"]) == 0
    assert resources_dict["resources"] == []


def test_RemoveResourcesForEmail_preserves_other_fields():
    """Test RemoveResourcesForEmail preserves other fields in result_json."""
    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
        ],
        "metadata": {"version": "1.0"},
        "timestamp": "2024-01-01",
    }
    excluded_names = ["Resource B"]

    component = RemoveResourcesForEmail()
    output = component.run(result_json=result_json, excluded_resource_names=excluded_names)

    resources_dict = output["resources_dict"]
    # Should preserve other fields
    assert resources_dict["metadata"] == {"version": "1.0"}
    assert resources_dict["timestamp"] == "2024-01-01"
    # And filter resources
    assert len(resources_dict["resources"]) == 1
    assert resources_dict["resources"][0]["name"] == "Resource A"


def test_DocumentCapture_stores_and_pops_content():
    """DocumentCapture stores document content and pop() retrieves and removes it."""
    from haystack import Document

    component = DocumentCapture()
    docs = [Document(content="First doc"), Document(content="Second doc")]

    output = component.run(documents=docs, result_id="test-id-1")

    # Documents pass through unchanged
    assert output["documents"] == docs

    # Content was stored
    retrieved = DocumentCapture.pop("test-id-1")
    assert retrieved == ["First doc", "Second doc"]

    # Second pop returns empty (entry removed)
    assert DocumentCapture.pop("test-id-1") == []


def test_DocumentCapture_no_op_without_result_id():
    """DocumentCapture does not store anything when result_id is empty."""
    from haystack import Document

    component = DocumentCapture()
    docs = [Document(content="Some content")]

    output = component.run(documents=docs, result_id="")

    # Documents still pass through
    assert output["documents"] == docs

    # Nothing stored (pop of any key returns [])
    assert DocumentCapture.pop("") == []


def test_DocumentCapture_pop_nonexistent_key():
    """pop() returns an empty list for an unknown result_id."""
    assert DocumentCapture.pop("nonexistent-key") == []


def test_DocumentCapture_skips_documents_without_content():
    """DocumentCapture only stores documents that have non-empty content."""
    from haystack import Document

    component = DocumentCapture()
    docs = [Document(content="Has content"), Document(content=None), Document(content="")]

    component.run(documents=docs, result_id="test-id-2")

    retrieved = DocumentCapture.pop("test-id-2")
    assert retrieved == ["Has content"]


def test_DocumentCapture_concurrent_isolation():
    """Multiple concurrent pipeline runs store and retrieve documents without cross-contamination.

    Verifies the thread-safety contract stated in components.py:1-10: pipeline components
    are shared across threads and must be safe for concurrent use.
    """
    import concurrent.futures
    import time

    from haystack import Document

    component = DocumentCapture()
    n_runs = 20

    def run_and_pop(run_id: str) -> list[str]:
        docs = [Document(content=f"{run_id}_doc_{i}") for i in range(5)]
        component.run(documents=docs, result_id=run_id)
        # Brief sleep to increase thread interleaving
        time.sleep(0.01)
        return DocumentCapture.pop(run_id)

    errors: list[Exception] = []
    results: dict[str, list[str]] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=n_runs) as executor:
        future_to_run_id = {
            executor.submit(run_and_pop, f"concurrent-run-{i}"): f"concurrent-run-{i}"
            for i in range(n_runs)
        }
        for future in concurrent.futures.as_completed(future_to_run_id):
            run_id = future_to_run_id[future]
            try:
                results[run_id] = future.result()
            except Exception as e:
                errors.append(e)

    assert not errors, f"Concurrent runs raised errors: {errors}"
    assert len(results) == n_runs

    for i in range(n_runs):
        run_id = f"concurrent-run-{i}"
        expected = [f"{run_id}_doc_{j}" for j in range(5)]
        assert results[run_id] == expected, f"{run_id} got wrong docs: {results[run_id]}"

    # All entries should have been popped — storage is clean
    for i in range(n_runs):
        assert DocumentCapture.pop(f"concurrent-run-{i}") == []


def test_RemoveResourcesForEmail_mixed_valid_invalid_exclusions(caplog):
    """Test RemoveResourcesForEmail with mix of valid and invalid exclusion names."""
    import logging

    result_json = {
        "resources": [
            {"name": "Resource A"},
            {"name": "Resource B"},
            {"name": "Resource C"},
        ]
    }
    # Mix of valid and invalid exclusion names
    excluded_names = ["Resource B", "Resource Z", "Nonexistent Resource"]

    component = RemoveResourcesForEmail()

    with caplog.at_level(logging.ERROR):
        output = component.run(result_json=result_json, excluded_resource_names=excluded_names)

    resources_dict = output["resources_dict"]
    # Should only exclude valid resource (Resource B)
    assert len(resources_dict["resources"]) == 2
    assert resources_dict["resources"][0]["name"] == "Resource A"
    assert resources_dict["resources"][1]["name"] == "Resource C"

    # Verify errors were logged for invalid exclusions
    error_messages = [record.message for record in caplog.records if record.levelname == "ERROR"]
    assert any("Resource Z" in msg for msg in error_messages)
    assert any("Nonexistent Resource" in msg for msg in error_messages)
    # Should log 2 errors (one for each invalid name)
    assert (
        len([msg for msg in error_messages if "not found in original resources list" in msg]) == 2
    )

import pytest

from src.pipelines.generate_action_plan.pipeline_wrapper import (
    format_context_documents,
    format_resources,
)
from src.pipelines.generate_referrals_rag.pipeline_wrapper import Resource


@pytest.fixture
def sample_resources():
    return [
        Resource(
            name="Austin Resource Center",
            addresses=["123 Main St, Austin, TX 78701"],
            phones=["512-555-0100"],
            emails=["info@austinresource.org"],
            website="https://austinresource.org",
            description="Provides housing assistance and job training",
            justification="Matches client needs for housing support",
            referral_type="external",
        ),
        Resource(
            name="Central Texas Food Bank",
            addresses=["6500 Metropolis Dr, Austin, TX 78744"],
            phones=["512-555-0200", "512-555-0201"],
            emails=["contact@ctfb.org"],
            website="https://centraltexasfoodbank.org",
            description="Emergency food assistance for families in need",
            justification="Client has immediate food insecurity needs",
            referral_type="external",
        ),
        Resource(
            name="Resource Without Website",
            addresses=[],
            phones=["512-555-0300"],
            emails=[],
            website="",
            description="Minimal resource for testing",
            justification="Test resource with minimal data",
            referral_type="external",
        ),
    ]


def test_format_resources(sample_resources):
    formatted = format_resources(sample_resources)

    # Verify the result is a string
    assert isinstance(formatted, str)

    # Verify that all resource names are present
    for resource in sample_resources:
        assert resource.name in formatted

    # Verify that key information is formatted correctly
    assert "Name: Austin Resource Center" in formatted
    assert "Description: Provides housing assistance and job training" in formatted
    assert "Justification: Matches client needs for housing support" in formatted
    assert "Addresses: 123 Main St, Austin, TX 78701" in formatted
    assert "Phones: 512-555-0100" in formatted
    assert "Emails: info@austinresource.org" in formatted
    assert "Website: https://austinresource.org" in formatted

    # Verify multiple phones are joined correctly
    assert "Phones: 512-555-0200, 512-555-0201" in formatted

    # Verify empty fields are handled (should not appear in output)
    assert "Name: Resource Without Website" in formatted
    # Empty website should still appear but be empty
    assert "Website:" in formatted


def test_format_resources_empty_list():
    formatted = format_resources([])
    assert formatted == ""


def test_format_resources_with_missing_fields():
    resources = [
        Resource(
            name="Minimal Resource",
            addresses=["100 Test St"],
            phones=[],
            emails=[],
            website="",
            description="",
            justification="",
            referral_type=None,
        )
    ]

    formatted = format_resources(resources)

    # Should include the name
    assert "Name: Minimal Resource" in formatted
    # Should include addresses even if only one
    assert "Addresses: 100 Test St" in formatted


# --- format_context_documents tests ---


def test_format_context_documents_none():
    assert format_context_documents(None) == ""


def test_format_context_documents_empty_list():
    assert format_context_documents([]) == ""


def test_format_context_documents_single_document():
    result = format_context_documents(["Housing assistance program details"])
    assert result == "Source Documents:\n- Housing assistance program details"


def test_format_context_documents_multiple_documents():
    docs = ["First doc about food banks", "Second doc about job training"]
    result = format_context_documents(docs)
    assert (
        result
        == "Source Documents:\n- First doc about food banks\n\n- Second doc about job training"
    )

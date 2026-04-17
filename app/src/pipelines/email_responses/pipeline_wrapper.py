"""
Email Responses Pipeline Wrapper

Consolidated pipeline for emailing resources, action plans, or both to users.

This pipeline replaces three previous separate pipelines:
- email_result (resources only)
- email_action_plan (action plan only)
- email_full_result (both resources and action plan)

The pipeline dynamically handles all three scenarios based on which result IDs are provided.
Resources can be filtered by providing a list of resource names to exclude.

API Parameters:
    recipient_email (str): Recipient email address (required)
    requestor_email (str): Email of the person requesting the send (required)
    resources_result_id (str, optional): ID of resources result to load and email
    action_plan_result_id (str, optional): ID of action plan result to load and email
    excluded_resource_names (list[str], optional): List of resource names to exclude from email

At least one result_id must be provided.

Examples:
    # Email only resources
    POST /email_responses/run
    {
        "recipient_email": "user@example.com",
        "requestor_email": "admin@example.com",
        "resources_result_id": "abc123"
    }

    # Email only action plan
    POST /email_responses/run
    {
        "recipient_email": "user@example.com",
        "requestor_email": "admin@example.com",
        "action_plan_result_id": "xyz789"
    }

    # Email both resources and action plan
    POST /email_responses/run
    {
        "recipient_email": "user@example.com",
        "requestor_email": "admin@example.com",
        "resources_result_id": "abc123",
        "action_plan_result_id": "xyz789"
    }

    # Email resources with some excluded
    POST /email_responses/run
    {
        "recipient_email": "user@example.com",
        "requestor_email": "admin@example.com",
        "resources_result_id": "abc123",
        "excluded_resource_names": ["Resource A", "Resource B"]
    }
"""

import logging
from typing import Optional

from fastapi import HTTPException
from hayhooks import BasePipelineWrapper
from haystack import Pipeline

from src.common import components, haystack_utils

logger = logging.getLogger(__name__)


class PipelineWrapper(BasePipelineWrapper):
    """
    Unified email pipeline that handles sending resources, action plans, or both.

    This wrapper consolidates three previous pipelines into one, reducing code
    duplication and simplifying maintenance. The pipeline dynamically loads and
    emails content based on which result IDs are provided.
    """

    name = "email_responses"

    def setup(self) -> None:
        """
        Configure the pipeline with components for loading results and sending emails.

        Pipeline structure:
            load_resources (optional) ──> remove_resources ──┐
                                                              ├──> email_responses
            load_action_plan (optional) ──────────────────────┘

        Both loaders use LoadResultOptional which gracefully handles None/empty IDs.
        The remove_resources component filters out excluded resources before emailing.
        The email_responses component formats and sends email based on what's loaded.
        """
        pipeline = Pipeline()

        # Add optional loaders for resources and action plan
        pipeline.add_component("load_resources", components.LoadResultOptional())
        pipeline.add_component("load_action_plan", components.LoadResultOptional())

        # Add component to filter out excluded resources
        pipeline.add_component("remove_resources", components.RemoveResourcesForEmail())

        # Add unified email component that handles all scenarios
        pipeline.add_component("email_responses", components.EmailResponses())

        # Connect loaders through filter to email component
        pipeline.connect("load_resources.result_json", "remove_resources.result_json")
        pipeline.connect("remove_resources.resources_dict", "email_responses.resources_dict")
        pipeline.connect("load_action_plan.result_json", "email_responses.action_plan_dict")

        # Add logger for debugging
        pipeline.add_component("logger", components.ReadableLogger())

        self.pipeline = pipeline
        self.runner = haystack_utils.TracedPipelineRunner(self.name, self.pipeline)

    def run_api(
        self,
        recipient_email: str,
        requestor_email: str,
        resources_result_id: Optional[str] = None,
        action_plan_result_id: Optional[str] = None,
        excluded_resource_names: Optional[list[str]] = None,
    ) -> dict:
        """
        Send an email with resources, action plan, or both based on provided result IDs.

        Args:
            recipient_email: Recipient email address (required)
            requestor_email: Email of the person requesting the send (required)
            resources_result_id: ID of resources result to load (optional)
            action_plan_result_id: ID of action plan result to load (optional)
            excluded_resource_names: List of resource names to exclude from email (optional)

        Returns:
            dict: Pipeline response containing status, email, and message

        Raises:
            HTTPException: If neither result_id is provided or if pipeline execution fails
        """
        # Validate that at least one result_id is provided
        if not resources_result_id and not action_plan_result_id:
            raise HTTPException(
                status_code=400,
                detail="At least one of resources_result_id or action_plan_result_id must be provided",
            )

        pipeline_run_args = self.create_pipeline_args(
            resources_result_id, action_plan_result_id, recipient_email, excluded_resource_names
        )

        return self.runner.return_response(
            pipeline_run_args,
            user_id="requestor_email",
            metadata={"requestor_email": requestor_email},
            input_={
                "recipient_email": recipient_email,
                "requestor_email": requestor_email,
                "resources_result_id": resources_result_id,
                "action_plan_result_id": action_plan_result_id,
                "excluded_resource_names": excluded_resource_names or [],
            },
            include_outputs_from={"email_responses"},
            extract_output=lambda result: result["email_responses"]["status"],
        )

    def create_pipeline_args(
        self,
        resources_result_id: Optional[str],
        action_plan_result_id: Optional[str],
        recipient_email: str,
        excluded_resource_names: Optional[list[str]] = None,
    ) -> dict:
        """Common args for pipeline execution"""
        return {
            "logger": {
                "messages_list": [
                    {
                        "resources_result_id": resources_result_id or "none",
                        "action_plan_result_id": action_plan_result_id or "none",
                        "recipient_email": recipient_email,
                        "excluded_resource_names": excluded_resource_names or [],
                    }
                ],
            },
            "load_resources": {
                "result_id": resources_result_id,
            },
            "load_action_plan": {
                "result_id": action_plan_result_id,
            },
            "remove_resources": {
                "excluded_resource_names": excluded_resource_names,
            },
            "email_responses": {
                "email": recipient_email,
            },
        }

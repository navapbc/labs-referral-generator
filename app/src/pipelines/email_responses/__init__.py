"""
Email Responses Pipeline

Consolidated pipeline for emailing resources, action plans, or both to users.
Handles three scenarios:
1. Email only resources (resources_result_id provided)
2. Email only action plan (action_plan_result_id provided)
3. Email both resources and action plan (both IDs provided)
"""

from .pipeline_wrapper import PipelineWrapper

__all__ = ["PipelineWrapper"]

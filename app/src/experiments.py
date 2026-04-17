import argparse
import functools
import json
import logging
import os
from pprint import pformat
from typing import Any, Dict

import requests
from hayhooks import BasePipelineWrapper
from phoenix.client import Client
from phoenix.client.experiments import run_experiment
from phoenix.client.resources.datasets import Dataset
from phoenix.client.resources.experiments.types import TaskOutput

from src.common import phoenix_utils
from src.pipelines.generate_referrals_rag.pipeline_wrapper import (
    PipelineWrapper as GenerateReferralsRagPipeline,
)

logger = logging.getLogger(__name__)


def get_sets(output: TaskOutput, expected: Dict[str, Any]) -> tuple[set[str], set[str]]:
    assert isinstance(output, list), f"Expected list of content, but got {type(output)}"
    assert len(output) == 1, f"Expected exactly one output, but got {len(output)}"
    output_obj = json.loads(output[0]["text"])
    # Usually the output is {"resources": [...]}, sometimes it's just [...]
    resources = output_obj["resources"] if "resources" in output_obj else output_obj
    # Extract only the names of the resources from the output
    output_set = set([resource["name"] for resource in resources])

    expected_json_str = expected[OUTPUT_COLUMN_NAME]
    expected_obj = json.loads(expected_json_str)
    expectation_set = set(expected_obj["expected_referrals"])

    return output_set, expectation_set


def recall(output: TaskOutput, expected: Dict[str, Any]) -> float:
    output_set, expectation_set = get_sets(output, expected)
    if len(expectation_set) == 0:
        raise ValueError("No expected referrals to compute recall.")
    return len(output_set.intersection(expectation_set)) / len(expectation_set)


def precision(output: TaskOutput, expected: Dict[str, Any]) -> float:
    output_set, expectation_set = get_sets(output, expected)
    if len(output_set) == 0:
        return 0.0
    return len(output_set.intersection(expectation_set)) / len(output_set)


url_base = os.environ.get("DEPLOYED_API_URL")
if url_base:
    logger.info("Using deployed API at %s", url_base)


PIPELINES = {
    "generate-referrals": {
        "pipeline_class": GenerateReferralsRagPipeline,
        "url_path": "generate_referrals_rag/run",
    },
}
pipeline_name = "generate-referrals"
prompt_version = None


@functools.lru_cache
def create_pipeline() -> BasePipelineWrapper:
    logger.info("Creating local Haystack pipeline %r", pipeline_name)
    pipeline_class = PIPELINES[pipeline_name]["pipeline_class"]
    assert isinstance(pipeline_class, type), f"Expected a class but got {type(pipeline_class)}"
    pipeline_wrapper = pipeline_class()
    pipeline_wrapper.setup()
    return pipeline_wrapper


def get_question(example: dict) -> str:
    question_json_str = example["input"][INPUT_COLUMN_NAME]
    question_obj = json.loads(question_json_str)
    question = question_obj["caseworker_input"]
    return question


def query_pipeline(example: dict) -> TaskOutput:
    question = get_question(example)
    logger.info("Getting answer for: %r", question)
    response = create_pipeline().run_api(query=question, prompt_version_id=prompt_version or "")
    replies = response["llm"]["replies"]
    assert len(replies) == 1, f"Expected exactly one reply but got {len(replies)}"
    return replies[0].to_dict()["content"]


def query_api(example: dict) -> TaskOutput:
    question = get_question(example)
    logger.info("Getting answer for: %r", question)

    assert url_base, "DEPLOYED_API_URL is not set -- add it to override.env"
    json_data = {"query": question, "prompt_version_id": prompt_version or ""}
    response = requests.post(
        f"{url_base}/{PIPELINES[pipeline_name]['url_path']}",
        headers={
            "accept": "application/json",
            "Content-Type": "application/json",
        },
        json=json_data,
        timeout=60,
    )
    resp_obj = response.json()
    logger.info("Response: %s", pformat(resp_obj, width=160))
    assert len(resp_obj["result"]["llm"]["replies"]) == 1, "Expected exactly one reply"
    return resp_obj["result"]["llm"]["replies"][0]["_content"]


def run(dataset: Dataset, client: Client) -> None:
    task = query_api if url_base else query_pipeline
    logger.info("Running experiment using %r", task.__name__)
    run_experiment(
        dataset=dataset,
        task=task,
        evaluators=[recall, precision],
        client=client,
    )


INPUT_COLUMN_NAME = "Input"
OUTPUT_COLUMN_NAME = "Output"


def export_dataset(dataset_name: str, filename: str, client: Client) -> None:
    """Retrieve a dataset by name and save it as a CSV file. Useful for exporting a dataset from the deployed Phoenix."""
    try:
        dataset = client.datasets.get_dataset(dataset=dataset_name)
        # Convert the dataset to a pandas DataFrame to save as CSV
        df = dataset.to_dataframe()

        # Remove the extraneous 'input' and 'output' keys and just keep the values
        # This ensures that when the CSV file is imported, the input and output columns are the same as in the deployed Phoenix
        df[INPUT_COLUMN_NAME] = df["input"].apply(lambda x: x[INPUT_COLUMN_NAME])
        df[OUTPUT_COLUMN_NAME] = df["output"].apply(lambda x: x[OUTPUT_COLUMN_NAME])
        # Convert metadata to JSON string so it can be correctly parsed when running experiments if needed
        df["metadata"] = df["metadata"].apply(lambda x: json.dumps(x))
        df = df[[INPUT_COLUMN_NAME, OUTPUT_COLUMN_NAME, "metadata"]]
        df.to_csv(filename, index=False)
    except ValueError as e:
        logger.error("Error retrieving dataset: %s", e)
        print_datasets(client)


def print_datasets(client: Client) -> list:
    all_datasets = client.datasets.list()
    logger.info("%d available datasets:\n%s", len(all_datasets), pformat(all_datasets))
    return all_datasets


def import_dataset(client: Client, filename: str, dataset_name: str) -> Any:
    """
    Import a dataset from a CSV file into Phoenix.
    Useful for loading dataset locally to test experiments.
    Reminder to reduce the number of rows in the CSV file for development.
    """
    return client.datasets.create_dataset(
        name=dataset_name,
        csv_file_path=filename,
        input_keys=[INPUT_COLUMN_NAME],
        output_keys=[OUTPUT_COLUMN_NAME],
        # Caution: Note that the metadata column is different than on the deployed Phoenix
        # In the Phoenix UI, click on each example to compare -- don't compare in the table view,
        # which shows multiple examples and hides the "Input" and "Output" keys
        metadata_keys=["metadata"],
    )


def main() -> None:
    logging.basicConfig(format="%(levelname)s - %(name)s -  %(message)s", level=logging.INFO)

    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=str)
    parser.add_argument("pipeline", type=str, default="generate_referrals_rag")
    parser.add_argument(
        "action",
        type=str,
        choices=["export", "import", "run", "run_on_deployed"],
        default="run",
    )
    parser.add_argument("--prompt_version", type=str, required=False, default=None)
    args = parser.parse_args()

    logger.info("Action=%s Pipeline=%r Dataset=%r", args.action, args.pipeline, args.dataset)
    assert (
        args.pipeline in PIPELINES
    ), f"Unknown pipeline {args.pipeline}. Available: {list(PIPELINES.keys())}"
    global pipeline_name, prompt_version
    pipeline_name = args.pipeline
    prompt_version = args.prompt_version

    if args.action == "export":
        client_to_deployed_phx = phoenix_utils.client_to_deployed_phoenix()
        export_dataset(args.dataset, "dataset.csv", client_to_deployed_phx)
        logger.info("Export complete. Check dataset.csv file.")
        return

    client = phoenix_utils._create_client()
    if args.action == "import":
        import_dataset(client, "dataset.csv", args.dataset)
        logger.info("Import complete. Check Phoenix UI.")
        return

    if args.action == "run_on_deployed":
        logger.info("Running experiment on dataset in deployed Phoenix")
        client = phoenix_utils.client_to_deployed_phoenix()

    try:
        # Get the dataset, run the experiment, and post the results
        dataset = client.datasets.get_dataset(dataset=args.dataset)
        run(dataset, client)
        logger.info("Check results in the Phoenix UI.")
    except ValueError as e:
        logger.error("Error retrieving dataset: %s", e)
        print_datasets(client)

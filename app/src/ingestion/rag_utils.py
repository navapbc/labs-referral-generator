"""
Utility functions for document ingestion to populate ChromaDB for RAG.

The expected folder structure for `files_to_ingest_into_vector_db/` is
subfolders representing a region like `centralpa` or `centraltx`.
Within that region subfolder, put files that will be ingested into
the vector database (Chroma DB), which is used for RAG.
"""

import logging
import os
from pathlib import Path

from botocore.client import BaseClient
from botocore.exceptions import NoCredentialsError
from chromadb.api import ClientAPI
from haystack import Pipeline
from haystack.components.converters import MultiFileConverter
from haystack.components.embedders import SentenceTransformersDocumentEmbedder
from haystack.components.preprocessors import DocumentPreprocessor
from haystack.components.writers import DocumentWriter
from haystack.document_stores.errors.errors import DocumentStoreError
from haystack_integrations.document_stores.chroma import ChromaDocumentStore

from src.app_config import config
from src.common.components import DocumentMetadataAdder
from src.util import file_util

logger = logging.getLogger(__name__)


def delete_preview_collections(chroma_client: ClientAPI) -> None:
    collections = chroma_client.list_collections()
    for collection in collections:
        name = collection.name
        if name.startswith(f"{config.collection_name_prefix}_p-"):
            logger.info("Deleting preview collection: %s", name)
            chroma_client.delete_collection(name)


def populate_vector_db() -> None:
    logging.basicConfig(format="%(levelname)s - %(name)s -  %(message)s", level=logging.INFO)

    chroma_client = config.chroma_client()
    if config.delete_preview_collections:
        delete_preview_collections(chroma_client)

    logger.info("ChromaDB collections: %s", chroma_client.list_collections())
    doc_store = config.chroma_document_store()
    collection_name = doc_store._collection_name

    # Clear existing collection if any
    if (doc_count := doc_store.count_documents()) > 0:
        try:
            # Don't delete collection since it's referenced by existing pipelines upon their startup
            logger.info(
                "Clearing out existing vector DB collection=%r with %d docs",
                collection_name,
                doc_count,
            )
            # recreate_index=True results in a new id for the collection, which breaks existing pipelines
            doc_store.delete_all_documents(recreate_index=False)
        except DocumentStoreError as e:
            # Ignore this error from haystack.logging, which is okay since logging is the last step in delete_all_documents
            if "overwrite 'name' in LogRecord" in str(e):
                logger.info("Ignoring expected DocumentStoreError: %s", e)
            else:
                logger.warning("Unexpected DocumentStoreError: %s", e)
                raise
    assert doc_store.count_documents() == 0, "Documents should be deleted from collection"

    local_folder = s3_parent_folder = "files_to_ingest_into_vector_db/"

    if config.environment == "local":
        assert os.path.exists(
            local_folder
        ), f"Local folder {local_folder} should exist with manually downloaded files from S3"
    else:
        try:
            # Try to create the local folder to make sure we have write permissions
            os.makedirs(local_folder, exist_ok=True)
        except PermissionError as e:
            logger.error("Error creating directory for %s: %s", local_folder, e)
            fallback_folder = f"/tmp/{local_folder}"  # nosec B108
            try:
                os.makedirs(fallback_folder, exist_ok=True)
            except OSError as e2:
                logger.error("Error creating fallback directory for %s: %s", fallback_folder, e2)
                raise
            local_folder = fallback_folder

        s3 = file_util.get_s3_client()
        bucket = os.environ.get("BUCKET_NAME", f"labs-referral-pilot-app-{config.environment}")

        assert s3_parent_folder.endswith("/"), "s3_parent_folder should end with '/'"
        s3_subfolders = get_s3_subfolders(s3, bucket, s3_parent_folder)
        logger.info("Region subfolders in S3: %s", s3_subfolders)
        # Exclude certain regions if needed
        for s3_folder in s3_subfolders.values():
            download_s3_folder_to_local(
                s3,
                bucket,
                s3_folder,
                os.path.join(local_folder, s3_folder.removeprefix(s3_parent_folder)),
            )

    region_subfolders = {
        entry.name: entry.path for entry in os.scandir(local_folder) if entry.is_dir()
    }
    logger.info("Region subfolders in local folder: %s", region_subfolders)

    for region, subfolder in region_subfolders.items():
        files_to_ingest = [str(p) for p in Path(subfolder).rglob("*") if p.is_file()]
        logger.info("Files to ingest: %s", files_to_ingest)
        if not files_to_ingest:
            logger.warning("No files found to ingest for region=%s", region)
            continue

        # Ingest documents into ChromaDB
        logger.info("Ingesting documents into collection=%r", collection_name)
        # Run the pipeline to index documents
        pipeline = _create_ingest_pipeline(doc_store, region=region)
        pipeline.run({"converter": {"sources": files_to_ingest}})
        logger.info(
            "Ingested documents for region=%s doc_count=%d", region, doc_store.count_documents()
        )
        logger.info("ChromaDB collections: %s", chroma_client.list_collections())


def get_s3_subfolders(s3: BaseClient, bucket: str, s3_folder: str) -> dict[str, str]:
    paginator = s3.get_paginator("list_objects_v2")
    subfolders = {}
    for result in paginator.paginate(Bucket=bucket, Prefix=s3_folder):
        for obj in result.get("Contents", []):
            s3_key = obj["Key"]
            if s3_key == s3_folder:
                continue  # Skip the folder itself
            if s3_key.endswith("/"):
                region = s3_key.removeprefix(s3_folder).removesuffix("/")
                subfolders[region] = s3_key
    return subfolders


def download_s3_folder_to_local(
    s3: BaseClient, bucket: str, s3_folder: str, local_folder: str
) -> str:
    """Download the contents of a folder directory from S3 to a local folder."""
    logger.info("Downloading s3://%s/%s to local folder %s", bucket, s3_folder, local_folder)
    paginator = s3.get_paginator("list_objects_v2")
    try:
        for result in paginator.paginate(Bucket=bucket, Prefix=s3_folder):
            for obj in result.get("Contents", []):
                s3_key = obj["Key"]
                if s3_key.endswith("/"):
                    continue  # Skip folders
                local_file_path = os.path.join(local_folder, os.path.relpath(s3_key, s3_folder))
                os.makedirs(os.path.dirname(local_file_path), exist_ok=True)
                s3.download_file(bucket, s3_key, local_file_path)
                logger.info("Downloaded %s to %s", s3_key, local_file_path)
        return local_folder
    except NoCredentialsError:
        logger.error("AWS credentials not found. Please configure your AWS credentials.")
        raise


def _create_ingest_pipeline(doc_store: ChromaDocumentStore, region: str) -> Pipeline:
    pipeline = Pipeline()
    pipeline.add_component("converter", MultiFileConverter())
    pipeline.add_component(
        "preprocessor",
        DocumentPreprocessor(
            split_length=config.rag_chunk_split_length,
            split_overlap=config.rag_chunk_split_overlap,
            remove_empty_lines=False,
            remove_extra_whitespaces=False,
        ),
    )
    pipeline.add_component(
        "embedder", SentenceTransformersDocumentEmbedder(model=config.rag_embedding_model)
    )
    # Add metadata to each document
    pipeline.add_component(
        "metadata_adder",
        DocumentMetadataAdder(
            metadata={"region": region},
        ),
    )
    pipeline.add_component("writer", DocumentWriter(document_store=doc_store))

    # Connect the components
    pipeline.connect("converter.documents", "preprocessor.documents")
    pipeline.connect("preprocessor.documents", "embedder.documents")
    pipeline.connect("embedder.documents", "metadata_adder.documents")
    pipeline.connect("metadata_adder.documents", "writer.documents")
    return pipeline

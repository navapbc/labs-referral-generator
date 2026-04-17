"""
Configuration file for the Gunicorn server used to run the application in production environments.

Attributes:
    bind(str): The socket to bind. Formatted as '0.0.0.0:$PORT'.
    workers(int): The number of worker processes for handling requests.
    threads(int): The number of threads per worker for handling requests.

For more information, see https://docs.gunicorn.org/en/stable/configure.html
"""

import logging
import os
import threading
import time

from src.app_config import config as app_config
from src.ingestion import rag_utils

bind = app_config.host + ":" + str(app_config.port)
# Calculates the number of usable cores and doubles it. Recommended number of workers per core is two.
# https://docs.gunicorn.org/en/latest/design.html#how-many-workers
# We use 'os.sched_getaffinity(pid)' not 'os.cpu_count()' because it returns only allowable CPUs.
# os.sched_getaffinity(pid): Return the set of CPUs the process with PID pid is restricted to.
# os.cpu_count(): Return the number of CPUs in the system.
workers = len(os.sched_getaffinity(0)) * 2
threads = 4


# This function is called once regardless of the number of workers.
# https://stackoverflow.com/questions/24101724/gunicorn-with-multiple-workers-is-there-an-easy-way-to-execute-certain-code-onl
def when_ready(server: object) -> None:
    logging.info("Running when_ready()")

    if os.getenv("SKIP_POPULATE_RAG_DB", "false").lower() == "true":
        logging.info("SKIP_POPULATE_RAG_DB is set to true, skipping populate_vector_db()")
        return

    logging.info("Triggering populate_vector_db() to run in separate thread")
    populate_rag_db_thread = threading.Thread(target=rag_utils.populate_vector_db)
    populate_rag_db_thread.start()

    # Not sure why this is needed but without this sleep,
    # pipelines can get stuck on "Running component retriever".
    # Hypothesis: There's some initialization that is presenting a race condition.
    time.sleep(4)

    logging.info("Done when_ready()")

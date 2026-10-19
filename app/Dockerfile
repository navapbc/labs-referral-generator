# Use the official python3 image based on Debian 13 "Trixie".
# https://hub.docker.com/_/python

# The build stage that will be used to deploy to the various environments
# needs to be called `release` in order to integrate with the repo's
# top-level Makefile
#
# Stages:
#   base    - OS security updates and the app user; shared by every stage
#   poetry  - base + poetry
#   dev     - poetry + dev dependencies (docker-compose)
#   builder - poetry + the production virtualenv in /app/.venv
#   release - base + the virtualenv and app code from builder; no poetry
FROM python:3.13-slim AS base
# See docs for details on upgrading your Python version

RUN apt-get update \
    # Install security updates
    # https://pythonspeed.com/articles/security-updates-in-docker/
    && apt-get upgrade --yes \
    # Reduce the image size by clear apt cached lists
    # Complies with https://github.com/codacy/codacy-hadolint/blob/master/codacy-hadolint/docs/description/DL3009.md
    && rm -rf /var/lib/apt/lists \
    && rm -f /etc/ssl/private/ssl-cert-snakeoil.key

# The base image's bundled pip lags behind security fixes
RUN pip install --no-cache-dir pip==26.2.1

ARG RUN_UID
ARG RUN_USER

# The following logic creates the RUN_USER home directory and the directory where
# we will be storing the application in the image. This runs when the user is not root
RUN : "${RUN_USER:?RUN_USER and RUN_UID need to be set and non-empty.}" && \
    [ "${RUN_USER}" = "root" ] || \
    (useradd --create-home --create --user-group --home "/home/${RUN_USER}" --uid "${RUN_UID}" "${RUN_USER}" \
    && mkdir /app \
    && chown -R "${RUN_UID}" "/home/${RUN_USER}" /app)

#-------------
# Poetry layer
#-------------

FROM base AS poetry

# Install poetry, the package manager.
# https://python-poetry.org
RUN pip install --no-cache-dir poetry==2.3.4

#-----------
# Dev image
#-----------

FROM poetry AS dev

ARG RUN_USER
USER ${RUN_USER}
WORKDIR /app

COPY pyproject.toml poetry.lock ./
# Explicitly create a new virtualenv to avoid getting overridden by mounted .venv folders
RUN poetry config virtualenvs.in-project false && poetry env use python
# Install all dependencies including dev dependencies
RUN poetry install --no-root --with dev

COPY . /app

# Using the `truststore` library worked outside of Docker, but did not work inside a Docker container
# so the current solution is to add the intermediate CA cert to the CA cert file.
# https://stackoverflow.com/questions/27068163/python-requests-not-handling-missing-intermediate-certificate-only-from-one-mach
# Append certificate to .../site-packages/certifi/cacert.pem
RUN CERTIFI_CACERT_FILE=$(poetry run python -c "import certifi; print(certifi.where())") \
    && [ -f "$CERTIFI_CACERT_FILE" ] && cat certs/local_dev_only_selfsigned_ca_root_cert >> "$CERTIFI_CACERT_FILE"

ENV HAYHOOKS_PIPELINES_DIR=/app/src/pipelines
# Deploy pipelines one at a time, as hayhooks 1.x did. hayhooks 2's default
# "parallel" strategy intermittently fails to load pipeline modules with
# "dictionary changed size during iteration", leaving workers without pipelines.
ENV HAYHOOKS_STARTUP_DEPLOY_STRATEGY=sequential

# Set the host to 0.0.0.0 to make the server available external
# to the Docker container that it's running in.
ENV HOST=0.0.0.0

# Run the application.
CMD ["poetry", "run", "gunicorn", "-k", "uvicorn.workers.UvicornWorker", "--workers", "1", "src.app:hayhooks_app", "-b 0.0.0.0:3000"]

#---------
# Builder
#---------

FROM poetry AS builder

WORKDIR /app

# Set virtualenv location to be in project to be easy to find
# This will create a virtualenv in /app/.venv/
# See https://python-poetry.org/docs/configuration/#virtualenvsin-project
# See https://python-poetry.org/docs/configuration/#using-environment-variables
ENV POETRY_VIRTUALENVS_IN_PROJECT=true

# Install production runtime dependencies only, in their own layer so code
# changes don't reinstall them
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-root --only main --no-cache

# Install the project itself, which puts the scripts defined in pyproject.toml
# (db-migrate, copy-prompts, ...) in /app/.venv/bin
COPY src ./src
RUN poetry install --only main --no-cache

#---------
# Release
#---------

FROM base AS release
ARG RUN_USER

# Gunicorn requires this workaround to create writable temporary directory in
# our readonly root file system. https://github.com/aws/containers-roadmap/issues/736
RUN mkdir -p /tmp
VOLUME ["/tmp"]

WORKDIR /app

# Only what the app needs at runtime. Local-only files (certs/, local.env,
# tests/, docker-compose files) stay out of the release image.
COPY --from=builder /app/.venv /app/.venv
COPY src ./src
COPY prompts ./prompts
COPY gunicorn.conf.py ./

ENV HAYHOOKS_PIPELINES_DIR=/app/src/pipelines
# Deploy pipelines one at a time, as hayhooks 1.x did. hayhooks 2's default
# "parallel" strategy intermittently fails to load pipeline modules with
# "dictionary changed size during iteration", leaving workers without pipelines.
ENV HAYHOOKS_STARTUP_DEPLOY_STRATEGY=sequential

# Add project's virtual env to the PATH so we can directly run poetry scripts
# defined in pyproject.toml
ENV PATH="/app/.venv/bin:$PATH"

# Set the host to 0.0.0.0 to make the server available external
# to the Docker container that it's running in.
ENV HOST=0.0.0.0

# Disable posthog telemetry for ChromaDB (used for RAG) https://docs.trychroma.com/docs/overview/telemetry
ENV ANONYMIZED_TELEMETRY=False

USER ${RUN_USER}

# Run the application.
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "src.app:hayhooks_app", "-b", "0.0.0.0:8000"]

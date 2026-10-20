# CI/CD

The CI/CD for this project uses [reusable Github Actions workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows).

> [!NOTE]
> This repo is published as open source and is not deployed to AWS. Workflows that
> deploy, publish images to Amazon ECR, or otherwise run against AWS are disabled by
> renaming them to `*.yml.disabled`: `cd-app`, `cd-frontend`, `ci-app-infra-service`,
> `ci-frontend-infra-service`, `ci-app-pr-environment-checks`,
> `ci-frontend-pr-environment-checks`, `ci-app-pr-environment-destroy`,
> `ci-frontend-pr-environment-destroy`, `check-ci-cd-auth`, `check-infra-deploy-status`,
> `restart-app`, and `scan-orphaned-environments`. The reusable `build-and-publish`
> workflow no longer has a manual `workflow_dispatch` trigger, so nothing pushes images
> to ECR. To re-enable a workflow, drop the `.disabled` suffix.

## 🧪 CI

### Per app workflows

Each app should have:

- `ci-<APP_NAME>`: must be created; should run linting and testing
- `ci-<APP_NAME>-vulnerability-scans`: calls `vulnerability-scans`
  - Based on [ci-{{app_name}}-vulnerability-scans](https://github.com/navapbc/template-infra/blob/main/.github/workflows/ci-{{app_name}}-vulnerability-scans.yml.jinja)
- `ci-<APP_NAME>-pr-environment-checks.yml`: calls `pr-environment-checks.yml` to create or update a pull request environment (see [pull request environments](/docs/infra/pull-request-environments.md))
  - Based on [ci-{{app_name}}-pr-environment-checks.yml](https://github.com/navapbc/template-infra/blob/main/.github/workflows/ci-{{app_name}}-pr-environment-checks.yml.jinja)
- `ci-<APP_NAME>-pr-environment-destroy.yml`: calls `pr-environment-destroy.yml` to destroy the pull request environment (see [pull request environments](/docs/infra/pull-request-environments.md))
  - Based on [ci-{{app_name}}-pr-environment-destroy.yml](https://github.com/navapbc/template-infra/blob/main/.github/workflows/ci-{{app_name}}-pr-environment-destroy.yml.jinja)

### App-agnostic workflows

- [`ci-docs`](./ci-docs.yml): runs markdown linting on all markdown files in the file
  - Configure in [markdownlint-config.json](./markdownlint-config.json)
- [`ci-infra`](./ci-infra.yml): run infrastructure CI checks

## 🚢 CD

Each app should have:

- `cd-<APP_NAME>`: deploys an application
  - Based on [`cd-{{app_name}}`](https://github.com/navapbc/template-infra/blob/main/.github/workflows/cd-{{app_name}}.yml.jinja)

The CD workflow uses these reusable workflows:

- [`deploy`](./deploy.yml): deploys an application
- [`database-migrations`](./database-migrations.yml): runs database migrations for an application
- [`build-and-publish`](./build-and-publish.yml): builds a container image for an application and publishes it to an image repository

```mermaid
graph TD
  cd-app
  deploy
  database-migrations
  build-and-publish

  cd-app-->|calls|deploy-->|calls|database-migrations-->|calls|build-and-publish
```

## ⛑️ Helper workflows

- [`check-ci-cd-auth`](./check-ci-cd-auth.yml.disabled) (disabled): verifies that the project's Github repo is able to connect to AWS

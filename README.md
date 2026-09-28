# Referral Generator

**An open-source AI tool that helps case managers make resource referrals and action plans for their clients.**

Built by [Nava Labs](https://www.navapbc.com/labs/ai-tools-public-benefits), a division of [Nava PBC](https://www.navapbc.com).

**[About](#about)** · **[Features](#features)** · **[Components](#components)** · **[Setup](#setup)** · **[Contributing](#contributing)** · **[License](#license)**

---

## About

Referrals are a core part of benefits navigation. Case managers are responsible for identifying services that are relevant, accessible, and appropriate. But this process can be slow, inconsistent, and reliant on personal knowledge or static documents that may be outdated and/or difficult to access. This tool leverages generative AI to assist case managers in identifying relevant community resources and generating personalized action plans for clients. Case managers enter client information into the tool, which uses a Retrieval-Augmented Generation (RAG) pipeline and a large language model to surface trusted resources and create a tailored action plan. Results can be printed or emailed directly to clients.

The [Referral Generator](https://www.navapbc.com/labs/caseworker-ai-tools/referral-generator) is a  part of Nava Labs' broader [Caseworker Empowerment Toolkit](https://caseworker.navapbc.com). 

**Initial development and piloting:**

The Referral Generator was initially developed with funding from the Gates Foundation, in partnership with [Goodwill Central Texas](https://www.goodwillcentraltexas.org/) and [Goodwill Keystone Area](https://www.yourgoodwill.org/). 68 staff members in public-facing roles across these two regional Goodwill affiliates tested the tool in a 4-month pilot period running November 2025 to February 2026, with pilot results showing promising signal of reducing administrative burden. Nava Labs is sharing findings from development and piloting in regular Demo Days:
- [Developing a Referral Generator for Case Managers](https://www.navapbc.com/events/nava-labs-demo-day-6)

**Who this is for:**

- **Caseworkers and benefit navigators** who help clients find programs and resources to address their needs
- **Government agencies and social services organizations** developing AI tools for their workforce
- **Developers** looking to build or adapt AI-assisted casework tools for their context

---

## Features

- **Resource search across internal materials and web sources** — Identifies relevant resources based on a given client scenario, drawing from the organization's priority sources along with information from the web
- **Referral list** — Summarizes key information about relevant resources 
- **Action planning** — Generates detailed action plans to guide the client through necessary steps to access the resource
- **Email and print** - Easy options to share referrals and action plans with clients
- **Flexible AI model support** — works with multiple LLM providers

The following describes a typical end-to-end session for a case manager using the Referral Generator.

1. **Open the tool** — Navigate to the application in a browser. A login form will show. In the template configuration there is no authentication, and the form merely captures user information which is used in evaluations and application tracing
2. **Enter client information** — Fill out the intake form with details such as the client's employment goals, barriers to employment, and location. The UI components are designed to structure this input in a way that automatically enriches the LLM prompt, reducing the need for case managers to manually phrase queries.
3. **Generate referrals** — Submit the form to trigger the RAG pipeline. The tool retrieves relevant resources from the knowledge base and passes them along with the client context to the LLM, which returns a structured list of community resources.
4. **Review resources** — Browse the returned resource list. Each resource includes relevant details to help the case manager assess fit for the client.
5. **Generate an action plan** — With resources selected, request an action plan. The LLM uses the client information and resource list to produce a personalized, step-by-step plan that accounts for prerequisite steps and constraints specific to the client's situation.
6. **Share results** — Print the referral list and action plan as a PDF, or email them directly to the client or relevant parties.

[Demonstration Video](https://drive.google.com/file/d/1-h1UXtbFssYFsl6or0bE6PCFGXO7WOXS/view?usp=sharing)

---

## Components

| Component | Technology | AWS Service | Role                                                                                                                     |
|---|---|---|--------------------------------------------------------------------------------------------------------------------------|
| Frontend | Next.js / React | ECS | Case manager UI — enter client info, view referrals & action plan, print/email results                                   |
| Backend / API | Python / Hayhooks | ECS | LLM pipeline orchestration, streaming and synchronous API endpoints                                                      |
| Database | PostgreSQL | RDS | Stores LLM responses, user data, and monitoring trace data                                                               |
| Vector Database | ChromaDB | ECS | RAG retrieval — improves referral speed and accuracy                                                                     |
| Knowledge Base | File storage | S3 | Trusted community resources and job listings used by the RAG system. This information is maintained and updated by a SME |
| Email Service | AWS SES | SES | Sends referral lists and action plans to case managers and clients                                                       |
| Monitoring | Phoenix Arize | ECS | LLM trace data and prompt version management                                                                             |

---

## Setup

Ensure the following prerequisites are installed on your machine: [Docker Desktop](https://www.docker.com/products/docker-desktop/), [Python 3.12](https://github.com/pyenv/pyenv#installation), [Poetry](https://python-poetry.org/docs/#installation), and [Node.js ≥ 20](https://nodejs.org/).

For a deeper look at the system design, see [docs/system-architecture.md](docs/system-architecture.md).

### Backend (app)

See [docs/app/getting-started.md](docs/app/getting-started.md) for full setup instructions.

### Frontend

See [frontend/README.md](frontend/README.md) for full setup instructions.

---
## Contributing

We welcome contributions from the community — whether you're fixing a bug, suggesting a feature, or improving documentation.

Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request. All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

For security-related issues, please review our [Security Policy](SECURITY.md) before disclosing publicly.

---

## License

This project is licensed under the [Apache License 2.0](LICENSE). You are free to use, modify, and distribute this software in accordance with the license terms.

---

## About Nava

[Nava PBC](https://www.navapbc.com) partners with government agencies to design and build simple, effective digital services. As a public benefit corporation, we're accountable to our mission: making it easier for people to access the services they need.

[Nava Labs](https://www.navapbc.com/labs) uses philanthropic funding to prototype safety-net innovations that government agencies need but can’t fund directly. We build and test new approaches to delivering public services, evaluate what works, and advocate for scaling proven solutions.

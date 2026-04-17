# GenAI Referral Generator

*AI-assisted resource referral and action planning for case managers.*

## Table of Contents

- [Product Description](#product-description)
- [Components](#components)
- [Setup](#setup)
  - [Backend (app)](#backend-app)
  - [Frontend](#frontend)
- [Usage Examples](#usage-examples)
- [Contact](#contact)
- [Open Source](#open-source)

---

## Product Description

The GenAI Referral Generator is a pilot application developed by Nava Labs, a research and development team within Nava PBC.  It assists case managers in identifying relevant community resources and generating personalized action plans for clients. Case managers enter client information into the tool, which uses a Retrieval-Augmented Generation (RAG) pipeline and a large language model to surface trusted resources and create a tailored action plan. Results can be printed or emailed directly to clients.

The GenAI Referral Generator demonstrates the effectiveness of LLMs at identifying relevant resources, and allows you to evaluate the accuracy of identifying prerequisite steps and constraints relevant to case managers' clients.

---

### Components

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

## Usage Examples

The following describes a typical end-to-end session for a case manager using the GenAI Referral Generator.

1. **Open the tool** — Navigate to the application in a browser. A login screen will show. There is no authentication, this is merely to capture user information which is used in evaluations and application tracing
2. **Enter client information** — Fill out the intake form with details such as the client's employment goals, barriers to employment, and location. The UI components are designed to structure this input in a way that automatically enriches the LLM prompt, reducing the need for case managers to manually phrase queries.
3. **Generate referrals** — Submit the form to trigger the RAG pipeline. The tool retrieves relevant resources from the knowledge base and passes them along with the client context to the LLM, which returns a structured list of community resources.
4. **Review resources** — Browse the returned resource list. Each resource includes relevant details to help the case manager assess fit for the client.
5. **Generate an action plan** — With resources selected, request an action plan. The LLM uses the client information and resource list to produce a personalized, step-by-step plan that accounts for prerequisite steps and constraints specific to the client's situation.
6. **Share results** — Print the referral list and action plan as a PDF, or email them directly to the client or relevant parties.

[Demonstration Video](https://drive.google.com/file/d/1-h1UXtbFssYFsl6or0bE6PCFGXO7WOXS/view?usp=sharing)

---

## Contact

For questions about this project, reach out to the Nava Labs team at [labs-dst@navapbc.com](mailto:labs-dst@navapbc.com).

---

## Open Source

This project is made available as open source for future research purposes and extension. It was developed by [Nava PBC](https://www.navapbc.com) in partnership with Goodwill.
The initial research pilot started in August 2025 and the Pilot usage ended in Early March 2026.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating. Security issues should be reported privately per our [Security Policy](SECURITY.md).

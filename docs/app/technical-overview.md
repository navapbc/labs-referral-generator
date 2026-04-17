# Technical Overview

- [Key Technologies](#key-technologies)
- [Request operations](#request-operations)
- [Authentication](#authentication)
- [Authorization](#authorization)

## Key Technologies

Haystack is an open-source framework for building applications powered by large language models (LLMs), search, 
and question answering. It provides modular components—like document stores, retrievers, and generators—that can be 
combined into pipelines to process, search, and generate responses from your data. With built-in integrations for databases, 
vector search engines, and APIs, it enables developers to quickly prototype and deploy production-ready NLP systems.

SQLAlchemy is the ORM, with migrations driven by Alembic. pydantic is used in
many spots for parsing data (and often serializing it to json or plain
dictionaries). Where pydantic is not used, plain Python dataclasses are
generally preferred.

- [OpenAPI Specification][oas-docs]
- [Haystack][haystack-docs]
- [SQLAlchemy][sqlalchemy-home] ([source code][sqlalchemy-src])
- [Alembic][alembic-home] ([source code][alembic-src])
- [pydantic][pydantic-home] ([source code][pydantic-src])
- [poetry](https://python-poetry.org/docs/) - Python dependency management

[oas-docs]: http://spec.openapis.org/oas/v3.0.3
[haystack-docs]: https://docs.haystack.deepset.ai/docs/intro

[pydantic-home]:https://pydantic-docs.helpmanual.io/
[pydantic-src]: https://github.com/samuelcolvin/pydantic/

[sqlalchemy-home]: https://www.sqlalchemy.org/
[sqlalchemy-src]: https://github.com/sqlalchemy/sqlalchemy

[alembic-home]: https://alembic.sqlalchemy.org/en/latest/
[alembic-src]: https://github.com/sqlalchemy/alembic

## Request operations

- TODO - redo this

## Authentication

TODO update

## Authorization
n/a - Specific user authorization is not yet implemented for this API.

### Database diagram
n/a - Database diagrams are not yet available for this application.

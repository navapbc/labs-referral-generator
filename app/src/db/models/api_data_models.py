import logging

from sqlalchemy.orm import Mapped, mapped_column

from src.db.models.base import Base, IdMixin, TimestampMixin

logger = logging.getLogger(__name__)


class LlmResponse(Base, IdMixin, TimestampMixin):
    __tablename__ = "llm_response"

    raw_text: Mapped[str] = mapped_column(
        nullable=False, comment="The raw string of the LLM response; may contain JSON string"
    )

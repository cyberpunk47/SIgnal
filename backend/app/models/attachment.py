from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id"),
        nullable=False,
    )

    file_url: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
    )

    file_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    file_size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
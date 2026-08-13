from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    message_id: Mapped[int] = mapped_column(
        ForeignKey("messages.id"),
        nullable=False,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    emoji: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
from datetime import datetime
from enum import Enum
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"


class MessageStatusType(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class Message(Base):
    __tablename__ = "messages"

    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "sender_id",
            "client_temp_id",
            name="uq_message_client_temp",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id"),
        nullable=False,
    )

    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    message_type: Mapped[MessageType] = mapped_column(
        SQLEnum(MessageType),
        default=MessageType.TEXT,
        nullable=False,
    )

    reply_to_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id"),
        nullable=True,
    )

    client_temp_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )


class MessageStatus(Base):
    __tablename__ = "message_status"

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

    status: Mapped[MessageStatusType] = mapped_column(
        SQLEnum(MessageStatusType),
        default=MessageStatusType.SENT,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
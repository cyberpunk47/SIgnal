from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)
from app.database import Base


class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"


class ChatRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    type: Mapped[ConversationType] = mapped_column(
        SQLEnum(ConversationType),
        nullable=False,
    )

    name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    members: Mapped[list["ConversationMember"]] = relationship(
        "ConversationMember",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id"),
        nullable=False,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    role: Mapped[ChatRole] = mapped_column(
        SQLEnum(ChatRole),
        default=ChatRole.MEMBER,
        nullable=False,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    last_read_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("messages.id"),
        nullable=True,
    )

    is_muted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    left_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="members",
    )
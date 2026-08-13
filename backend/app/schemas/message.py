from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"


class MessageStatus(str, Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class SendMessageRequest(BaseModel):
    content: str | None = Field(
        default=None,
        max_length=10000,
    )

    message_type: MessageType = MessageType.TEXT

    reply_to_message_id: int | None = None

    client_temp_id: str = Field(
        min_length=1,
        max_length=100,
    )


class UpdateMessageRequest(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=10000,
    )


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    content: str | None
    message_type: MessageType
    reply_to_message_id: int | None
    client_temp_id: str | None
    is_deleted: bool
    created_at: datetime


class MessageStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message_id: int
    user_id: int
    status: MessageStatus
    updated_at: datetime


class UpdateMessageStatusRequest(BaseModel):
    status: MessageStatus

class MarkConversationReadRequest(BaseModel):
    message_id: int

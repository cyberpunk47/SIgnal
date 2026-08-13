from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ConversationType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"


class ChatRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"


class CreateDirectConversationRequest(BaseModel):
    user_id: int


class CreateGroupConversationRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    member_ids: list[int] = Field(
        min_length=1,
    )


class UpdateConversationRequest(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    avatar_url: str | None = None


class AddMemberRequest(BaseModel):
    user_id: int


class RemoveMemberRequest(BaseModel):
    user_id: int


class UpdateMemberRoleRequest(BaseModel):
    role: ChatRole


class ConversationMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    role: ChatRole
    joined_at: datetime
    last_read_message_id: int | None
    is_muted: bool
    left_at: datetime | None


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: ConversationType
    name: str | None
    avatar_url: str | None
    created_by: int | None
    created_at: datetime
    last_message_at: datetime | None

    members: list[ConversationMemberResponse] = []

class LeaveConversationResponse(BaseModel):
    message: str


class TransferAdminRequest(BaseModel):
    user_id: int
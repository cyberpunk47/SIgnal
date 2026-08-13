from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    avatar_url: str | None = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    phone_number: str | None
    display_name: str
    avatar_url: str | None
    is_online: bool
    last_seen_at: datetime | None
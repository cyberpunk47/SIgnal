from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BlockUserRequest(BaseModel):
    user_id: int


class BlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    blocker_id: int
    blocked_id: int
    created_at: datetime
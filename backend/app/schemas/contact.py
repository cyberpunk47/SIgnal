from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AddContactRequest(BaseModel):
    contact_user_id: int


class UpdateContactRequest(BaseModel):
    nickname: str | None = Field(
        default=None,
        max_length=100,
    )


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact_user_id: int
    nickname: str | None
    created_at: datetime
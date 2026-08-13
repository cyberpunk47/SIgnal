from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=20)
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=50,
    )
    display_name: str = Field(
        min_length=1,
        max_length=100,
    )

class VerifyOTPRequest(BaseModel):
    phone_number: str
    otp: str = Field(min_length=4, max_length=6)


class LoginRequest(BaseModel):
    phone_number: str = Field(
        min_length=7,
        max_length=20,
    )

class LoginResponse(BaseModel):
    token: str
    user_id: int
    username: str
    display_name: str


class UserLookupRequest(BaseModel):
    identifier: str = Field(
        min_length=1,
        max_length=100,
    )
from datetime import datetime, timedelta, timezone
import secrets
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.session import Session as UserSession

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    VerifyOTPRequest,
)


# Temporary OTP storage.
# Later this can be moved to Redis.
otp_store: dict[str, str] = {}


def normalize_phone_number(phone: str) -> str:
    """
    Convert an Indian phone number into one canonical format.

    Examples:
        9523007323      -> 919523007323
        919523007323    -> 919523007323
        +919523007323   -> 919523007323
        +91 9523007323  -> 919523007323
        +91-9523007323  -> 919523007323
    """

    digits = re.sub(r"\D", "", phone)

    # 10-digit Indian number
    if len(digits) == 10:
        return f"91{digits}"

    # 91 + 10-digit Indian number
    if len(digits) == 12 and digits.startswith("91"):
        return digits

    raise ValueError("Invalid phone number")


def generate_otp(phone_number: str) -> str:
    """
    Generate an OTP and store it temporarily.

    For this assignment we are mocking SMS delivery.
    The OTP is printed in the backend terminal.
    """

    # Fixed OTP for development/testing.
    otp = "123456"

    otp_store[phone_number] = otp

    print(
        f"[MOCK SMS] OTP for {phone_number}: {otp}"
    )

    return otp


def register_user(
    db: Session,
    request: RegisterRequest,
) -> User:

    # --------------------------------
    # 1. Normalize phone number
    # --------------------------------

    phone_number = normalize_phone_number(
        request.phone_number
    )

    # --------------------------------
    # 2. Check phone number
    # --------------------------------

    existing_user = db.scalar(
        select(User).where(
            User.phone_number == phone_number
        )
    )

    if existing_user:
        raise ValueError(
            "Phone number already registered"
        )

    # --------------------------------
    # 3. Check username
    # --------------------------------

    username = request.username

    if username:

        existing_username = db.scalar(
            select(User).where(
                User.username == username
            )
        )

        if existing_username:
            raise ValueError(
                "Username already exists"
            )

    # --------------------------------
    # 4. Generate username if omitted
    # --------------------------------

    if not username:

        username = (
            f"user_{secrets.token_hex(4)}"
        )

    # --------------------------------
    # 5. Create User Entity
    # --------------------------------

    user = User(
        phone_number=phone_number,
        username=username,
        display_name=request.display_name,
        is_online=False,
    )

    # --------------------------------
    # 6. Save User
    # --------------------------------

    db.add(user)
    db.commit()
    db.refresh(user)

    # --------------------------------
    # 7. Generate OTP
    # --------------------------------

    generate_otp(
        phone_number
    )

    return user


def login_user(
    db: Session,
    request: LoginRequest,
) -> None:

    # --------------------------------
    # 1. Normalize phone number
    # --------------------------------

    phone_number = normalize_phone_number(
        request.phone_number
    )

    # --------------------------------
    # 2. Find user by phone number
    # --------------------------------

    user = db.scalar(
        select(User).where(
            User.phone_number == phone_number
        )
    )

    if not user:
        raise ValueError(
            "Phone number not registered"
        )

    # --------------------------------
    # 3. Generate OTP
    # --------------------------------

    generate_otp(
        phone_number
    )


def resolve_user_identifier(
    db: Session,
    identifier: str,
) -> User:

    normalized_identifier = identifier.strip()

    if not normalized_identifier:
        raise ValueError(
            "User not found"
        )

    # --------------------------------
    # 1. Try user ID
    # --------------------------------

    if normalized_identifier.isdigit():

        user = db.get(
            User,
            int(normalized_identifier),
        )

        if user:
            return user

    # --------------------------------
    # 2. Try username
    # --------------------------------

    user = db.scalar(
        select(User).where(
            User.username == normalized_identifier
        )
    )

    if user:
        return user

    # --------------------------------
    # 3. Try phone number
    # --------------------------------

    normalized_digits = re.sub(
        r"\D",
        "",
        normalized_identifier,
    )

    if normalized_digits:

        try:
            phone_number = normalize_phone_number(
                normalized_digits
            )
        except ValueError:
            phone_number = None

        if phone_number:

            user = db.scalar(
                select(User).where(
                    User.phone_number == phone_number
                )
            )

            if user:
                return user

    raise ValueError(
        "User not found"
    )


def verify_otp(
    db: Session,
    request: VerifyOTPRequest,
) -> tuple[User, str]:

    # --------------------------------
    # 1. Normalize phone number
    # --------------------------------

    phone_number = normalize_phone_number(
        request.phone_number
    )

    # --------------------------------
    # 2. Get stored OTP
    # --------------------------------

    stored_otp = otp_store.get(
        phone_number
    )

    if stored_otp is None:
        raise ValueError(
            "OTP expired or not requested"
        )

    # --------------------------------
    # 3. Check OTP
    # --------------------------------

    if stored_otp != request.otp:
        raise ValueError(
            "Invalid OTP"
        )

    # --------------------------------
    # 4. Find user
    # --------------------------------

    user = db.scalar(
        select(User).where(
            User.phone_number == phone_number
        )
    )

    if not user:
        raise ValueError(
            "User not found"
        )

    # --------------------------------
    # 5. Delete OTP
    # --------------------------------
    # OTP can only be used once.

    del otp_store[
        phone_number
    ]

    # --------------------------------
    # 6. Create session token
    # --------------------------------

    token = secrets.token_urlsafe(32)

    now = datetime.now(timezone.utc)

    session = UserSession(
        user_id=user.id,
        token=token,
        created_at=now,
        expires_at=now + timedelta(minutes=30),
    )

    # --------------------------------
    # 7. Save session
    # --------------------------------

    db.add(session)

    # --------------------------------
    # 8. Leave presence to the websocket lifecycle
    # --------------------------------

    user.is_online = False

    # --------------------------------
    # 9. Commit everything
    # --------------------------------

    db.commit()

    return user, token
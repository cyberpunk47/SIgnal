from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.session import Session as UserSession
from app.models.user import User


# Reads:
# Authorization: Bearer <token>
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:

    # --------------------------------
    # 1. Extract token
    # --------------------------------

    token = credentials.credentials

    # --------------------------------
    # 2. Find session
    # --------------------------------

    user_session = db.scalar(
        select(UserSession).where(
            UserSession.token == token
        )
    )

    if not user_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    # --------------------------------
    # 3. Check expiration
    # --------------------------------

    now = datetime.now(timezone.utc)

    expires_at = user_session.expires_at

    # SQLite may return a naive datetime,
    # so normalize it to UTC.
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at <= now:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    # --------------------------------
    # 4. Find user
    # --------------------------------

    user = db.scalar(
        select(User).where(
            User.id == user_session.user_id
        )
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # --------------------------------
    # 5. Return authenticated user
    # --------------------------------

    return user
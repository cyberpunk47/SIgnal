from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.database import get_db

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    VerifyOTPRequest,
    UserLookupRequest,
)

from app.schemas.user import UserResponse

from app.services.auth_service import (
    register_user,
    login_user,
    verify_otp,
    resolve_user_identifier,
)
from app.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):

    try:

        user = register_user(
            db=db,
            request=request,
        )

        return user

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):

    try:

        login_user(
            db=db,
            request=request,
        )

        return {
            "message": "OTP sent"
        }

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/verify",
    response_model=LoginResponse,
)
def verify(
    request: VerifyOTPRequest,
    db: Session = Depends(get_db),
):

    try:

        user, token = verify_otp(
            db=db,
            request=request,
        )

        return LoginResponse(
            token=token,
            user_id=user.id,
            username=user.username,
            display_name=user.display_name,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/lookup",
    response_model=UserResponse,
)
def lookup_user(
    request: UserLookupRequest,
    db: Session = Depends(get_db),
):

    try:

        return resolve_user_identifier(
            db=db,
            identifier=request.identifier,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return current_user
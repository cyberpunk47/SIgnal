from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.block import (
    BlockUserRequest,
    BlockResponse,
)
from app.services.block_service import (
    block_user,
    unblock_user,
)


router = APIRouter(
    prefix="/blocks",
    tags=["Blocks"],
)

@router.post(
    "",
    response_model=BlockResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_block(
    request: BlockUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return block_user(
            db=db,
            current_user=current_user,
            target_user_id=request.user_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_block(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        unblock_user(
            db=db,
            current_user=current_user,
            target_user_id=user_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
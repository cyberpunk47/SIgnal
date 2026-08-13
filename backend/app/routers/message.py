from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User

from app.schemas.message import (
    SendMessageRequest,
    MessageResponse,
    UpdateMessageRequest,
    MessageStatusResponse,
    UpdateMessageStatusRequest,
    MarkConversationReadRequest,
)

from app.services.message_service import (
    send_message,
    get_conversation_messages,
    get_message_receipts,
    update_message,
    delete_message,
    update_message_status,
    mark_conversation_as_read,
)
from app.schemas.conversation import ConversationMemberResponse

router = APIRouter(
    prefix="/conversations",
    tags=["Messages"],
)


# ============================================================
# SEND MESSAGE
# ============================================================

@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: int,
    request: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return await send_message(
            db=db,
            current_user=current_user,
            conversation_id=conversation_id,
            request=request,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================================
# GET MESSAGE HISTORY
# ============================================================

@router.get(
    "/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def get_messages(
    conversation_id: int,

    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),

    before_message_id: int | None = Query(
        default=None,
    ),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    try:

        return get_conversation_messages(
            db=db,
            current_user=current_user,
            conversation_id=conversation_id,
            limit=limit,
            before_message_id=before_message_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.get(
    "/messages/{message_id}/receipts",
    response_model=list[MessageStatusResponse],
)
def get_message_receipts_endpoint(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return get_message_receipts(
            db=db,
            current_user=current_user,
            message_id=message_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# ============================================================
# UPDATE MESSAGE
# ============================================================

@router.patch(
    "/messages/{message_id}",
    response_model=MessageResponse,
)
def update_message_endpoint(
    message_id: int,

    request: UpdateMessageRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    try:

        return update_message(
            db=db,
            current_user=current_user,
            message_id=message_id,
            request=request,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

@router.delete(
    "/messages/{message_id}",
    response_model=MessageResponse,
)
def delete_message_endpoint(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return delete_message(
            db=db,
            current_user=current_user,
            message_id=message_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
# ============================================================
# UPDATE MESSAGE STATUS
# ============================================================

@router.patch(
    "/messages/{message_id}/status",
    response_model=MessageStatusResponse,
)
def update_message_status_endpoint(
    message_id: int,

    request: UpdateMessageStatusRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        get_current_user
    ),
):

    try:

        return update_message_status(
            db=db,
            current_user=current_user,
            message_id=message_id,
            new_status=request.status,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ============================================================
# MARK CONVERSATION AS READ
# ============================================================

@router.post(
    "/{conversation_id}/read",
    response_model=ConversationMemberResponse,
)
async def mark_read(
    conversation_id: int,
    request: MarkConversationReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return await mark_conversation_as_read(
        db=db,
        current_user=current_user,
        conversation_id=conversation_id,
        message_id=request.message_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

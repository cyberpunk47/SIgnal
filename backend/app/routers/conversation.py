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

from app.schemas.conversation import (
    CreateDirectConversationRequest,
    CreateGroupConversationRequest,
    ConversationResponse,
)
from app.schemas.conversation import (
    AddMemberRequest,
    RemoveMemberRequest,
    UpdateMemberRoleRequest,
    ConversationMemberResponse,
    LeaveConversationResponse,
    TransferAdminRequest,
)
from app.services.conversation_service import (
    create_direct_conversation,
    create_group_conversation,
    get_user_conversations,
    add_member,
    remove_member,
    update_member_role,
      leave_conversation,
    transfer_admin,
)


router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)

@router.post(
    "/direct",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
)
def create_direct(
    request: CreateDirectConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return create_direct_conversation(
            db=db,
            current_user=current_user,
            request=request,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/group",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    request: CreateGroupConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return create_group_conversation(
            db=db,
            current_user=current_user,
            request=request,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get(
    "",
    response_model=list[ConversationResponse],
)
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return get_user_conversations(
        db=db,
        current_user=current_user,
    )

@router.post(
    "/{conversation_id}/members",
    response_model=ConversationMemberResponse,
)
def add_conversation_member(
    conversation_id: int,
    request: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:
        return add_member(
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


@router.delete(
    "/{conversation_id}/members",
    response_model=ConversationMemberResponse,
)
def remove_conversation_member(
    conversation_id: int,
    request: RemoveMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:
        return remove_member(
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

@router.patch(
    "/{conversation_id}/members/{user_id}/role",
    response_model=ConversationMemberResponse,
)
def change_member_role(
    conversation_id: int,
    user_id: int,
    request: UpdateMemberRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:
        return update_member_role(
            db=db,
            current_user=current_user,
            conversation_id=conversation_id,
            user_id=user_id,
            request=request,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post(
    "/{conversation_id}/leave",
    response_model=LeaveConversationResponse,
)
def leave_group(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        leave_conversation(
            db=db,
            current_user=current_user,
            conversation_id=conversation_id,
        )

        return {
            "message": "You left the conversation"
        }

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post(
    "/{conversation_id}/transfer-admin",
    response_model=ConversationMemberResponse,
)
def transfer_conversation_admin(
    conversation_id: int,
    request: TransferAdminRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return transfer_admin(
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
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.user import User
from app.models.conversation import (
    Conversation,
    ConversationMember,
    ConversationType,
    ChatRole,
)

from app.schemas.conversation import (
    CreateDirectConversationRequest,
    CreateGroupConversationRequest,
    TransferAdminRequest,
)
from app.schemas.conversation import (
    AddMemberRequest,
    RemoveMemberRequest,
    UpdateMemberRoleRequest,
)

def create_direct_conversation(
    db: Session,
    current_user: User,
    request: CreateDirectConversationRequest,
) -> Conversation:

    # 1. Don't allow chatting with yourself
    if current_user.id == request.user_id:
        raise ValueError(
            "You cannot create a conversation with yourself"
        )

    # 2. Check target user exists
    target_user = db.scalar(
        select(User).where(
            User.id == request.user_id
        )
    )

    if not target_user:
        raise ValueError(
            "User not found"
        )

    # 3. Find existing direct conversations
    current_user_conversations = db.scalars(
        select(ConversationMember.conversation_id).where(
            ConversationMember.user_id == current_user.id
        )
    ).all()

    target_user_conversations = db.scalars(
        select(ConversationMember.conversation_id).where(
            ConversationMember.user_id == target_user.id
        )
    ).all()

    common_conversation_ids = set(
        current_user_conversations
    ).intersection(
        target_user_conversations
    )

    if common_conversation_ids:

        existing_conversation = db.scalar(
            select(Conversation).where(
                Conversation.id.in_(
                    common_conversation_ids
                ),
                Conversation.type
                == ConversationType.DIRECT,
            )
        )

        if existing_conversation:
            return existing_conversation

    # 4. Create conversation
    conversation = Conversation(
        type=ConversationType.DIRECT,
        created_by=current_user.id,
    )

    db.add(conversation)
    db.flush()

    # 5. Add current user
    current_member = ConversationMember(
        conversation_id=conversation.id,
        user_id=current_user.id,
        role=ChatRole.MEMBER,
    )

    # 6. Add target user
    target_member = ConversationMember(
        conversation_id=conversation.id,
        user_id=target_user.id,
        role=ChatRole.MEMBER,
    )

    db.add(current_member)
    db.add(target_member)

    db.commit()
    db.refresh(conversation)

    return conversation


def create_group_conversation(
    db: Session,
    current_user: User,
    request: CreateGroupConversationRequest,
) -> Conversation:

    # Remove duplicates
    member_ids = set(request.member_ids)

    # Creator must always be a member
    member_ids.add(current_user.id)

    # 1. Find all requested users
    users = db.scalars(
        select(User).where(
            User.id.in_(member_ids)
        )
    ).all()

    if len(users) != len(member_ids):
        raise ValueError(
            "One or more users were not found"
        )

    # 2. Create conversation
    conversation = Conversation(
        type=ConversationType.GROUP,
        name=request.name,
        created_by=current_user.id,
    )

    db.add(conversation)
    db.flush()

    # 3. Add members
    for user in users:

        role = (
            ChatRole.ADMIN
            if user.id == current_user.id
            else ChatRole.MEMBER
        )

        member = ConversationMember(
            conversation_id=conversation.id,
            user_id=user.id,
            role=role,
        )

        db.add(member)

    db.commit()
    db.refresh(conversation)

    return conversation


def get_user_conversations(
    db: Session,
    current_user: User,
) -> list[Conversation]:

    conversations = db.scalars(
        select(Conversation)
        .join(
            ConversationMember,
            ConversationMember.conversation_id
            == Conversation.id,
        )
        .where(
            ConversationMember.user_id
            == current_user.id,
            ConversationMember.left_at.is_(None),
        )
        .order_by(
            Conversation.last_message_at.desc()
        )
    ).all()

    return list(conversations)

def add_member(
    db: Session,
    current_user: User,
    conversation_id: int,
    request: AddMemberRequest,
) -> ConversationMember:

    # --------------------------------------------------------
    # 1. Find conversation
    # --------------------------------------------------------

    conversation = db.get(
        Conversation,
        conversation_id,
    )

    if not conversation:
        raise ValueError(
            "Conversation not found"
        )

    # --------------------------------------------------------
    # 2. Current user must be ADMIN
    # --------------------------------------------------------

    admin = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not admin:
        raise ValueError(
            "You are not a member of this conversation"
        )

    if admin.role != ChatRole.ADMIN:
        raise ValueError(
            "Only admins can add members"
        )

    # --------------------------------------------------------
    # 3. Direct conversations cannot have more members
    # --------------------------------------------------------

    if conversation.type.value == "direct":
        raise ValueError(
            "Cannot add members to a direct conversation"
        )

    # --------------------------------------------------------
    # 4. Find target user
    # --------------------------------------------------------

    user = db.get(
        User,
        request.user_id,
    )

    if not user:
        raise ValueError(
            "User not found"
        )

    # --------------------------------------------------------
    # 5. Check existing membership
    # --------------------------------------------------------

    existing_member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == request.user_id,
        )
    )

    if existing_member:

        if existing_member.left_at is None:
            raise ValueError(
                "User is already a member"
            )

        # Re-join previously removed member
        existing_member.left_at = None
        existing_member.joined_at = datetime.utcnow()
        existing_member.role = ChatRole.MEMBER

        db.commit()
        db.refresh(existing_member)

        return existing_member

    # --------------------------------------------------------
    # 6. Create member
    # --------------------------------------------------------

    member = ConversationMember(
        conversation_id=conversation_id,
        user_id=request.user_id,
        role=ChatRole.MEMBER,
        joined_at=datetime.utcnow(),
    )

    db.add(member)

    db.commit()
    db.refresh(member)

    return member

def remove_member(
    db: Session,
    current_user: User,
    conversation_id: int,
    request: RemoveMemberRequest,
) -> ConversationMember:

    # --------------------------------------------------------
    # 1. Find conversation
    # --------------------------------------------------------

    conversation = db.get(
        Conversation,
        conversation_id,
    )

    if not conversation:
        raise ValueError(
            "Conversation not found"
        )

    if conversation.type.value == "direct":
        raise ValueError(
            "Members cannot be removed from a direct conversation"
        )

    # --------------------------------------------------------
    # 2. Check current admin
    # --------------------------------------------------------

    admin = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not admin:
        raise ValueError(
            "You are not a member of this conversation"
        )

    if admin.role != ChatRole.ADMIN:
        raise ValueError(
            "Only admins can remove members"
        )

    # --------------------------------------------------------
    # 3. Don't remove yourself
    # --------------------------------------------------------

    if request.user_id == current_user.id:
        raise ValueError(
            "Admin cannot remove themselves"
        )

    # --------------------------------------------------------
    # 4. Find target member
    # --------------------------------------------------------

    member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == request.user_id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not member:
        raise ValueError(
            "User is not a member of this conversation"
        )

    # --------------------------------------------------------
    # 5. Soft remove
    # --------------------------------------------------------

    member.left_at = datetime.utcnow()

    db.commit()
    db.refresh(member)

    return member

def update_member_role(
    db: Session,
    current_user: User,
    conversation_id: int,
    user_id: int,
    request: UpdateMemberRoleRequest,
) -> ConversationMember:

    # --------------------------------------------------------
    # 1. Find conversation
    # --------------------------------------------------------

    conversation = db.get(
        Conversation,
        conversation_id,
    )

    if not conversation:
        raise ValueError(
            "Conversation not found"
        )

    if conversation.type.value == "direct":
        raise ValueError(
            "Direct conversations do not have roles"
        )

    # --------------------------------------------------------
    # 2. Check current admin
    # --------------------------------------------------------

    admin = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not admin:
        raise ValueError(
            "You are not a member of this conversation"
        )

    if admin.role != ChatRole.ADMIN:
        raise ValueError(
            "Only admins can change member roles"
        )

    # --------------------------------------------------------
    # 3. Find target member
    # --------------------------------------------------------

    member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not member:
        raise ValueError(
            "User is not a member of this conversation"
        )

    # --------------------------------------------------------
    # 4. Update role
    # --------------------------------------------------------

    member.role = request.role

    db.commit()
    db.refresh(member)

    return member

def leave_conversation(
    db: Session,
    current_user: User,
    conversation_id: int,
) -> None:

    conversation = db.get(
        Conversation,
        conversation_id,
    )

    if not conversation:
        raise ValueError(
            "Conversation not found"
        )

    if conversation.type == ConversationType.DIRECT:
        raise ValueError(
            "You cannot leave a direct conversation"
        )

    member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not member:
        raise ValueError(
            "You are not a member of this conversation"
        )

    # --------------------------------------------------------
    # If admin leaves, another admin must exist
    # --------------------------------------------------------

    if member.role == ChatRole.ADMIN:

        other_admin = db.scalar(
            select(ConversationMember).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.role == ChatRole.ADMIN,
                ConversationMember.user_id != current_user.id,
                ConversationMember.left_at.is_(None),
            )
        )

        if not other_admin:
            raise ValueError(
                "Transfer admin role before leaving the group"
            )

    # --------------------------------------------------------
    # Soft leave
    # --------------------------------------------------------

    member.left_at = datetime.utcnow()

    db.commit()

def transfer_admin(
    db: Session,
    current_user: User,
    conversation_id: int,
    request: TransferAdminRequest,
) -> ConversationMember:

    conversation = db.get(
        Conversation,
        conversation_id,
    )

    if not conversation:
        raise ValueError(
            "Conversation not found"
        )

    if conversation.type == ConversationType.DIRECT:
        raise ValueError(
            "Direct conversations do not have admins"
        )

    # Current user must be admin
    current_member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not current_member:
        raise ValueError(
            "You are not a member of this conversation"
        )

    if current_member.role != ChatRole.ADMIN:
        raise ValueError(
            "Only admins can transfer admin role"
        )

    # Find target
    target_member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == request.user_id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not target_member:
        raise ValueError(
            "Target user is not a member"
        )

    if target_member.user_id == current_user.id:
        raise ValueError(
            "You are already an admin"
        )

    # Transfer
    target_member.role = ChatRole.ADMIN
    current_member.role = ChatRole.MEMBER

    db.commit()
    db.refresh(target_member)

    return target_member
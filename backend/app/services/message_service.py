from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User

from app.models.message import (
    Message,
    MessageStatus as MessageStatusModel,
    MessageStatusType,
)

from app.models.block import Block

from app.models.conversation import (
    Conversation,
    ConversationMember,
    ConversationType,
)

from app.schemas.message import (
    SendMessageRequest,
    UpdateMessageRequest,
)

from app.services.connection_manager import manager


# ============================================================
# BLOCK CHECK
# ============================================================

def check_blocked_users(
    db: Session,
    sender_id: int,
    recipient_ids: list[int],
) -> None:

    if not recipient_ids:
        return

    blocked = db.scalar(
        select(Block).where(
            (
                (Block.blocker_id == sender_id)
                & Block.blocked_id.in_(recipient_ids)
            )
            |
            (
                Block.blocker_id.in_(recipient_ids)
                & (Block.blocked_id == sender_id)
            )
        )
    )

    if blocked:
        raise ValueError(
            "Messaging is not available between these users"
        )


# ============================================================
# SEND MESSAGE
# ============================================================

async def send_message(
    db: Session,
    current_user: User,
    conversation_id: int,
    request: SendMessageRequest,
) -> Message:

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
    # 2. Check sender membership
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # 3. Find all other active members
    # --------------------------------------------------------

    members = db.scalars(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id != current_user.id,
            ConversationMember.left_at.is_(None),
        )
    ).all()

    # ========================================================
    # 4. DIRECT CONVERSATION
    # ========================================================

    if conversation.type == ConversationType.DIRECT:

        recipient_ids = [
            member.user_id
            for member in members
        ]

        # ----------------------------------------------------
        # Direct chat:
        # If either user blocked the other, reject message.
        # ----------------------------------------------------

        check_blocked_users(
            db=db,
            sender_id=current_user.id,
            recipient_ids=recipient_ids,
        )

    # ========================================================
    # 5. GROUP CONVERSATION
    # ========================================================

    else:

        allowed_members = []

        for member in members:

            blocked = db.scalar(
                select(Block).where(
                    (
                        (Block.blocker_id == current_user.id)
                        & (Block.blocked_id == member.user_id)
                    )
                    |
                    (
                        (Block.blocker_id == member.user_id)
                        & (Block.blocked_id == current_user.id)
                    )
                )
            )

            # ------------------------------------------------
            # Blocked user does not receive the message
            # ------------------------------------------------

            if blocked:
                continue

            allowed_members.append(member)

        # Only non-blocked users are recipients
        members = allowed_members

        recipient_ids = [
            member.user_id
            for member in members
        ]

    # --------------------------------------------------------
    # 6. Create message
    # --------------------------------------------------------

    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=request.content,
        message_type=request.message_type,
        reply_to_message_id=request.reply_to_message_id,
        client_temp_id=request.client_temp_id,
    )

    db.add(message)

    # Need generated message ID
    db.flush()

    # --------------------------------------------------------
    # 7. Create SENT status for recipients
    # --------------------------------------------------------

    for recipient_id in recipient_ids:

        message_status = MessageStatusModel(
            message_id=message.id,
            user_id=recipient_id,
            status=MessageStatusType.SENT,
        )

        db.add(message_status)

    # --------------------------------------------------------
    # 8. Commit message + statuses
    # --------------------------------------------------------

    db.commit()
    db.refresh(message)

    # --------------------------------------------------------
    # 9. Prepare WebSocket payload
    # --------------------------------------------------------

    message_data = {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "content": message.content,
        "message_type": message.message_type.value,
        "reply_to_message_id": message.reply_to_message_id,
        "client_temp_id": message.client_temp_id,
        "is_deleted": message.is_deleted,
        "created_at": message.created_at.isoformat(),
    }

    # --------------------------------------------------------
    # 10. Deliver to connected recipients
    # --------------------------------------------------------

    for recipient_id in recipient_ids:

        delivered = await manager.send_to_user(
            user_id=recipient_id,
            data={
                "type": "new_message",
                "message": message_data,
            },
        )

        if delivered:

            message_status = db.scalar(
                select(MessageStatusModel).where(
                    MessageStatusModel.message_id == message.id,
                    MessageStatusModel.user_id == recipient_id,
                )
            )

            if message_status:

                message_status.status = (
                    MessageStatusType.DELIVERED
                )

            await manager.send_to_user(
                user_id=current_user.id,
                data={
                    "type": "message_delivered",
                    "message_id": message.id,
                    "user_id": recipient_id,
                },
            )

    # --------------------------------------------------------
    # 11. Save delivery status
    # --------------------------------------------------------

    db.commit()

    return message


# ============================================================
# GET CONVERSATION MESSAGES
# ============================================================

def get_conversation_messages(
    db: Session,
    current_user: User,
    conversation_id: int,
    limit: int = 50,
    before_message_id: int | None = None,
) -> list[Message]:

    # --------------------------------------------------------
    # 1. Check membership
    # --------------------------------------------------------

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
    # 2. Build query
    # --------------------------------------------------------

    query = select(Message).where(
        Message.conversation_id == conversation_id
    )

    # --------------------------------------------------------
    # 3. Cursor pagination
    # --------------------------------------------------------

    if before_message_id is not None:

        query = query.where(
            Message.id < before_message_id
        )

    # --------------------------------------------------------
    # 4. Newest first
    # --------------------------------------------------------

    query = (
        query
        .order_by(Message.id.desc())
        .limit(limit)
    )

    messages = db.scalars(query).all()

    # --------------------------------------------------------
    # 5. Return chronological order
    # --------------------------------------------------------

    return list(reversed(messages))


def get_message_receipts(
    db: Session,
    current_user: User,
    message_id: int,
) -> list[MessageStatusModel]:

    message = db.scalar(
        select(Message).where(
            Message.id == message_id
        )
    )

    if not message:
        raise ValueError(
            "Message not found"
        )

    member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == message.conversation_id,
            ConversationMember.user_id == current_user.id,
            ConversationMember.left_at.is_(None),
        )
    )

    if not member:
        raise ValueError(
            "You are not a member of this conversation"
        )

    if message.sender_id != current_user.id:
        raise ValueError(
            "Only the sender can view message receipts"
        )

    return db.scalars(
        select(MessageStatusModel).where(
            MessageStatusModel.message_id == message_id
        )
    ).all()


# ============================================================
# UPDATE MESSAGE
# ============================================================

def update_message(
    db: Session,
    current_user: User,
    message_id: int,
    request: UpdateMessageRequest,
) -> Message:

    # --------------------------------------------------------
    # 1. Find message
    # --------------------------------------------------------

    message = db.scalar(
        select(Message).where(
            Message.id == message_id
        )
    )

    if not message:
        raise ValueError(
            "Message not found"
        )

    # --------------------------------------------------------
    # 2. Only sender can edit
    # --------------------------------------------------------

    if message.sender_id != current_user.id:
        raise ValueError(
            "You can only edit your own messages"
        )

    # --------------------------------------------------------
    # 3. Deleted messages cannot be edited
    # --------------------------------------------------------

    if message.is_deleted:
        raise ValueError(
            "Deleted messages cannot be edited"
        )

    # --------------------------------------------------------
    # 4. Update content
    # --------------------------------------------------------

    message.content = request.content

    db.commit()
    db.refresh(message)

    return message


# ============================================================
# DELETE MESSAGE
# ============================================================

def delete_message(
    db: Session,
    current_user: User,
    message_id: int,
) -> Message:

    # --------------------------------------------------------
    # 1. Find message
    # --------------------------------------------------------

    message = db.scalar(
        select(Message).where(
            Message.id == message_id
        )
    )

    if not message:
        raise ValueError(
            "Message not found"
        )

    # --------------------------------------------------------
    # 2. Only sender can delete
    # --------------------------------------------------------

    if message.sender_id != current_user.id:
        raise ValueError(
            "You can only delete your own messages"
        )

    # --------------------------------------------------------
    # 3. Already deleted
    # --------------------------------------------------------

    if message.is_deleted:
        raise ValueError(
            "Message is already deleted"
        )

    # --------------------------------------------------------
    # 4. Soft delete
    # --------------------------------------------------------

    message.is_deleted = True
    message.content = None

    db.commit()
    db.refresh(message)

    return message


# ============================================================
# UPDATE MESSAGE STATUS
# ============================================================

def update_message_status(
    db: Session,
    current_user: User,
    message_id: int,
    new_status: MessageStatusType,
) -> MessageStatusModel:

    # --------------------------------------------------------
    # 1. Find message
    # --------------------------------------------------------

    message = db.scalar(
        select(Message).where(
            Message.id == message_id
        )
    )

    if not message:
        raise ValueError(
            "Message not found"
        )

    # --------------------------------------------------------
    # 2. Check conversation membership
    # --------------------------------------------------------

    member = db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id
            == message.conversation_id,

            ConversationMember.user_id
            == current_user.id,

            ConversationMember.left_at.is_(None),
        )
    )

    if not member:
        raise ValueError(
            "You are not a member of this conversation"
        )

    # --------------------------------------------------------
    # 3. Sender cannot update recipient status
    # --------------------------------------------------------

    if message.sender_id == current_user.id:
        raise ValueError(
            "Sender cannot update message delivery status"
        )

    # --------------------------------------------------------
    # 4. Find existing status
    # --------------------------------------------------------

    message_status = db.scalar(
        select(MessageStatusModel).where(
            MessageStatusModel.message_id == message_id,
            MessageStatusModel.user_id == current_user.id,
        )
    )

    # --------------------------------------------------------
    # 5. No existing status
    # --------------------------------------------------------

    if not message_status:

        if new_status == MessageStatusType.SENT:
            raise ValueError(
                "Recipient cannot set message status to SENT"
            )

        message_status = MessageStatusModel(
            message_id=message_id,
            user_id=current_user.id,
            status=new_status,
        )

        db.add(message_status)

    # --------------------------------------------------------
    # 6. Existing status
    # --------------------------------------------------------

    else:

        current_status = message_status.status

        if (
            current_status == MessageStatusType.SENT
            and new_status == MessageStatusType.DELIVERED
        ):
            message_status.status = new_status

        elif (
            current_status == MessageStatusType.SENT
            and new_status == MessageStatusType.READ
        ):
            message_status.status = new_status

        elif (
            current_status == MessageStatusType.DELIVERED
            and new_status == MessageStatusType.READ
        ):
            message_status.status = new_status

        elif current_status == new_status:
            pass

        else:
            raise ValueError(
                f"Invalid status transition: "
                f"{current_status.value} -> "
                f"{new_status.value}"
            )

    # --------------------------------------------------------
    # 7. Save
    # --------------------------------------------------------

    db.commit()
    db.refresh(message_status)

    return message_status


# ============================================================
# MARK CONVERSATION AS READ
# ============================================================

async def mark_conversation_as_read(
    db: Session,
    current_user: User,
    conversation_id: int,
    message_id: int,
) -> ConversationMember:

    # --------------------------------------------------------
    # 1. Check membership
    # --------------------------------------------------------

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
    # 2. Find message
    # --------------------------------------------------------

    message = db.scalar(
        select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conversation_id,
        )
    )

    if not message:
        raise ValueError(
            "Message not found in this conversation"
        )

    # --------------------------------------------------------
    # 3. Don't move read position backwards
    # --------------------------------------------------------

    if (
        member.last_read_message_id is not None
        and message.id < member.last_read_message_id
    ):
        return member

    # --------------------------------------------------------
    # 4. Update read position
    # --------------------------------------------------------

    member.last_read_message_id = message.id

    # --------------------------------------------------------
    # 5. Mark statuses as READ
    # --------------------------------------------------------

    statuses = db.scalars(
        select(MessageStatusModel)
        .join(
            Message,
            Message.id == MessageStatusModel.message_id,
        )
        .where(
            MessageStatusModel.user_id == current_user.id,
            Message.conversation_id == conversation_id,
            Message.id <= message.id,
        )
    ).all()

    for message_status in statuses:

        if message_status.status in (
            MessageStatusType.SENT,
            MessageStatusType.DELIVERED,
        ):
            message_status.status = MessageStatusType.READ

    # --------------------------------------------------------
    # 6. Save
    # --------------------------------------------------------

    db.commit()
    db.refresh(member)

    # --------------------------------------------------------
    # 7. Notify sender
    # --------------------------------------------------------

    if message.sender_id != current_user.id:

        await manager.send_to_user(
            user_id=message.sender_id,
            data={
                "type": "message_read",
                "message_id": message.id,
                "user_id": current_user.id,
            },
        )

    return member

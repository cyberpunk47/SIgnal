from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.block import Block
from app.models.user import User


def block_user(
    db: Session,
    current_user: User,
    target_user_id: int,
) -> Block:

    # Cannot block yourself
    if current_user.id == target_user_id:
        raise ValueError(
            "You cannot block yourself"
        )

    # Target must exist
    target_user = db.get(
        User,
        target_user_id,
    )

    if not target_user:
        raise ValueError(
            "User not found"
        )

    # Check existing block
    existing_block = db.scalar(
        select(Block).where(
            Block.blocker_id == current_user.id,
            Block.blocked_id == target_user_id,
        )
    )

    if existing_block:
        # Idempotent behavior:
        # already blocked = simply return existing record
        return existing_block

    block = Block(
        blocker_id=current_user.id,
        blocked_id=target_user_id,
    )

    db.add(block)
    db.commit()
    db.refresh(block)

    return block


def unblock_user(
    db: Session,
    current_user: User,
    target_user_id: int,
) -> None:

    block = db.scalar(
        select(Block).where(
            Block.blocker_id == current_user.id,
            Block.blocked_id == target_user_id,
        )
    )

    if not block:
        raise ValueError(
            "User is not blocked"
        )

    db.delete(block)
    db.commit()


def is_blocked(
    db: Session,
    blocker_id: int,
    blocked_id: int,
) -> bool:

    block = db.scalar(
        select(Block).where(
            Block.blocker_id == blocker_id,
            Block.blocked_id == blocked_id,
        )
    )

    return block is not None
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contact import Contact
from app.models.user import User
from app.schemas.contact import (
    AddContactRequest,
    UpdateContactRequest,
)


def add_contact(
    db: Session,
    current_user: User,
    request: AddContactRequest,
) -> Contact:

    # Don't allow adding yourself
    if current_user.id == request.contact_user_id:
        raise ValueError(
            "You cannot add yourself as a contact"
        )

    # Check that target user exists
    target_user = db.scalar(
        select(User).where(
            User.id == request.contact_user_id
        )
    )

    if not target_user:
        raise ValueError(
            "User not found"
        )

    # Check if contact already exists
    existing_contact = db.scalar(
        select(Contact).where(
            Contact.owner_id == current_user.id,
            Contact.contact_user_id
            == request.contact_user_id,
        )
    )

    if existing_contact:
        raise ValueError(
            "Contact already exists"
        )

    # Create contact
    contact = Contact(
        owner_id=current_user.id,
        contact_user_id=request.contact_user_id,
    )

    db.add(contact)
    db.commit()
    db.refresh(contact)

    return contact


def get_contacts(
    db: Session,
    current_user: User,
) -> list[Contact]:

    contacts = db.scalars(
        select(Contact).where(
            Contact.owner_id == current_user.id
        )
    ).all()

    return list(contacts)


def update_contact(
    db: Session,
    current_user: User,
    contact_id: int,
    request: UpdateContactRequest,
) -> Contact:

    contact = db.scalar(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.owner_id == current_user.id,
        )
    )

    if not contact:
        raise ValueError(
            "Contact not found"
        )

    contact.nickname = request.nickname

    db.commit()
    db.refresh(contact)

    return contact


def delete_contact(
    db: Session,
    current_user: User,
    contact_id: int,
) -> None:

    contact = db.scalar(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.owner_id == current_user.id,
        )
    )

    if not contact:
        raise ValueError(
            "Contact not found"
        )

    db.delete(contact)
    db.commit()
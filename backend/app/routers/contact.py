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

from app.schemas.contact import (
    AddContactRequest,
    UpdateContactRequest,
    ContactResponse,
)

from app.services.contact_service import (
    add_contact,
    get_contacts,
    update_contact,
    delete_contact,
)


router = APIRouter(
    prefix="/contacts",
    tags=["Contacts"],
)

@router.post(
    "",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contact(
    request: AddContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return add_contact(
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
    response_model=list[ContactResponse],
)
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    return get_contacts(
        db=db,
        current_user=current_user,
    )

@router.patch(
    "/{contact_id}",
    response_model=ContactResponse,
)
def edit_contact(
    contact_id: int,
    request: UpdateContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        return update_contact(
            db=db,
            current_user=current_user,
            contact_id=contact_id,
            request=request,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    try:

        delete_contact(
            db=db,
            current_user=current_user,
            contact_id=contact_id,
        )

    except ValueError as e:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.connection_manager import manager


router = APIRouter(
    tags=["WebSocket"],
)


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # 1. Find user
    # --------------------------------------------------------

    user = db.get(User, user_id)

    if not user:
        await websocket.close(code=1008)
        return

    # --------------------------------------------------------
    # 2. Connect
    # --------------------------------------------------------

    await manager.connect(
        user_id=user_id,
        websocket=websocket,
    )

    # --------------------------------------------------------
    # 3. Mark online
    # --------------------------------------------------------

    user.is_online = True
    user.last_seen_at = None

    db.commit()

    # --------------------------------------------------------
    # 4. Notify everyone
    # --------------------------------------------------------

    await manager.broadcast(
        {
            "type": "user_online",
            "user_id": user_id,
        },
        exclude_user_id=user_id,
    )

    try:

        while True:

            data = await websocket.receive_json()

            if data.get("type") == "typing":

                conversation_id = data.get("conversation_id")
                is_typing = data.get(
                    "is_typing",
                        False,
                    )

                await manager.broadcast(
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "is_typing": is_typing,
                    },
                    exclude_user_id=user_id,
                )

    except WebSocketDisconnect:

        # ----------------------------------------------------
        # 5. Disconnect
        # ----------------------------------------------------

        manager.disconnect(user_id)

        user.is_online = False
        user.last_seen_at = datetime.now(timezone.utc)

        db.commit()

        # ----------------------------------------------------
        # 6. Notify everyone
        # ----------------------------------------------------

        await manager.broadcast(
            {
                "type": "user_offline",
                "user_id": user_id,
                "last_seen_at": user.last_seen_at.isoformat() if user.last_seen_at else None,
            }
        )
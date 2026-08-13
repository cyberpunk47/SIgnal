from fastapi import WebSocket


class ConnectionManager:

    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}

    async def connect(
        self,
        user_id: int,
        websocket: WebSocket,
    ):
        await websocket.accept()

        self.active_connections[user_id] = websocket

    def disconnect(
        self,
        user_id: int,
    ):
        self.active_connections.pop(
            user_id,
            None,
        )

    def is_online(
        self,
        user_id: int,
    ) -> bool:
        return user_id in self.active_connections

    async def send_to_user(
        self,
        user_id: int,
        data: dict,
    ) -> bool:

        websocket = self.active_connections.get(
            user_id
        )

        # User isn't connected
        if not websocket:
            return False

        try:

            await websocket.send_json(data)

            return True

        except Exception:

            # Socket is probably dead.
            self.disconnect(user_id)

            return False

    async def broadcast(
        self,
        data: dict,
        exclude_user_id: int | None = None,
    ):

        disconnected_users = []

        for user_id, websocket in self.active_connections.items():

            if user_id == exclude_user_id:
                continue

            try:

                await websocket.send_json(data)

            except Exception:

                disconnected_users.append(user_id)

        for user_id in disconnected_users:
            self.disconnect(user_id)
manager = ConnectionManager()
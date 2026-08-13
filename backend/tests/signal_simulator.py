import asyncio
import json
import time
from datetime import datetime
import random 
import httpx
import websockets


BASE_URL = "http://127.0.0.1:8000"
WS_BASE_URL = "ws://127.0.0.1:8000"


# ============================================================
# TEST USERS
# ============================================================
suffix = random.randint(100000, 999999)
import random

suffix = random.randint(100000, 999999)

USERS = {
    "yasir": {
        "phone": f"919999{suffix}01",
        "username": f"yasir_test_{suffix}",
        "display_name": "Yasir Test",
    },

    "ali": {
        "phone": f"919999{suffix}02",
        "username": f"ali_test_{suffix}",
        "display_name": "Ali Test",
    },

    "ahmed": {
        "phone": f"919999{suffix}03",
        "username": f"ahmed_test_{suffix}",
        "display_name": "Ahmed Test",
    },
}

OTP = "123456"


# ============================================================
# TEST STATE
# ============================================================

client = httpx.AsyncClient(
    base_url=BASE_URL,
    timeout=10.0,
)

state = {}

results = []


# ============================================================
# OUTPUT
# ============================================================

def passed(name):
    print(f"✓ PASS  {name}")
    results.append(True)


def failed(name, details=""):
    print(f"✗ FAIL  {name}")

    if details:
        print(f"        {details}")

    results.append(False)


def section(name):
    print()
    print("=" * 60)
    print(name)
    print("=" * 60)


# ============================================================
# HTTP HELPER
# ============================================================

async def request(
    method,
    path,
    token=None,
    **kwargs,
):

    headers = kwargs.pop("headers", {})

    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = await client.request(
        method,
        path,
        headers=headers,
        **kwargs,
    )

    return response


# ============================================================
# REGISTER
# ============================================================

async def register_user(name, data):

    response = await request(
        "POST",
        "/auth/register",
        json={
            "phone_number": data["phone"],
            "username": data["username"],
            "display_name": data["display_name"],
        },
    )

    if response.status_code == 201:

        body = response.json()

        state[name] = {
            "phone": data["phone"],
            "token": None,
            "id": body["id"],
            "websocket": None,
            "events": [],
        }

        passed(
            f"{name} registered "
            f"(id={body['id']})"
        )

        return True

    # Already registered is useful during repeated tests.
    if response.status_code == 400:

        print(
            f"! {name} already registered; "
            f"will login instead"
        )

        return True

    failed(
        f"{name} registration",
        f"{response.status_code}: {response.text}",
    )

    return False


# ============================================================
# REQUEST OTP
# ============================================================

async def request_login_otp(name):

    phone = USERS[name]["phone"]

    response = await request(
        "POST",
        "/auth/login",
        json={
            "phone_number": phone,
        },
    )

    if response.status_code == 200:

        passed(f"{name} requested OTP")

        return True

    failed(
        f"{name} request OTP",
        f"{response.status_code}: {response.text}",
    )

    return False


# ============================================================
# VERIFY OTP
# ============================================================

async def verify_otp(name):

    phone = USERS[name]["phone"]

    response = await request(
        "POST",
        "/auth/verify",
        json={
            "phone_number": phone,
            "otp": OTP,
        },
    )

    if response.status_code != 200:

        failed(
            f"{name} OTP verification",
            f"{response.status_code}: {response.text}",
        )

        return False

    body = response.json()

    token = body.get("token")

    if not token:

        failed(
            f"{name} OTP verification",
            "No token returned",
        )

        return False

    state[name]["token"] = token

    # Get the actual database user ID.
    me = await request(
        "GET",
        "/auth/me",
        token=token,
    )

    if me.status_code != 200:

        failed(
            f"{name} /auth/me",
            f"{me.status_code}: {me.text}",
        )

        return False

    me_body = me.json()

    state[name]["id"] = me_body["id"]

    passed(
        f"{name} login verified "
        f"(id={state[name]['id']})"
    )

    return True


# ============================================================
# AUTH TEST
# ============================================================

async def authenticate_user(name):

    # Register first.
    await register_user(
        name,
        USERS[name],
    )

    # Login works for both new and existing users.
    if not await request_login_otp(name):
        return False

    return await verify_otp(name)


# ============================================================
# GET CONTACTS
# ============================================================

async def get_contacts(name):

    token = state[name]["token"]

    response = await request(
        "GET",
        "/contacts",
        token=token,
    )

    if response.status_code != 200:

        failed(
            f"{name} get contacts",
            f"{response.status_code}: {response.text}",
        )

        return []

    return response.json()


# ============================================================
# ADD CONTACT
# ============================================================

async def add_contact(
    owner,
    target,
):

    owner_token = state[owner]["token"]
    target_id = state[target]["id"]

    response = await request(
        "POST",
        "/contacts",
        token=owner_token,
        json={
            "contact_user_id": target_id,
        },
    )

    if response.status_code == 201:

        passed(
            f"{owner} added {target} as contact"
        )

        return True

    # Useful when rerunning the script.
    if response.status_code == 400:

        body = response.text

        if "already exists" in body.lower():

            print(
                f"! {owner} already has {target} "
                f"as contact"
            )

            return True

    failed(
        f"{owner} add {target}",
        f"{response.status_code}: {response.text}",
    )

    return False


# ============================================================
# CONVERSATION
# ============================================================

async def create_direct_conversation(
    owner,
    target,
):

    token = state[owner]["token"]

    response = await request(
        "POST",
        "/conversations/direct",
        token=token,
        json={
            "user_id": state[target]["id"],
        },
    )

    if response.status_code not in (200, 201):

        failed(
            f"{owner} create conversation with {target}",
            f"{response.status_code}: {response.text}",
        )

        return None

    body = response.json()

    conversation_id = body["id"]

    passed(
        f"conversation {conversation_id}: "
        f"{owner} ↔ {target}"
    )

    return conversation_id


# ============================================================
# WEBSOCKET LISTENER
# ============================================================

async def websocket_listener(
    name,
    websocket,
):

    try:

        async for raw_message in websocket:

            timestamp = datetime.now().isoformat(
                timespec="seconds"
            )

            try:
                data = json.loads(raw_message)
            except json.JSONDecodeError:
                data = raw_message

            state[name]["events"].append(data)

            print(
                f"  [{timestamp}] "
                f"{name} received: "
                f"{data}"
            )

    except websockets.exceptions.ConnectionClosed:
        pass

    except Exception as e:

        print(
            f"  [{name}] WebSocket listener error: "
            f"{e}"
        )


# ============================================================
# CONNECT WEBSOCKET
# ============================================================

async def connect_websocket(name):

    user_id = state[name]["id"]

    url = f"{WS_BASE_URL}/ws/{user_id}"

    try:

        websocket = await websockets.connect(url)

        state[name]["websocket"] = websocket

        asyncio.create_task(
            websocket_listener(
                name,
                websocket,
            )
        )

        passed(
            f"{name} WebSocket connected "
            f"(/ws/{user_id})"
        )

        return websocket

    except Exception as e:

        failed(
            f"{name} WebSocket connection",
            str(e),
        )

        return None


# ============================================================
# TYPING
# ============================================================

async def send_typing(
    name,
    conversation_id,
    is_typing,
):

    websocket = state[name]["websocket"]

    if websocket is None:
        failed(
            f"{name} typing",
            "WebSocket not connected",
        )

        return

    await websocket.send(
        json.dumps(
            {
                "type": "typing",
                "conversation_id": conversation_id,
                "is_typing": is_typing,
            }
        )
    )

    action = (
        "typing"
        if is_typing
        else "stopped typing"
    )

    passed(
        f"{name} → {action}"
    )


# ============================================================
# SEND MESSAGE
# ============================================================

async def send_message(
    sender,
    conversation_id,
    recipient,
):

    token = state[sender]["token"]

    timestamp = datetime.now().isoformat(
        timespec="seconds"
    )

    content = (
        f"Hello {recipient.capitalize()} "
        f"— {timestamp}"
    )

    response = await request(
        "POST",
        f"/conversations/{conversation_id}/messages",
        token=token,
        json={
            "content": content,
            "message_type": "text",
            "reply_to_message_id": None,
            "client_temp_id": (
                f"sim-{sender}-{int(time.time() * 1000)}"
            ),
        },
    )

    if response.status_code not in (200, 201):

        failed(
            f"{sender} send message",
            f"{response.status_code}: {response.text}",
        )

        return None

    body = response.json()

    passed(
        f"{sender} → {recipient}: "
        f'"{content}"'
    )

    return body


# ============================================================
# MARK READ
# ============================================================

async def mark_read(
    name,
    conversation_id,
    message_id,
):

    token = state[name]["token"]

    response = await request(
        "POST",
        f"/conversations/{conversation_id}/read",
        token=token,
        json={
            "message_id": message_id,
        },
    )

    if response.status_code not in (200, 201):

        failed(
            f"{name} mark read",
            f"{response.status_code}: {response.text}",
        )

        return False

    passed(
        f"{name} marked message {message_id} READ"
    )

    return True


# ============================================================
# DISCONNECT
# ============================================================

async def disconnect_websocket(name):

    websocket = state[name]["websocket"]

    if websocket is None:
        return

    await websocket.close()

    state[name]["websocket"] = None

    passed(
        f"{name} WebSocket disconnected"
    )


# ============================================================
# PRESENCE CHECK
# ============================================================

async def check_presence(
    viewer,
    target,
    expected_online,
):

    token = state[viewer]["token"]

    response = await request(
        "GET",
        "/auth/me",
        token=token,
    )

    if response.status_code != 200:

        failed(
            f"{viewer} presence request",
            response.text,
        )

        return

    # We don't assume /auth/me exposes
    # another user's presence.
    #
    # Therefore presence is primarily
    # validated through WebSocket events.

    expected = (
        "online"
        if expected_online
        else "offline"
    )

    print(
        f"! Presence check for {target}: "
        f"expecting {expected} event"
    )


# ============================================================
# MAIN TEST
# ============================================================

async def main():

    print()
    print("============================================================")
    print(" SIGNAL LOCAL MULTI-USER TEST")
    print("============================================================")
    print()

    # --------------------------------------------------------
    # AUTH
    # --------------------------------------------------------

    section("AUTHENTICATION")

    for name in USERS:

        await authenticate_user(name)

    # --------------------------------------------------------
    # CONTACTS
    # --------------------------------------------------------

    section("CONTACTS")

    await add_contact(
        "yasir",
        "ali",
    )

    await add_contact(
        "ali",
        "yasir",
    )

    await add_contact(
        "yasir",
        "ahmed",
    )

    await add_contact(
        "ahmed",
        "yasir",
    )

    # --------------------------------------------------------
    # CONVERSATIONS
    # --------------------------------------------------------

    section("DIRECT CONVERSATIONS")

    yasir_alice = await create_direct_conversation(
        "yasir",
        "ali",
    )

    yasir_bob = await create_direct_conversation(
        "yasir",
        "ahmed",
    )

    # --------------------------------------------------------
    # WEBSOCKETS
    # --------------------------------------------------------

    section("WEBSOCKETS / PRESENCE")

    await connect_websocket("yasir")

    await asyncio.sleep(0.5)

    await connect_websocket("ali")

    await asyncio.sleep(0.5)

    await connect_websocket("ahmed")

    await asyncio.sleep(1)

    # --------------------------------------------------------
    # TYPING
    # --------------------------------------------------------

    section("TYPING")

    if yasir_alice:

        await send_typing(
            "yasir",
            yasir_alice,
            True,
        )

        await asyncio.sleep(2)

        await send_typing(
            "yasir",
            yasir_alice,
            False,
        )

        await asyncio.sleep(1)

    # --------------------------------------------------------
    # MESSAGE YASIR → ALICE
    # --------------------------------------------------------

    section("MESSAGING")

    if yasir_alice:

        message = await send_message(
            "yasir",
            yasir_alice,
            "ali",
        )

        await asyncio.sleep(1)

        if message:

            await mark_read(
                "ali",
                yasir_alice,
                message["id"],
            )

            await asyncio.sleep(1)

    # --------------------------------------------------------
    # MESSAGE ALICE → YASIR
    # --------------------------------------------------------

    if yasir_alice:

        message = await send_message(
            "ali",
            yasir_alice,
            "yasir",
        )

        await asyncio.sleep(1)

        if message:

            await mark_read(
                "yasir",
                yasir_alice,
                message["id"],
            )

            await asyncio.sleep(1)

    # --------------------------------------------------------
    # MESSAGE BOB → YASIR
    # --------------------------------------------------------

    if yasir_bob:

        message = await send_message(
            "ahmed",
            yasir_bob,
            "yasir",
        )

        await asyncio.sleep(1)

        if message:

            await mark_read(
                "yasir",
                yasir_bob,
                message["id"],
            )

            await asyncio.sleep(1)

    # --------------------------------------------------------
    # OFFLINE / LAST SEEN
    # --------------------------------------------------------

    section("OFFLINE / LAST SEEN")

    await disconnect_websocket("ahmed")

    # Give server time to execute
    # disconnect lifecycle.
    await asyncio.sleep(1)

    print(
        "! Bob should now be offline and "
        "last_seen_at should be updated."
    )

    # --------------------------------------------------------
    # KEEP ALICE/YASIR ALIVE
    # --------------------------------------------------------

    section("FINAL STATE")

    print()

    for name in USERS:

        print(
            f"{name}: "
            f"id={state[name]['id']} "
            f"token={'YES' if state[name]['token'] else 'NO'} "
            f"ws={'CONNECTED' if state[name]['websocket'] else 'CLOSED'}"
        )

    # --------------------------------------------------------
    # CLEANUP
    # --------------------------------------------------------

    await disconnect_websocket("yasir")
    await disconnect_websocket("ali")

    await client.aclose()

    # --------------------------------------------------------
    # RESULTS
    # --------------------------------------------------------

    section("RESULT")

    total = len(results)
    passed_count = sum(results)
    failed_count = total - passed_count

    print(
        f"PASSED: {passed_count}"
    )

    print(
        f"FAILED: {failed_count}"
    )

    print()

    if failed_count == 0:
        print("✓ ALL AUTOMATED TESTS PASSED")
    else:
        print("✗ SOME TESTS FAILED")


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    try:
        asyncio.run(main())

    except KeyboardInterrupt:

        print()
        print("Test interrupted.")
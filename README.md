# Signal Clone

Secure messaging platform assignment built with Next.js, FastAPI, SQLite, and WebSockets. The app recreates Signal-style onboarding, conversation list, direct chats, group chats, message persistence, read/delivery receipts, typing indicators, contacts, and admin controls. End-to-end encryption is mocked/simulated.

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, Zustand, Axios, lucide-react
- Backend: FastAPI, SQLAlchemy, SQLite, WebSockets
- Database: `backend/signal.db`
- Auth: mocked OTP (`123456`) with bearer sessions

## Run Locally

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. FastAPI docs are at `http://127.0.0.1:8000/docs`.

## Architecture

- `frontend/app/auth`: mocked phone/OTP onboarding and registration.
- `frontend/app/chat`: authenticated Signal-style shell, conversation list, and chat pane.
- `frontend/components/chat`: message bubbles, read receipts, typing UI, group info entrypoint.
- `frontend/components/sidebar`: search, contacts, direct chat creation, group creation.
- `backend/app/routers`: REST and WebSocket routes.
- `backend/app/services`: auth, contacts, conversations, messages, blocking, and presence logic.
- `backend/app/models`: SQLAlchemy schema.

## Database Schema

- `users`: profile, username, phone, avatar, online/last-seen state.
- `sessions`: bearer tokens with 30-minute expiry.
- `contacts`: owner-to-contact relationships and nicknames.
- `conversations`: direct/group metadata.
- `conversation_members`: group/direct membership, role, muted state, last read message.
- `messages`: persisted message records with client temp IDs for optimistic sends.
- `message_status`: per-recipient sent/delivered/read state.
- `blocks`: user blocking relationships.

## API Overview

- `POST /auth/register`, `/auth/login`, `/auth/verify`, `GET /auth/me`
- `GET/POST/PATCH/DELETE /contacts`
- `GET /conversations`, `POST /conversations/direct`, `POST /conversations/group`
- `POST/DELETE /conversations/{id}/members`
- `PATCH /conversations/{id}/members/{user_id}/role`
- `POST /conversations/{id}/leave`, `POST /conversations/{id}/transfer-admin`
- `GET/POST /conversations/{id}/messages`
- `GET /conversations/messages/{message_id}/receipts`
- `PATCH /conversations/messages/{message_id}/status`
- `POST /conversations/{id}/read`
- `WS /ws/{user_id}` for messages, presence, typing, delivered, and read events

## Assignment Notes

- OTP is always `123456`.
- Group admins can add/remove members and promote/demote roles from the visible Group Info modal.
- Sent-message ticks are brighter; clicking them opens Message Info showing who has sent/delivered/read the message.
- Real cryptographic E2EE is intentionally mocked for assignment scope.

## Bugs and Key Trade Offs
- As limited time the security of this application is not consistent and you might experience.
- The Users will be Shown as offline instead of Last seen as i had hard time fixing the Web Socket Bug so i made the Web Socket as the ultimate source of truth for the Online and Offline
- You might notice the converstions are not arranged properly as the Groups are ranked as 1 instead of the Signal feature where the messages which came first or the last interacted messaged should have been on top 
- The design and the UX is the only thing which i took as trade off while fully implementing the backend to race against the time constraint 
- Also another thing is the offline status will be shown as Offline until the user logs in and after that if he logs out then his last seen is Changed from Offline to Last seen at 10:10 Am like this . So its a bug 

- Another thing regarding the Last Seen is (Currently only one User is only able to see Online Status as i said earlier i have hard time finding this bug)
- Sessions are also bugged so if you do a refresh you will be logged out 
## Working Part
- Login/ Logout Working 
- Message Editor and deletion Working 
- Admin controls working 
- Demotion and promotion to admin working 
- Typing Indicator is working but not seen by the user as it is being tested out it in console
- Leave group and Remove is also working
- Read Reciepts are working 

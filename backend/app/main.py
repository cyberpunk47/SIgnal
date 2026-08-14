from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine

from app.models import (
    User,
    Contact,
    Conversation,
    ConversationMember,
    Message,
    MessageStatus,
    Session,
    Attachment,
    MessageReaction,
)

from app.models.block import Block

from app.routers.auth import router as auth_router
from app.routers.contact import router as contact_router
from app.routers.conversation import router as conversation_router
from app.routers.message import router as message_router
from app.routers.websocket import router as websocket_router
from app.routers.block import router as block_router


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Signal Clone",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://signal-eta-six.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Routers
# ============================================================

app.include_router(auth_router)
app.include_router(contact_router)
app.include_router(conversation_router)
app.include_router(message_router)
app.include_router(websocket_router)
app.include_router(block_router)


@app.get("/")
def root():
    return {
        "message": "Signal API is running"
    }
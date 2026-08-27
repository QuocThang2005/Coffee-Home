import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..menu import load_menu
from ..chatbot import chat_reply_stream
from ._schemas import ChatIn

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True, "service": "coffee-backend"}


def _sse_generator(messages):
    """Generate SSE stream from chat_reply_stream."""
    yield "data: {}\n\n"
    for event in chat_reply_stream(messages):
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat")
def chat(body: ChatIn):
    """Nhan conversation history, tra ve SSE stream tu Gemini AI."""
    return StreamingResponse(
        _sse_generator(body.messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/drinks")
def drinks():
    return load_menu()

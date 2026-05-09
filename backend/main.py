"""
VoiceBot FastAPI Backend
========================
Production-ready async API for multilingual voice bot.
Handles: Audio upload → Whisper STT → GPT-4o-mini → TTS → Audio response
"""

import os
import base64
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

from ai_services import transcribe_audio, generate_response, text_to_speech, extract_user_name
from conversation import conversation_manager
from logger import append_log, read_logs, clear_logs


# ─────────────────────── APP LIFECYCLE ───────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print(">>> VoiceBot Backend starting...")
    print(">>> STT (Google Web Speech) ready")
    print(">>> LLM (GPT4Free) ready")
    print(">>> TTS (gTTS) ready")
    yield
    print("<<< VoiceBot Backend shutting down...")
    conversation_manager.cleanup_stale_sessions(max_age_seconds=0)


app = FastAPI(
    title="Vaani VoiceBot API",
    description="Multilingual Voice Bot API - Hindi, Telugu, English code-mixing",
    version="1.0.0",
    lifespan=lifespan,
)

# ─────────────────────── CORS ───────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────── MODELS ───────────────────────
class TextChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    text: str
    audio_base64: Optional[str] = None
    session_id: str
    user_name: Optional[str] = None
    language_detected: Optional[str] = None


# ─────────────────────── HEALTH CHECK ───────────────────────
@app.get("/")
async def health_check():
    return {
        "status": "online",
        "service": "Vaani VoiceBot API",
        "version": "1.0.0",
        "endpoints": {
            "voice_chat": "POST /api/voice-chat",
            "text_chat": "POST /api/text-chat",
            "logs": "GET /api/logs",
            "session": "POST /api/session",
        },
    }


# ─────────────────────── SESSION ───────────────────────
@app.post("/api/session")
async def create_session():
    """Create a new conversation session."""
    session_id = conversation_manager.create_session()
    return {"session_id": session_id}


# ─────────────────────── VOICE CHAT (Main Pipeline) ───────────────────────
@app.post("/api/voice-chat", response_model=ChatResponse)
async def voice_chat(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
):
    """
    Main voice chat pipeline:
    1. Receive audio blob from frontend
    2. Transcribe with Whisper (STT)
    3. Generate response with GPT-4o-mini (LLM)
    4. Convert response to speech (TTS)
    5. Return text + audio
    """
    # Validate session
    session_id = conversation_manager.get_or_create_session(session_id)

    # ── Step 1: Read audio bytes ──
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            raise HTTPException(status_code=400, detail="Audio file too small or empty")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read audio: {str(e)}")

    # ── Step 2: Whisper STT ──
    try:
        transcription = await transcribe_audio(audio_bytes, filename=audio.filename or "audio.webm")
        user_text = transcription["text"]
        language = transcription.get("language", "unknown")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not user_text or user_text.strip() == "":
        raise HTTPException(status_code=400, detail="Could not transcribe audio — no speech detected")

    # ── Step 3: Extract name if not known ──
    current_name = conversation_manager.get_user_name(session_id)
    if not current_name:
        extracted_name = await extract_user_name(user_text)
        if extracted_name:
            conversation_manager.set_user_name(session_id, extracted_name)
            current_name = extracted_name

    # ── Step 4: Log user message ──
    await append_log(session_id, "user", user_text, language_detected=language)
    conversation_manager.add_message(session_id, "user", user_text)

    # ── Step 5: Generate LLM response ──
    try:
        history = conversation_manager.get_history(session_id)
        # Pass history without the last message (we add it inside generate_response)
        bot_text = await generate_response(user_text, history[:-1], user_name=current_name)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── Step 6: Log bot response ──
    await append_log(session_id, "assistant", bot_text)
    conversation_manager.add_message(session_id, "assistant", bot_text)

    # ── Step 7: Generate TTS audio ──
    audio_base64 = None
    try:
        tts_bytes = await text_to_speech(bot_text)
        audio_base64 = base64.b64encode(tts_bytes).decode("utf-8")
    except RuntimeError:
        # TTS failure is non-critical — still return text
        pass

    return ChatResponse(
        text=bot_text,
        audio_base64=audio_base64,
        session_id=session_id,
        user_name=current_name,
        language_detected=language,
    )


# ─────────────────────── TEXT CHAT (Fallback) ───────────────────────
@app.post("/api/text-chat", response_model=ChatResponse)
async def text_chat(request: TextChatRequest):
    """
    Text-based chat endpoint (fallback for when mic is unavailable).
    """
    session_id = conversation_manager.get_or_create_session(request.session_id)

    user_text = request.message.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Extract name if not known
    current_name = conversation_manager.get_user_name(session_id)
    if not current_name:
        extracted_name = await extract_user_name(user_text)
        if extracted_name:
            conversation_manager.set_user_name(session_id, extracted_name)
            current_name = extracted_name

    # Log user message
    await append_log(session_id, "user", user_text)
    conversation_manager.add_message(session_id, "user", user_text)

    # Generate response
    try:
        history = conversation_manager.get_history(session_id)
        bot_text = await generate_response(user_text, history[:-1], user_name=current_name)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Log bot response
    await append_log(session_id, "assistant", bot_text)
    conversation_manager.add_message(session_id, "assistant", bot_text)

    # Generate TTS
    audio_base64 = None
    try:
        tts_bytes = await text_to_speech(bot_text)
        audio_base64 = base64.b64encode(tts_bytes).decode("utf-8")
    except RuntimeError:
        pass

    return ChatResponse(
        text=bot_text,
        audio_base64=audio_base64,
        session_id=session_id,
        user_name=current_name,
    )


# ─────────────────────── LOGS ───────────────────────
@app.get("/api/logs")
async def get_logs(
    session_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    """Fetch conversation logs, optionally filtered by session."""
    logs = read_logs(session_id=session_id, limit=limit)
    return {"logs": logs, "count": len(logs)}


@app.delete("/api/logs")
async def delete_logs():
    """Clear all logs."""
    clear_logs()
    return {"message": "Logs cleared successfully"}


# ─────────────────────── RUN ───────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )

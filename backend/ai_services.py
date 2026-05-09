"""
AI Services Module — 100% Free & No-API-Key Edition
- STT: Google Web Speech API (via SpeechRecognition)
- LLM: GPT4Free (g4f) using PollinationsAI
- TTS: gTTS (Google Text-to-Speech)
"""

import io
import asyncio
import os
from typing import List, Optional

import speech_recognition as sr
from gtts import gTTS
import g4f
from g4f.client import AsyncClient

# Initialize AsyncClient with PollinationsAI provider
g4f_client = AsyncClient(provider=g4f.Provider.PollinationsAI)
LLM_MODEL = "openai"

# ─────────────────────── SYSTEM PROMPT ───────────────────────
SYSTEM_PROMPT = """You are "Vaani" — a warm, intelligent, and culturally aware voice assistant fluent in Hindi, Telugu, and English. You are designed for natural conversations with people who code-mix these languages freely.

CORE RULES:
1. Language Mirroring: Reply in the EXACT linguistic style the user uses. If they mix Hindi+Telugu, you mix back.
2. Use Roman/Latin script (transliteration) for Hindi and Telugu. Write "meeku" not "మీకు".
3. Be warm, use "ji" and "garu" when appropriate.
4. Keep responses concise (2-4 sentences).
5. Remember the user's name and context from history.
6. Never say "As an AI" — you are Vaani."""


# ─────────────────────── STT via Google Web Speech ───────────────────────
async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> dict:
    """
    Transcribe audio using Google Web Speech API (Free, no key).
    We use pydub to convert webm/ogg to wav for SpeechRecognition.
    """
    try:
        from pydub import AudioSegment
        import tempfile

        # Write incoming bytes to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_in:
            temp_in.write(audio_bytes)
            temp_in_path = temp_in.name

        temp_wav_path = temp_in_path + ".wav"

        # Convert to WAV (SpeechRecognition requires WAV, AIFF, or FLAC)
        try:
            audio_segment = AudioSegment.from_file(temp_in_path)
            audio_segment.export(temp_wav_path, format="wav")
        except Exception as e:
            # Cleanup and re-raise
            if os.path.exists(temp_in_path):
                os.remove(temp_in_path)
            raise RuntimeError(f"Audio conversion failed: {str(e)}")

        # Transcribe using SpeechRecognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_wav_path) as source:
            audio_data = recognizer.record(source)

        # Cleanup temp files
        try:
            os.remove(temp_in_path)
            os.remove(temp_wav_path)
        except:
            pass

        # Try to recognize (en-IN works best for mixed English/Hindi/Telugu)
        text = recognizer.recognize_google(audio_data, language="en-IN")
        
        return {"text": text.strip(), "language": "auto-detected"}

    except sr.UnknownValueError:
        # No speech detected
        return {"text": "", "language": "auto-detected"}
    except sr.RequestError as e:
        raise RuntimeError(f"Google STT service unavailable: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"STT failed: {str(e)}")


# ─────────────────────── LLM via GPT4Free ───────────────────────────────
async def generate_response(
    user_message: str,
    conversation_history: List[dict],
    user_name: Optional[str] = None,
) -> str:
    """
    Generate a response using GPT4Free public endpoints.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if user_name:
        messages.append({
            "role": "system",
            "content": f"The user's name is {user_name}. Use it naturally in conversation.",
        })

    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    try:
        response = await g4f_client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
        )
        result = response.choices[0].message.content
        return result.strip()
    except Exception as e:
        raise RuntimeError(f"Free LLM failed: {str(e)}")


# ─────────────────────── NAME EXTRACTION ───────────────────────
async def extract_user_name(text: str) -> Optional[str]:
    """Extract user name using the free LLM."""
    try:
        response = await g4f_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "Extract the person's name from the text. Return ONLY the name. If no name found, return NONE."},
                {"role": "user", "content": text},
            ],
        )

        name = response.choices[0].message.content.strip()
        if name.upper() == "NONE" or len(name) > 50 or not name:
            return None
        return name
    except Exception:
        return None


# ─────────────────────── gTTS TEXT-TO-SPEECH ───────────────────────
async def text_to_speech(text: str) -> bytes:
    """Convert text to speech using gTTS."""
    try:
        lang = _detect_tts_language(text)
        # Run gTTS in an executor since it's synchronous
        loop = asyncio.get_event_loop()
        tts_func = lambda: _generate_gtts(text, lang)
        audio_bytes = await loop.run_in_executor(None, tts_func)
        return audio_bytes
    except Exception as e:
        raise RuntimeError(f"TTS generation failed: {str(e)}")

import re

def _clean_text_for_tts(text: str) -> str:
    """Remove markdown symbols and emojis so TTS doesn't read them."""
    # Remove common markdown chars
    cleaned = re.sub(r'[*_#~`\\[\\]()]', '', text)
    # Remove emojis (basic range)
    cleaned = re.sub(r'[\U00010000-\U0010ffff]', '', cleaned)
    return cleaned.strip()

def _generate_gtts(text: str, lang: str) -> bytes:
    clean_text = _clean_text_for_tts(text)
    # If text is entirely emojis and becomes empty, default to a polite placeholder
    if not clean_text:
        clean_text = "Hmm"
    tts = gTTS(text=clean_text, lang=lang, slow=False)
    audio_buffer = io.BytesIO()
    tts.write_to_fp(audio_buffer)
    audio_buffer.seek(0)
    return audio_buffer.read()

def _detect_tts_language(text: str) -> str:
    telugu_markers = ["naa", "peru", "meeku", "kavali", "undi", "chestanu"]
    hindi_markers = ["mera", "naam", "hai", "mujhe", "chahiye", "aapko"]
    text_lower = text.lower()
    t = sum(1 for m in telugu_markers if m in text_lower)
    h = sum(1 for m in hindi_markers if m in text_lower)
    if t > h:
        return "te"
    return "hi"

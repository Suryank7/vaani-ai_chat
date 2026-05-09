"""
Structured JSON logging system for conversation interactions.
Appends every user query and bot response to chat_logs.json.
"""

import json
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional

LOG_FILE = os.path.join(os.path.dirname(__file__), "chat_logs.json")
_lock = asyncio.Lock()


def _ensure_log_file():
    """Ensure the log file exists with a valid JSON array."""
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


async def append_log(
    session_id: str,
    role: str,
    content: str,
    language_detected: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Append a structured log entry to chat_logs.json."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "role": role,
        "content": content,
    }
    if language_detected:
        entry["language_detected"] = language_detected
    if metadata:
        entry["metadata"] = metadata

    async with _lock:
        _ensure_log_file()
        try:
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            logs = []

        logs.append(entry)

        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)


def read_logs(session_id: Optional[str] = None, limit: int = 100) -> list:
    """Read logs, optionally filtered by session_id."""
    _ensure_log_file()
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            logs = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

    if session_id:
        logs = [l for l in logs if l.get("session_id") == session_id]

    return logs[-limit:]


def clear_logs():
    """Clear all logs."""
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)

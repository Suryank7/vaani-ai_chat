"""
Multi-turn conversation memory manager.
Stores per-session conversation history with configurable max turns.
"""

from typing import Dict, List
import time
import uuid


class ConversationManager:
    """Manages multi-turn conversation history per session."""

    def __init__(self, max_turns: int = 20):
        self._sessions: Dict[str, dict] = {}
        self._max_turns = max_turns

    def create_session(self) -> str:
        """Create a new conversation session and return its ID."""
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = {
            "created_at": time.time(),
            "last_active": time.time(),
            "history": [],
            "user_name": None,
            "language_preference": None,
        }
        return session_id

    def get_or_create_session(self, session_id: str | None) -> str:
        """Return existing session or create a new one."""
        if session_id and session_id in self._sessions:
            self._sessions[session_id]["last_active"] = time.time()
            return session_id
        return self.create_session()

    def add_message(self, session_id: str, role: str, content: str):
        """Add a message to session history."""
        if session_id not in self._sessions:
            return

        self._sessions[session_id]["history"].append({
            "role": role,
            "content": content,
        })

        # Trim to max turns (keep system prompt area free)
        history = self._sessions[session_id]["history"]
        if len(history) > self._max_turns * 2:
            # Keep first 2 messages (usually greeting context) + last N
            self._sessions[session_id]["history"] = (
                history[:2] + history[-(self._max_turns * 2 - 2):]
            )

    def get_history(self, session_id: str) -> List[dict]:
        """Return the full conversation history for a session."""
        if session_id not in self._sessions:
            return []
        return self._sessions[session_id]["history"]

    def set_user_name(self, session_id: str, name: str):
        """Store extracted user name for the session."""
        if session_id in self._sessions:
            self._sessions[session_id]["user_name"] = name

    def get_user_name(self, session_id: str) -> str | None:
        """Get stored user name."""
        if session_id in self._sessions:
            return self._sessions[session_id]["user_name"]
        return None

    def get_session_info(self, session_id: str) -> dict | None:
        """Get session metadata."""
        return self._sessions.get(session_id)

    def cleanup_stale_sessions(self, max_age_seconds: int = 3600):
        """Remove sessions older than max_age_seconds."""
        now = time.time()
        stale = [
            sid for sid, data in self._sessions.items()
            if now - data["last_active"] > max_age_seconds
        ]
        for sid in stale:
            del self._sessions[sid]


# Singleton instance
conversation_manager = ConversationManager()

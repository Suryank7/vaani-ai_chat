"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import ChatBubble, { TypingIndicator } from "./ChatBubble";
import MicButton from "./MicButton";
import WaveformVisualizer from "./WaveformVisualizer";
import LogsPanel from "./LogsPanel";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

/**
 * Main VoiceBot component.
 * Orchestrates: audio recording → API call → response display → TTS playback
 */
export default function VoiceBot() {
  // ─── State ───
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [userName, setUserName] = useState(null);

  // ─── Refs ───
  const chatEndRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const webSpeechRef = useRef(null);

  // ─── Audio Recorder Hook ───
  const {
    isRecording,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  // ─── Initialize Session ───
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.session_id);
        }
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    };
    initSession();
  }, []);

  // ─── Auto-scroll ───
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // ─── Web Speech API (Live Transcript Fallback) ───
  const startWebSpeech = useCallback(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "hi-IN"; // Start with Hindi, Whisper handles the real transcription

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          // Don't use final results — Whisper will handle that
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setLiveTranscript(interim);
    };

    recognition.onerror = () => {};
    recognition.onend = () => setLiveTranscript("");

    try {
      recognition.start();
      webSpeechRef.current = recognition;
    } catch (err) {
      // Web Speech might not be available
    }
  }, []);

  const stopWebSpeech = useCallback(() => {
    if (webSpeechRef.current) {
      webSpeechRef.current.stop();
      webSpeechRef.current = null;
      setLiveTranscript("");
    }
  }, []);

  // ─── Play TTS Audio ───
  const playAudio = useCallback((base64Audio) => {
    if (!base64Audio) return;

    try {
      const byteChars = atob(base64Audio);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        URL.revokeObjectURL(audioPlayerRef.current.src);
      }

      const audio = new Audio(url);
      audioPlayerRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.play().catch(() => setIsPlaying(false));
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }, []);

  // ─── Handle Voice Chat ───
  const handleMicToggle = async () => {
    if (isRecording) {
      // Stop recording and process
      stopWebSpeech();
      const audioBlob = await stopRecording();

      if (!audioBlob || audioBlob.size < 100) {
        setError("Recording was too short. Please try again.");
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        if (sessionId) formData.append("session_id", sessionId);

        const res = await fetch(`${API_BASE}/api/voice-chat`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error: ${res.status}`);
        }

        const data = await res.json();
        const now = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Add user message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: data.text ? `🎤 ${data.language_detected || ""}: ${getTranscribedText(data)}` : "🎤 (voice message)",
            displayText: getTranscribedText(data),
            isUser: true,
            timestamp: now,
            isNew: true,
          },
        ]);

        // We need to extract the user's transcribed text from the response
        // The API returns bot text, so we need to look at what was transcribed
        // Actually the voice-chat endpoint returns the bot's response text.
        // The user text was logged server-side. Let's update:

        // Add bot message
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: data.text,
              displayText: data.text,
              isUser: false,
              timestamp: now,
              isNew: true,
            },
          ]);

          // Play TTS
          if (data.audio_base64) {
            playAudio(data.audio_base64);
          }
        }, 300);

        // Update session info
        if (data.session_id) setSessionId(data.session_id);
        if (data.user_name) setUserName(data.user_name);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Start recording
      try {
        setError(null);
        await startRecording();
        startWebSpeech();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  // Helper to extract transcribed user text from response
  // Since voice-chat returns bot response, we fetch logs for the user's transcription
  const getTranscribedText = (data) => {
    // The API doesn't return user transcription in the response directly
    // We show a placeholder that gets replaced when we have the full text
    return data.text || "(processing...)";
  };

  // ─── Handle Text Chat ───
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;

    const userText = textInput.trim();
    setTextInput("");
    setIsProcessing(true);
    setError(null);

    const now = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: userText,
        displayText: userText,
        isUser: true,
        timestamp: now,
        isNew: true,
      },
    ]);

    try {
      const res = await fetch(`${API_BASE}/api/text-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();

      // Add bot message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: data.text,
          displayText: data.text,
          isUser: false,
          timestamp: now,
          isNew: true,
        },
      ]);

      // Play TTS
      if (data.audio_base64) {
        playAudio(data.audio_base64);
      }

      if (data.session_id) setSessionId(data.session_id);
      if (data.user_name) setUserName(data.user_name);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── Render ───
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Animated background mesh */}
      <div className="bg-mesh" />

      {/* ── Header ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 glass border-b border-white/5"
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-vaani-500 to-purple-600 flex items-center justify-center"
            >
              <span className="text-lg">🎙️</span>
            </motion.div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Vaani</h1>
              <p className="text-[11px] text-slate-500 -mt-0.5">
                Hindi • Telugu • English
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* User name badge */}
            <AnimatePresence>
              {userName && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-light text-sm"
                >
                  <span className="text-slate-400">Hi,</span>
                  <span className="font-medium text-vaani-400">{userName}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Audio playing indicator */}
            <AnimatePresence>
              {isPlaying && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                >
                  <div className="flex items-center gap-[2px]">
                    {[1, 2, 3, 4].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [4, 12, 4] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.1,
                        }}
                        className="w-[2px] bg-emerald-400 rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-emerald-400 ml-1">Speaking</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logs button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowLogs(true)}
              className="p-2.5 rounded-xl glass-light hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
              title="View conversation logs"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* ── Chat Area ── */}
      <div className="relative z-10 flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
            {/* Welcome message */}
            {messages.length === 0 && !isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-vaani-500/20 to-purple-600/20 border border-white/10 flex items-center justify-center mb-6"
                >
                  <span className="text-5xl">🎙️</span>
                </motion.div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  Namaste! Main hoon{" "}
                  <span className="gradient-text">Vaani</span>
                </h2>
                <p className="text-slate-400 max-w-md text-sm leading-relaxed">
                  Aapka multilingual voice assistant. Hindi, Telugu, aur English
                  mein baat karo — sab samajhti hoon! Mic tap karo aur bolna
                  shuru karo.
                </p>

                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {[
                    "Namaste, mera naam Raju hai",
                    "Naku help kavali",
                    "Mujhe ek demo chahiye",
                    "Hello! How are you?",
                  ].map((suggestion, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      onClick={() => {
                        setTextInput(suggestion);
                      }}
                      className="px-4 py-2 rounded-full glass-light text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                    >
                      &ldquo;{suggestion}&rdquo;
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg.isUser ? msg.displayText : msg.displayText}
                isUser={msg.isUser}
                timestamp={msg.timestamp}
                isNew={msg.isNew}
              />
            ))}

            {/* Typing indicator */}
            <AnimatePresence>
              {isProcessing && <TypingIndicator />}
            </AnimatePresence>

            {/* Live transcript */}
            <AnimatePresence>
              {isRecording && liveTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-end mb-2"
                >
                  <div className="px-4 py-2 rounded-2xl bg-vaani-500/10 border border-vaani-500/20 text-sm text-vaani-300 italic max-w-[70%]">
                    <span className="text-vaani-500 mr-1">✍️</span>
                    {liveTranscript}...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      {/* ── Bottom Panel ── */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="relative z-10 glass border-t border-white/5"
      >
        <div className="max-w-4xl mx-auto px-4 py-5">
          {/* Waveform */}
          <WaveformVisualizer audioLevel={audioLevel} isActive={isRecording} />

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center gap-2"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mic + Text Input Row */}
          <div className="flex items-center gap-4">
            {/* Text input */}
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type in Hindi, Telugu, or English..."
                  disabled={isRecording || isProcessing}
                  className="w-full px-4 py-3 rounded-2xl glass-light text-sm text-white placeholder-slate-500 outline-none focus:border-vaani-500/50 focus:ring-1 focus:ring-vaani-500/30 transition-all disabled:opacity-50"
                />
              </div>
              <motion.button
                type="submit"
                disabled={!textInput.trim() || isProcessing || isRecording}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-3 rounded-2xl bg-vaani-600 hover:bg-vaani-500 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </motion.button>
            </form>

            {/* Mic Button */}
            <MicButton
              isRecording={isRecording}
              isProcessing={isProcessing}
              audioLevel={audioLevel}
              duration={duration}
              onToggle={handleMicToggle}
              disabled={isProcessing}
            />
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-600">
            <span>Powered by GPT4Free + Google STT + gTTS</span>
            <span>•</span>
            <span>Session: {sessionId?.slice(0, 8) || "..."}</span>
          </div>
        </div>
      </motion.div>

      {/* ── Logs Panel ── */}
      <LogsPanel
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
        sessionId={sessionId}
      />
    </div>
  );
}

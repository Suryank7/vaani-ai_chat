"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Animated microphone button with pulse rings and recording state.
 * Features:
 * - Pulsing glow when idle
 * - Red recording state with expanding rings
 * - Audio level visualization
 * - Duration display
 */
export default function MicButton({
  isRecording,
  isProcessing,
  audioLevel,
  duration,
  onToggle,
  disabled,
}) {
  const formattedDuration = (() => {
    const mins = Math.floor((duration || 0) / 60);
    const secs = (duration || 0) % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  })();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Recording duration */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2"
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-red-500"
            />
            <span className="text-sm font-medium text-red-400 tabular-nums">
              {formattedDuration}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button Container */}
      <div className="relative">
        {/* Outer pulse rings (when recording) */}
        <AnimatePresence>
          {isRecording && (
            <>
              <motion.div
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full bg-red-500/30"
              />
              <motion.div
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.3,
                }}
                className="absolute inset-0 rounded-full bg-red-500/20"
              />
            </>
          )}
        </AnimatePresence>

        {/* Audio level ring */}
        {isRecording && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-400/50"
            animate={{
              scale: 1 + audioLevel * 0.4,
              borderColor: `rgba(248, 113, 113, ${0.3 + audioLevel * 0.5})`,
            }}
            transition={{ duration: 0.1 }}
          />
        )}

        {/* Main Button */}
        <motion.button
          onClick={onToggle}
          disabled={disabled || isProcessing}
          whileHover={!isRecording ? { scale: 1.08 } : {}}
          whileTap={{ scale: 0.92 }}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording
              ? "bg-gradient-to-br from-red-500 to-red-600 mic-recording"
              : isProcessing
              ? "bg-gradient-to-br from-amber-500 to-amber-600 cursor-wait"
              : "bg-gradient-to-br from-vaani-500 to-vaani-700 mic-glow hover:from-vaani-400 hover:to-vaani-600"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isProcessing ? (
            /* Processing spinner */
            <motion.svg
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </motion.svg>
          ) : isRecording ? (
            /* Stop icon */
            <motion.div
              initial={{ scale: 0, borderRadius: "50%" }}
              animate={{ scale: 1, borderRadius: "4px" }}
              className="w-7 h-7 bg-white rounded"
            />
          ) : (
            /* Microphone icon */
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 10v2a7 7 0 01-14 0v-2"
              />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Status text */}
      <motion.p
        key={isRecording ? "rec" : isProcessing ? "proc" : "idle"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm font-medium text-slate-400"
      >
        {isRecording
          ? "Listening... Tap to stop"
          : isProcessing
          ? "Processing your voice..."
          : "Tap to speak"}
      </motion.p>
    </div>
  );
}

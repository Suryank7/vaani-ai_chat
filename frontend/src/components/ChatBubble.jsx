"use client";

import { motion } from "framer-motion";
import React from "react";

/**
 * Parses basic markdown like **bold**, *italic*, and newlines.
 */
function formatMessage(text) {
  if (!text) return null;
  
  // Split by double asterisks first
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    
    // Split remaining by single asterisks
    const italicParts = part.split(/(\*.*?\*)/g);
    return italicParts.map((subPart, j) => {
      if (subPart.startsWith('*') && subPart.endsWith('*')) {
        return <em key={`${i}-${j}`} className="italic text-vaani-100">{subPart.slice(1, -1)}</em>;
      }
      
      // Handle newlines
      return subPart.split('\n').map((line, k) => (
        <React.Fragment key={`${i}-${j}-${k}`}>
          {line}
          {k !== subPart.split('\n').length - 1 && <br />}
        </React.Fragment>
      ));
    });
  });
}

/**
 * Apple-style chat message bubble.
 * Supports user and bot messages with different styling.
 */
export default function ChatBubble({ message, isUser, timestamp, isNew }) {
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar */}
        <motion.div
          initial={isNew ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isUser
              ? "bg-gradient-to-br from-vaani-500 to-vaani-700 text-white"
              : "bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 text-cyan-400"
          }`}
        >
          {isUser ? "You" : "V"}
        </motion.div>

        {/* Bubble */}
        <div className="flex flex-col gap-1">
          <div
            className={`px-4 py-3 text-[15px] leading-relaxed ${
              isUser ? "bubble-user" : "bubble-bot"
            }`}
          >
            {formatMessage(message)}
          </div>

          {/* Timestamp */}
          {timestamp && (
            <span
              className={`text-[11px] text-slate-500 px-2 ${
                isUser ? "text-right" : "text-left"
              }`}
            >
              {timestamp}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Typing indicator with animated dots.
 */
export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex justify-start mb-4"
    >
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-400">
          V
        </div>
        <div className="bubble-bot px-5 py-4 flex items-center gap-1.5">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </motion.div>
  );
}

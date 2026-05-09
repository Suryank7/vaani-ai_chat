"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Conversation logs panel - fetches and displays chat history
 * with session filtering and auto-refresh.
 */
export default function LogsPanel({ isOpen, onClose, sessionId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("current"); // "current" | "all"

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const sid = filter === "current" && sessionId ? `&session_id=${sessionId}` : "";
      const res = await fetch(`/api/logs?limit=200${sid}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchLogs();
  }, [isOpen, filter]);

  const formatTimestamp = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-IN", {
        dateStyle: "short",
        timeStyle: "medium",
      });
    } catch {
      return ts;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg glass-heavy z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Conversation Logs
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {logs.length} entries
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Filter Toggle */}
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => setFilter("current")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === "current"
                        ? "bg-vaani-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Session
                  </button>
                  <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === "all"
                        ? "bg-vaani-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All
                  </button>
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchLogs}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                  title="Refresh logs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-2 border-vaani-500 border-t-transparent rounded-full"
                  />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No conversation logs yet</p>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="log-entry rounded-xl p-3 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-semibold uppercase tracking-wider ${
                          log.role === "user"
                            ? "text-vaani-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {log.role === "user" ? "👤 User" : "🤖 Vaani"}
                      </span>
                      <span className="text-[10px] text-slate-600 tabular-nums">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {log.content}
                    </p>
                    {log.language_detected && (
                      <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-500">
                        Lang: {log.language_detected}
                      </span>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10">
              <p className="text-[11px] text-slate-600 text-center">
                Logs stored in chat_logs.json • Session: {sessionId?.slice(0, 8) || "—"}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

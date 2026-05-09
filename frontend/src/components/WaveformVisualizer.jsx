"use client";

import { motion } from "framer-motion";

/**
 * Real-time audio waveform visualization.
 * Shows animated bars that respond to audio level.
 */
export default function WaveformVisualizer({ audioLevel, isActive }) {
  const bars = 20;

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center justify-center gap-[3px] py-3"
    >
      {Array.from({ length: bars }).map((_, i) => {
        // Create a wave pattern
        const distFromCenter = Math.abs(i - bars / 2) / (bars / 2);
        const baseHeight = (1 - distFromCenter) * 0.6 + 0.2;
        const dynamicHeight = baseHeight * (0.3 + audioLevel * 0.7);

        return (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-vaani-600 to-cyan-400"
            animate={{
              height: `${Math.max(4, dynamicHeight * 40)}px`,
              opacity: 0.5 + dynamicHeight * 0.5,
            }}
            transition={{
              duration: 0.1,
              ease: "easeOut",
            }}
          />
        );
      })}
    </motion.div>
  );
}

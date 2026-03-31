'use client';

import { motion } from 'framer-motion';

interface GlossyTextRevealProps {
  text: string;
  className?: string;
}

export function GlossyTextReveal({ text, className }: GlossyTextRevealProps) {
  const words = text.split(/(\s+)/).filter(Boolean);

  return (
    <div className={className}>
      {words.map((word, index) => {
        const isWhitespace = /^\s+$/.test(word);
        if (isWhitespace) return <span key={`space-${index}`}>{word}</span>;

        return (
          <motion.span
            key={`word-${index}`}
            initial={{ opacity: 0, y: 4, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: 0.34,
              ease: [0.2, 0.65, 0.2, 1],
              delay: index * 0.02,
            }}
            className="inline-block text-[#3d3d3a] [text-shadow:0_0_14px_rgba(255,255,255,0.48)]"
          >
            {word}
          </motion.span>
        );
      })}
    </div>
  );
}

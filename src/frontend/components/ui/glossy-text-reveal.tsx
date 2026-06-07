'use client';

import { motion } from 'framer-motion';

interface GlossyTextRevealProps {
  text: string;
  className?: string; // optional Tailwind/CSS className override
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
            key={`word-${index}`} // React list key — index-based unique id
            initial={{ opacity: 0, y: 4, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} // animate state: fully visible, sharp, original position
            transition={{
              duration: 0.34,
              ease: [0.2, 0.65, 0.2, 1], // custom cubic-bezier easing curve
              delay: index * 0.02,
            }}
            className="inline-block text-zinc-800 [text-shadow:0_0_14px_rgba(255,255,255,0.48)]" // glossy text styling + white glow shadow
          >
            {word} {/* animated word content */}
          </motion.span>
        );
      })}
    </div>
  );
}

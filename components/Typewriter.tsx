"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const TYPE_MS = 55;
const ERASE_MS = 30;
const HOLD_MS = 2500;

export function Typewriter({ words }: { words: readonly string[] }) {
  const reduce = useReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);
  const [len, setLen] = useState(0);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const word = words[wordIndex];
    let t: ReturnType<typeof setTimeout>;
    if (!erasing) {
      if (len < word.length) t = setTimeout(() => setLen(len + 1), TYPE_MS);
      else t = setTimeout(() => setErasing(true), HOLD_MS);
    } else {
      if (len > 0) t = setTimeout(() => setLen(len - 1), ERASE_MS);
      else
        t = setTimeout(() => {
          setWordIndex((i) => (i + 1) % words.length);
          setErasing(false);
        }, TYPE_MS);
    }
    return () => clearTimeout(t);
  }, [len, erasing, wordIndex, words, reduce]);

  if (reduce) return <span className="font-mono text-accent">{words[0]}</span>;

  return (
    <span className="font-mono text-accent" aria-label={words[0]}>
      {words[wordIndex].slice(0, len)}
      <span aria-hidden className="animate-pulse">
        ▌
      </span>
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// The first swap waits for the hero intro to settle.
const FIRST_SWAP_MS = 2800;
const HOLD_MS = 3000;

export function RoleRotator({ roles }: { roles: readonly string[] }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce || roles.length < 2) return;
    const next = () => setIndex((i) => (i + 1) % roles.length);
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      next();
      interval = setInterval(next, HOLD_MS);
    }, FIRST_SWAP_MS);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [reduce, roles.length]);

  return (
    <>
      <span className="sr-only">{roles.join(", ")}</span>
      <span aria-hidden className="relative block overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={index}
            className="block"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {roles[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  );
}

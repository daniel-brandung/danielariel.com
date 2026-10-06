"use client";

import { createContext, useContext, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";

// Redline specs: decorative measurements drawn over the page. Every overlay's
// outer element carries `.spec`, which the [data-specs] switch in globals.css
// shows or hides; the inner element draws in once, the first time it scrolls
// into view. Values in labels must match the CSS they annotate.

const SpecsContext = createContext({ on: true, toggle: () => {} });

export function useSpecs() {
  return useContext(SpecsContext);
}

export function SpecsRoot({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(true);
  return (
    <SpecsContext value={{ on, toggle: () => setOn((v) => !v) }}>
      <MotionConfig reducedMotion="user">
        <div data-specs={on ? "on" : "off"}>{children}</div>
      </MotionConfig>
    </SpecsContext>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEW = { once: true, margin: "-40px" } as const;
const LABEL =
  "whitespace-nowrap rounded-[3px] border border-accent bg-bg px-1.5 py-1 font-mono text-[11px] font-normal leading-none tracking-normal text-accent";

type SpecProps = { className?: string; delay?: number };

/** A measurement label, positioned by `className` against its nearest positioned ancestor. */
export function SpecLabel({
  children,
  className = "",
  delay = 0,
}: SpecProps & { children: React.ReactNode }) {
  return (
    <span aria-hidden className={`spec pointer-events-none absolute z-10 ${className}`}>
      <motion.span
        className={`block ${LABEL}`}
        initial={{ opacity: 0, x: -6 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={VIEW}
        transition={{ duration: 0.4, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** A vertical dimension line `size` px tall, labelled with its value. */
export function SpecGap({ size, className = "", delay = 0 }: SpecProps & { size: number }) {
  return (
    <span
      aria-hidden
      className={`spec pointer-events-none absolute z-10 flex items-center ${className}`}
      style={{ height: size }}
    >
      <motion.span
        className="spec-vline h-full"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={VIEW}
        transition={{ duration: 0.45, ease: EASE, delay }}
      />
      <motion.span
        className={`ml-1.5 ${LABEL}`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEW}
        transition={{ duration: 0.3, delay: delay + 0.25 }}
      >
        {size}
      </motion.span>
    </span>
  );
}

/** A horizontal dimension line across its positioned box, label centred above. */
export function SpecSpan({ label, className = "", delay = 0 }: SpecProps & { label: string }) {
  return (
    <span
      aria-hidden
      className={`spec pointer-events-none absolute z-10 flex flex-col items-center ${className}`}
    >
      <motion.span
        className={`mb-1.5 ${LABEL}`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEW}
        transition={{ duration: 0.3, delay: delay + 0.3 }}
      >
        {label}
      </motion.span>
      <motion.span
        className="spec-hline w-full"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={VIEW}
        transition={{ duration: 0.6, ease: EASE, delay }}
      />
    </span>
  );
}

/** A dashed bounding box around the nearest positioned ancestor, drawn corner to corner. */
export function SpecBox({ className = "", delay = 0 }: SpecProps) {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className={`spec pointer-events-none absolute -inset-1.5 z-10 ${className}`}>
      <motion.span
        className="absolute inset-0 rounded-[3px] border border-dashed border-accent"
        initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0% 100% 100% 0%)" }}
        whileInView={reduce ? { opacity: 1 } : { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
        viewport={VIEW}
        transition={{ duration: 0.7, ease: EASE, delay }}
      />
    </span>
  );
}

const PALETTE = [
  { hex: "#1A1C2B", name: "ink" },
  { hex: "#5A5F73", name: "slate" },
  { hex: "#E3E5EC", name: "rule" },
  { hex: "#D42A62", name: "redline" },
];

/** The page's own colour tokens, as swatches. */
export function SpecPalette({ className = "", delay = 0 }: SpecProps) {
  return (
    <div
      aria-hidden
      className={`spec flex flex-wrap gap-x-6 gap-y-3 font-mono text-[11px] text-accent ${className}`}
    >
      {PALETTE.map((color, i) => (
        <motion.span
          key={color.hex}
          className="inline-flex items-center gap-2"
          initial={{ opacity: 0, y: 4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEW}
          transition={{ duration: 0.4, ease: EASE, delay: delay + i * 0.08 }}
        >
          <span
            className="size-4 rounded-[3px] border border-line"
            style={{ background: color.hex }}
          />
          {color.hex} {color.name}
        </motion.span>
      ))}
    </div>
  );
}

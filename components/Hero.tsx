"use client";

import { motion, useReducedMotion } from "motion/react";
import { Typewriter } from "@/components/Typewriter";
import { site } from "@/lib/content";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export function Hero() {
  const reduce = useReducedMotion();
  return (
    <section id="top" className="relative flex min-h-svh items-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)]"
      />
      <Glyphs animate={!reduce} />
      <motion.div
        className="relative mx-auto w-full max-w-[1100px] px-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.p variants={item} className="mb-4 font-mono text-sm text-muted">
          {site.location}
        </motion.p>
        <motion.h1 variants={item} className="text-5xl font-semibold tracking-tight md:text-7xl">
          {site.name}
        </motion.h1>
        <motion.p variants={item} className="mt-4 min-h-8 text-xl md:text-2xl">
          <Typewriter words={site.roles} />
        </motion.p>
        <motion.p variants={item} className="mt-6 max-w-xl text-lg text-muted">
          {site.tagline}
        </motion.p>
        <motion.div variants={item} className="mt-10 flex flex-wrap gap-4">
          <motion.a
            whileHover={reduce ? undefined : { scale: 1.02 }}
            href="#contact"
            className="rounded bg-accent px-6 py-3 font-medium text-bg transition-colors hover:bg-accent-soft"
          >
            Get in touch
          </motion.a>
          <motion.a
            whileHover={reduce ? undefined : { scale: 1.02 }}
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-line px-6 py-3 text-ink transition-colors hover:border-accent hover:text-accent"
          >
            LinkedIn
          </motion.a>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Glyphs({ animate }: { animate: boolean }) {
  const glyphs = [
    { g: "{}", x: "12%", y: "22%", d: 14 },
    { g: "=>", x: "82%", y: "30%", d: 18 },
    { g: "</>", x: "70%", y: "72%", d: 16 },
    { g: "()", x: "22%", y: "78%", d: 20 },
  ];
  return (
    <div aria-hidden className="absolute inset-0">
      {glyphs.map(({ g, x, y, d }) => (
        <motion.span
          key={g}
          className="absolute font-mono text-2xl text-ink/[0.06]"
          style={{ left: x, top: y }}
          animate={animate ? { y: [0, -18, 0] } : undefined}
          transition={{ duration: d, repeat: Infinity, ease: "easeInOut" }}
        >
          {g}
        </motion.span>
      ))}
    </div>
  );
}

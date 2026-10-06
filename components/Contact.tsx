"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SpecLabel } from "@/components/Specs";
import { site } from "@/lib/content";

export function Contact() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${site.email}`;
    }
  };

  return (
    <section
      id="contact"
      className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-16 md:px-12 md:py-24"
    >
      <div className="border-t border-line pt-10 md:pt-14">
        <div className="relative w-fit">
          <SpecLabel className="-top-8 left-0 max-md:hidden" delay={0.2}>
            Plex Sans 600, 64/68
          </SpecLabel>
          <h2 className="max-w-[14em] text-balance text-[40px]/[46px] font-semibold tracking-[-0.025em] md:text-[64px]/[68px]">
            Let’s build something.
          </h2>
        </div>
        <p className="mt-6 max-w-[34em] text-pretty text-lg/[1.6] text-muted">
          Open to senior frontend roles and AI consulting engagements — in English, Hebrew, or
          German.
        </p>
        <p className="mt-4 text-[15px] text-muted">Based in {site.location}</p>
        <div className="relative mt-8 flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${site.email}`}
            className="inline-flex h-12 items-center rounded bg-ink px-6 font-medium text-white transition-colors hover:bg-accent"
          >
            {site.email}
          </a>
          <button
            onClick={copyEmail}
            aria-live="polite"
            className="inline-flex h-12 min-w-[5.5rem] items-center justify-center overflow-hidden rounded border border-line bg-bg px-4 text-sm font-medium text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "copied" : "copy"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className={copied ? "text-accent" : undefined}
              >
                {copied ? "Copied ✓" : "Copy"}
              </motion.span>
            </AnimatePresence>
          </button>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center rounded border border-ink bg-bg px-6 font-medium transition-colors hover:border-accent hover:text-accent"
          >
            LinkedIn
          </a>
          <SpecLabel className="left-0 top-[calc(100%+10px)] max-md:hidden" delay={0.35}>
            height 48, radius 4
          </SpecLabel>
        </div>
      </div>
    </section>
  );
}

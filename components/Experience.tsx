"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { Section } from "@/components/Section";
import { SpecLabel } from "@/components/Specs";
import { site } from "@/lib/content";

const ACCENT = "#d42a62";
const IDLE = "#acafb9";

export function Experience() {
  const listRef = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  // The redline traces the timeline as it scrolls through the viewport.
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 75%", "end 55%"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <Section id="experience" title="Experience">
      <div className="relative">
        <SpecLabel className="-top-9 left-[200px] max-md:hidden" delay={0.2}>
          1px rule, scaleY bound to scroll
        </SpecLabel>
        <ol ref={listRef} className="relative space-y-12">
          <span aria-hidden className="absolute inset-y-2 left-[5px] w-px bg-line md:left-[205px]" />
          <motion.span
            aria-hidden
            className="absolute inset-y-2 left-[5px] w-px origin-top bg-accent md:left-[205px]"
            style={{ scaleY: reduce ? 1 : progress }}
          />
          {site.experience.map((job) => {
            const current = job.period.includes("Present");
            return (
              <li
                key={`${job.org}-${job.title}`}
                className="relative grid gap-1 pl-8 md:grid-cols-[200px_1fr] md:gap-0 md:pl-0"
              >
                {/* each marker turns redline as the tracing line reaches it */}
                <motion.span
                  aria-hidden
                  className={`absolute left-0 top-[7px] size-[11px] rounded-full border md:left-[200px] ${
                    current ? "bg-accent" : "bg-bg"
                  }`}
                  initial={{ borderColor: current ? ACCENT : IDLE }}
                  whileInView={{ borderColor: ACCENT }}
                  viewport={{ once: true, margin: "0px 0px -45% 0px" }}
                  transition={{ duration: 0.3 }}
                >
                  {current && (
                    <span className="absolute inset-0 rounded-full bg-accent/50 motion-safe:animate-ping" />
                  )}
                </motion.span>
                <p className="text-[15px]/6 tabular-nums text-muted">{job.period}</p>
                <div className="md:pl-10">
                  <h3 className="text-[20px]/[28px] font-semibold tracking-[-0.01em]">{job.title}</h3>
                  <p className="text-[15px] font-medium">{job.org}</p>
                  <div className="mt-3 max-w-[40em] space-y-2 text-[16px]/[26px] text-muted">
                    {job.summary.map((line) => (
                      <p key={line.slice(0, 24)} className="text-pretty">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}

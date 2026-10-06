import { Section } from "@/components/Section";
import { SpecLabel, SpecSpan } from "@/components/Specs";
import { site } from "@/lib/content";

export function WhatIDo() {
  return (
    <Section id="what-i-do" title="What I Do">
      <div className="relative grid gap-6 md:grid-cols-2">
        <SpecSpan label="24" className="left-[calc(50%-12px)] top-16 w-6 max-md:hidden" delay={0.3} />
        {site.whatIDo.map((card, i) => (
          <article
            key={card.title}
            className="relative flex flex-col rounded-md border border-line bg-surface p-7 md:p-8"
          >
            {i === 0 && (
              <SpecLabel className="right-4 top-4 max-lg:hidden" delay={0.45}>
                padding 32
              </SpecLabel>
            )}
            <span aria-hidden className="font-mono text-xl text-accent">
              {card.glyph}
            </span>
            <h3 className="mt-4 text-[22px]/[28px] font-semibold tracking-[-0.01em]">
              {card.title}
            </h3>
            <ul className="mt-5 space-y-3 text-[16px]/[26px] text-muted">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span aria-hidden className="mt-[13px] h-px w-3 shrink-0 bg-accent" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            {"talk" in card && (
              <a
                href={card.talk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-8 flex items-start gap-4 rounded border border-line bg-wash p-4 transition-colors hover:border-accent"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors group-hover:bg-accent"
                >
                  <svg viewBox="0 0 16 16" className="ml-0.5 size-3.5" fill="currentColor">
                    <path d="M4 2.5v11l9-5.5z" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-muted">
                    Watch my talk: {card.talk.event}
                  </span>
                  <span className="mt-1 block text-pretty font-medium transition-colors group-hover:text-accent">
                    {card.talk.title} <span aria-hidden>↗</span>
                  </span>
                </span>
              </a>
            )}
          </article>
        ))}
      </div>
    </Section>
  );
}

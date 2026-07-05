import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { site } from "@/lib/content";

export function WhatIDo() {
  return (
    <Section id="what-i-do" number="02" title="What I Do">
      <div className="grid gap-6 md:grid-cols-2">
        {site.whatIDo.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.12} className="h-full">
            <div className="h-full rounded border border-line bg-surface p-8 transition-[transform,border-color,box-shadow] duration-300 hover:border-accent/60 hover:shadow-[0_12px_40px_-12px_rgba(52,211,153,0.25)] motion-safe:hover:-translate-y-1">
              <span className="font-mono text-2xl text-accent">{card.glyph}</span>
              <h3 className="mt-4 text-xl font-semibold">{card.title}</h3>
              <ul className="mt-4 space-y-2 text-muted">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span aria-hidden className="text-accent">
                      ▸
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {"talk" in card && (
                <a
                  href={card.talk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/talk mt-6 block border-t border-line pt-5"
                >
                  <p className="font-mono text-xs text-muted">
                    <span aria-hidden>{"// "}</span>
                    watch my talk — {card.talk.event}
                  </p>
                  <p className="mt-1.5 text-pretty text-sm text-ink transition-colors group-hover/talk:text-accent">
                    {card.talk.title} <span aria-hidden>↗</span>
                  </p>
                </a>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

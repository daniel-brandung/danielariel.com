import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { site } from "@/lib/content";

export function About() {
  return (
    <Section id="about" number="01" title="About">
      <div className="grid gap-10 md:grid-cols-[2fr_1fr]">
        <div className="space-y-5 text-lg leading-relaxed text-muted">
          {site.about.map((paragraph, i) => (
            <Reveal key={paragraph.slice(0, 24)} delay={i * 0.1}>
              <p>{paragraph}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2} className="hidden md:block">
          <div className="relative flex aspect-square items-end justify-center overflow-hidden rounded border border-line bg-surface">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_80%,rgba(52,211,153,0.16),transparent_70%)]"
            />
            <Image
              src="/portrait.png"
              alt={`Portrait of ${site.name}`}
              width={802}
              height={900}
              sizes="(min-width: 768px) 33vw, 0px"
              className="relative w-[88%] object-contain object-bottom [filter:drop-shadow(0_0_28px_rgba(52,211,153,0.18))]"
            />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

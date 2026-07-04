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
          {/* Portrait slot: when a public/portrait.jpg exists, swap the
              monogram div for <Image src="/portrait.jpg" alt="Daniel Ariel" …/>. */}
          <div className="flex aspect-square items-center justify-center rounded border border-line bg-surface">
            <span className="font-mono text-4xl text-accent">{site.initials}</span>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

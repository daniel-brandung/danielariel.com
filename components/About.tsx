import { Section } from "@/components/Section";
import { SpecLabel, SpecSpan } from "@/components/Specs";
import { site } from "@/lib/content";

export function About() {
  return (
    <Section id="about" title="About">
      <div className="relative max-w-[36em]">
        <SpecSpan label="max-width 36em" className="inset-x-0 -top-9 max-md:hidden" delay={0.1} />
        <SpecLabel className="left-[calc(100%+40px)] top-1 max-lg:hidden" delay={0.4}>
          Plex Sans 400, 19/32
        </SpecLabel>
        <div className="space-y-6 text-[18px]/[30px] md:text-[19px]/[32px]">
          {site.about.map((paragraph, i) => (
            <p
              key={paragraph.slice(0, 24)}
              className={`text-pretty ${i === 0 ? "text-ink" : "text-muted"}`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </Section>
  );
}

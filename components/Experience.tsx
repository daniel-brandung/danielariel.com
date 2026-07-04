import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { site } from "@/lib/content";

export function Experience() {
  return (
    <Section id="experience" number="03" title="Experience">
      <ol className="relative space-y-12 border-l border-line pl-8">
        {site.experience.map((job, i) => (
          <li key={`${job.org}-${job.title}`} className="relative">
            <span
              aria-hidden
              className="absolute -left-[37px] top-1.5 size-2.5 rounded-full border border-accent bg-bg"
            />
            <Reveal delay={i * 0.08}>
              <p className="font-mono text-sm text-muted">{job.period}</p>
              <h3 className="mt-1 text-lg font-semibold">{job.title}</h3>
              <p className="text-sm text-accent">{job.org}</p>
              <div className="mt-3 space-y-2 text-muted">
                {job.summary.map((line) => (
                  <p key={line.slice(0, 24)}>{line}</p>
                ))}
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}

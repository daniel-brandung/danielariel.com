import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { site } from "@/lib/content";

export function Projects() {
  return (
    <Section id="projects" number="03" title="Selected Projects">
      <Reveal>
        <p className="mb-10 max-w-2xl text-pretty text-lg text-muted">{site.projectsIntro}</p>
      </Reveal>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {site.projects.map((project, i) => (
          <li key={project.domain} className="h-full">
            <Reveal delay={(i % 3) * 0.08} className="h-full">
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col justify-between rounded border border-line bg-surface p-6 transition-[transform,border-color,box-shadow] duration-300 hover:border-accent/60 hover:shadow-[0_12px_40px_-12px_rgba(52,211,153,0.25)] motion-safe:hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-lg font-semibold transition-colors group-hover:text-accent">
                      {project.name}
                    </h3>
                    <span
                      aria-hidden
                      className="font-mono text-muted transition-colors group-hover:text-accent"
                    >
                      ↗
                    </span>
                  </div>
                  <p className="mt-2 text-pretty text-sm text-muted">{project.blurb}</p>
                </div>
                <p className="mt-5 flex items-baseline justify-between gap-4 font-mono text-xs text-muted">
                  <span>
                    <span aria-hidden>{"// "}</span>
                    {project.tag}
                  </span>
                  <span>{project.domain}</span>
                </p>
              </a>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

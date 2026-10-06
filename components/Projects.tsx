import { Section } from "@/components/Section";
import { SpecLabel } from "@/components/Specs";
import { site } from "@/lib/content";

const COLUMNS = "md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_16px]";

export function Projects() {
  return (
    <Section id="projects" title="Selected Projects" intro={site.projectsIntro}>
      <div className="relative">
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          <div
            aria-hidden
            className={`hidden gap-6 border-b border-line px-6 py-3 text-[13px] font-medium text-muted md:grid ${COLUMNS}`}
          >
            <span>Client</span>
            <span>Sector</span>
            <span>Site</span>
          </div>
          <ul>
            {site.projects.map((project) => (
              <li key={project.domain} className="border-b border-line last:border-b-0">
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group grid min-h-[72px] gap-1 px-5 py-4 transition-colors hover:bg-wash md:items-center md:gap-6 md:px-6 ${COLUMNS}`}
                >
                  <span className="min-w-0">
                    <span className="block text-[17px] font-semibold transition-colors group-hover:text-accent">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block text-pretty text-[15px]/[22px] text-muted">
                      {project.blurb}
                    </span>
                  </span>
                  <span className="text-[15px] text-muted max-md:hidden">
                    {site.sectorLabels[project.tag] ?? project.tag}
                  </span>
                  <span className="truncate font-mono text-[13px] max-md:hidden">
                    {project.domain}
                  </span>
                  <span
                    aria-hidden
                    className="text-muted transition-[translate,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent max-md:hidden"
                  >
                    ↗
                  </span>
                  <span className="mt-2 text-[13px] text-muted md:hidden">
                    {site.sectorLabels[project.tag] ?? project.tag},{" "}
                    <span className="font-mono">{project.domain}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <SpecLabel className="right-0 top-[calc(100%+12px)] max-md:hidden" delay={0.2}>
          rows min-height 72, domains in Plex Mono
        </SpecLabel>
      </div>
    </Section>
  );
}

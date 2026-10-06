import { Section } from "@/components/Section";
import { SpecLabel } from "@/components/Specs";
import { site } from "@/lib/content";

export function Skills() {
  return (
    <Section id="skills" title="Skills & Credentials">
      <div className="space-y-8">
        {site.skills.map((group, gi) => (
          <div key={group.group} className="grid gap-3 md:grid-cols-[200px_1fr] md:gap-0">
            <p className="text-[15px] font-medium text-muted md:pt-2">{group.group}</p>
            <ul className="relative flex flex-wrap gap-2">
              {gi === 0 && (
                <SpecLabel className="-top-9 left-0 max-md:hidden" delay={0.2}>
                  height 36, radius 4
                </SpecLabel>
              )}
              {group.items.map((skill) => (
                <li
                  key={skill}
                  className="inline-flex h-9 items-center rounded border border-line bg-surface px-3 text-[15px]"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="space-y-8 border-t border-line pt-8">
          <div className="grid gap-3 md:grid-cols-[200px_1fr] md:gap-0">
            <p className="text-[15px] font-medium text-muted">Credentials</p>
            <ul className="space-y-2">
              {site.credentials.map((credential) => (
                <li key={credential}>{credential}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 md:grid-cols-[200px_1fr] md:gap-0">
            <p className="text-[15px] font-medium text-muted">Languages</p>
            <ul className="flex flex-wrap gap-x-10 gap-y-2">
              {site.languages.map((lang) => (
                <li key={lang.name}>
                  {lang.name} <span className="text-muted">— {lang.level}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}

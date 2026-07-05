import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { site } from "@/lib/content";

export function Skills() {
  return (
    <Section id="skills" number="05" title="Skills & Credentials">
      <div className="space-y-8">
        {site.skills.map((group, gi) => (
          <Reveal key={group.group} delay={gi * 0.08}>
            <p className="mb-3 font-mono text-sm text-muted">{group.group}</p>
            <ul className="flex flex-wrap gap-2">
              {group.items.map((skill) => (
                <li
                  key={skill}
                  className="rounded border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
        <Reveal delay={0.2}>
          <div className="grid gap-6 border-t border-line pt-8 md:grid-cols-2">
            <div>
              <p className="mb-3 font-mono text-sm text-muted">Credentials</p>
              <ul className="space-y-2 text-muted">
                {site.credentials.map((credential) => (
                  <li key={credential}>{credential}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 font-mono text-sm text-muted">Languages</p>
              <ul className="space-y-2 text-muted">
                {site.languages.map((lang) => (
                  <li key={lang.name}>
                    <span className="text-ink">{lang.name}</span> — {lang.level}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

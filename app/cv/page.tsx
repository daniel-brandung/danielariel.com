import type { Metadata } from "next";
import localFont from "next/font/local";
import { site } from "@/lib/content";

// Static Plex files (from Fontsource) instead of next/font/google, which serves
// the variable Plex even for fixed weights: Chrome embeds static fonts in the
// PDF as real TrueType rather than Type 3 outlines, so the text copies and
// parses cleanly in applicant-tracking systems, at half the file size.
const plex = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600.woff2", weight: "600" },
  ],
});

export const metadata: Metadata = {
  title: `${site.name} — CV`,
  robots: { index: false, follow: false },
};

const contact = [
  { label: site.location },
  { label: site.email, href: `mailto:${site.email}` },
  { label: "linkedin.com/in/danielariel", href: site.linkedin },
  { label: "danielariel.com", href: "https://danielariel.com" },
];

const LINK = "underline decoration-line decoration-1 underline-offset-2";

function clientsBySector() {
  const groups = new Map<string, string[]>();
  for (const project of site.projects) {
    groups.set(project.tag, [...(groups.get(project.tag) ?? []), project.name]);
  }
  return [...groups].map(([tag, names]) => ({
    sector: site.sectorLabels[tag] ?? tag,
    names,
  }));
}

// One A4 page (see `@page` in globals.css). Regenerate the PDF with `npm run cv:pdf`.
export default function CvPage() {
  const { talk } = site.whatIDo[0];
  return (
    <div className="min-h-svh bg-[#eef0f4] py-10 print:bg-white print:py-0">
      <main
        className={`${plex.className} mx-auto w-full max-w-[210mm] bg-white px-[15mm] py-[12mm] text-[10pt]/[1.45] text-ink shadow-[0_1px_4px_rgba(26,28,43,0.12)] print:max-w-none print:p-0 print:shadow-none`}
      >
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[22pt]/[1.1] font-semibold tracking-[-0.02em]">{site.name}</h1>
            <p className="mt-1 text-[11.5pt] font-medium">
              Senior AI Consultant &amp; Senior Frontend Developer
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[9pt] text-muted">
              {contact.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <a href={item.href} className={`text-ink ${LINK}`}>
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size print asset, no optimization wanted in the PDF */}
          <img
            src="/cv-photo.jpg"
            alt=""
            width={320}
            height={400}
            className="h-[25mm] w-[20mm] shrink-0 rounded-[1mm] object-cover"
          />
        </header>

        <CvSection title="Profile">
          <p className="text-pretty">{site.cvProfile}</p>
        </CvSection>

        <CvSection title="Experience">
          <ol className="space-y-[2.4mm]">
            {site.experience.map((job) => (
              <li key={`${job.org}-${job.title}`} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-semibold">
                    {job.title}
                    <span className="font-normal text-muted">, {job.org}</span>
                  </h3>
                  <span className="shrink-0 tabular-nums text-muted">{job.period}</span>
                </div>
                <ul className="mt-[0.8mm] list-disc space-y-[0.4mm] pl-[4mm] marker:text-muted">
                  {job.summary.map((line) => (
                    <li key={line.slice(0, 24)} className="text-pretty">
                      {line}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </CvSection>

        <CvSection title="Selected clients">
          <ul className="flex flex-wrap gap-x-[5mm] gap-y-[0.4mm]">
            {clientsBySector().map((group) => (
              <li key={group.sector}>
                <span className="font-medium">{group.sector}:</span> {group.names.join(", ")}
              </li>
            ))}
          </ul>
        </CvSection>

        <CvSection title="Talk">
          <p>
            <a href={talk.url} className={`font-medium ${LINK}`}>
              {talk.title}
            </a>
            <span className="block text-muted">{talk.event}</span>
          </p>
        </CvSection>

        <CvSection title="Skills">
          <ul className="space-y-[0.4mm]">
            {site.skills.map((group) => (
              <li key={group.group} className="text-pretty">
                <span className="font-medium">{group.group}:</span> {group.items.join(", ")}
              </li>
            ))}
          </ul>
        </CvSection>

        <CvSection title="Education & certification">
          <ul className="space-y-[0.4mm]">
            {site.credentials.map((credential) => (
              <li key={credential}>{credential}</li>
            ))}
          </ul>
        </CvSection>

        <CvSection title="Languages">
          <ul className="flex flex-wrap gap-x-[5mm]">
            {site.languages.map((lang) => (
              <li key={lang.name}>
                {lang.name} <span className="text-muted">({lang.level})</span>
              </li>
            ))}
          </ul>
        </CvSection>
      </main>
    </div>
  );
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-[3mm] grid grid-cols-[26mm_1fr] gap-x-[5mm] border-t border-line pt-[2.8mm]">
      <h2 className="font-semibold text-accent">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

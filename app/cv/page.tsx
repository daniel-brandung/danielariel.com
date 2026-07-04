import type { Metadata } from "next";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: `CV — ${site.name}`,
  robots: { index: false, follow: false },
};

export default function CvPage() {
  return (
    <div className="min-h-svh bg-white">
      <main className="mx-auto max-w-[760px] bg-white p-10 font-sans text-neutral-900 print:p-0">
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
        <div>
          <h1 className="text-3xl font-bold">{site.name}</h1>
          <p className="mt-1 text-lg">Senior AI Consultant &amp; Senior Frontend Developer</p>
          <p className="mt-2 text-sm text-neutral-600">
            {site.location} · {site.email} · linkedin.com/in/danielariel · danielariel.com
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size print asset, no optimization wanted in the PDF */}
        <img
          src="/cv-photo.jpg"
          alt=""
          width={96}
          height={96}
          className="size-24 shrink-0 rounded-full object-cover"
        />
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Profile</h2>
        <p className="mt-2 text-sm leading-relaxed">{site.about.join(" ")}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
          Experience
        </h2>
        {site.experience.map((job) => (
          <div key={`${job.org}-${job.title}`} className="mt-4">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-semibold">
                {job.title} — {job.org}
              </h3>
              <span className="shrink-0 text-sm text-neutral-500">{job.period}</span>
            </div>
            <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed">
              {job.summary.map((line) => (
                <li key={line.slice(0, 24)}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Skills</h2>
        {site.skills.map((group) => (
          <p key={group.group} className="mt-2 text-sm">
            <span className="font-semibold">{group.group}:</span> {group.items.join(", ")}
          </p>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
            Education &amp; Certification
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {site.credentials.map((credential) => (
              <li key={credential}>{credential}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
            Languages
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {site.languages.map((lang) => (
              <li key={lang.name}>
                {lang.name} — {lang.level}
              </li>
            ))}
          </ul>
        </div>
      </section>
      </main>
    </div>
  );
}

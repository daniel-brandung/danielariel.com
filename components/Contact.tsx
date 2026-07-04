"use client";

import { useState } from "react";
import { Reveal } from "@/components/Reveal";
import { Section } from "@/components/Section";
import { site } from "@/lib/content";

export function Contact() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(site.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${site.email}`;
    }
  };

  return (
    <Section id="contact" number="05" title="Contact">
      <Reveal>
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
          Let’s build something.
        </h2>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Open to senior frontend roles and AI consulting engagements — in English,
          Hebrew, or German.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={`mailto:${site.email}`}
            className="rounded bg-accent px-6 py-3 font-mono text-bg transition-colors hover:bg-accent-soft"
          >
            {site.email}
          </a>
          <button
            onClick={copyEmail}
            className="rounded border border-line px-4 py-3 font-mono text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-line px-6 py-3 text-ink transition-colors hover:border-accent hover:text-accent"
          >
            LinkedIn
          </a>
        </div>
      </Reveal>
    </Section>
  );
}

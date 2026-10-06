import Image from "next/image";
import { RoleRotator } from "@/components/RoleRotator";
import { SpecBox, SpecGap, SpecLabel, SpecPalette } from "@/components/Specs";
import { site } from "@/lib/content";

// One orchestrated intro: the name rises, the photo wipes up, the copy
// follows, then the redlines draw over the finished hero. The CSS parts run
// before hydration; the spec delays (seconds) start once React mounts.
const at = (ms: number) => ({ animationDelay: `${ms}ms` });

export function Hero() {
  const [first, last] = site.name.split(" ");
  return (
    <section
      id="top"
      className="mx-auto max-w-[1200px] px-5 pb-12 pt-32 md:px-12 md:pb-16 md:pt-44"
    >
      <div className="flex flex-col gap-16 lg:flex-row lg:items-start lg:justify-between lg:gap-24">
        <div className="min-w-0 flex-1">
          <h1 className="relative w-fit text-[52px]/[56px] font-semibold tracking-[-0.02em] md:text-[88px]/[92px]">
            <SpecLabel className="-top-9 left-0 max-md:hidden" delay={1.2}>
              IBM Plex Sans 600, 88/92, -0.02em
            </SpecLabel>
            <span className="inline-block overflow-hidden align-top">
              <span className="intro-rise" style={at(60)}>
                {first}
              </span>
            </span>{" "}
            <span className="inline-block overflow-hidden align-top">
              <span className="intro-rise" style={at(150)}>
                {last}
              </span>
            </span>
            <SpecBox className="max-md:hidden" delay={1.1} />
          </h1>

          <div className="relative mt-6">
            <SpecGap size={24} className="-top-6 left-0 max-md:hidden" delay={1.3} />
            <p
              className="intro-fade text-[20px]/[28px] font-medium md:text-[22px]/[30px]"
              style={at(350)}
            >
              <RoleRotator roles={site.roles} />
            </p>
          </div>

          <p
            className="intro-fade mt-5 max-w-[34em] text-balance text-[18px]/[29px] text-muted md:text-[19px]/[30px]"
            style={at(450)}
          >
            {site.tagline}
          </p>

          <div className="intro-fade relative mt-9 flex flex-wrap gap-3" style={at(550)}>
            <a
              href="#contact"
              className="inline-flex h-12 items-center rounded bg-ink px-6 font-medium text-white transition-colors hover:bg-accent"
            >
              Get in touch
            </a>
            <a
              href={site.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center rounded border border-ink bg-bg px-6 font-medium transition-colors hover:border-accent hover:text-accent"
            >
              LinkedIn
            </a>
            <SpecLabel className="left-0 top-[calc(100%+10px)]" delay={1.45}>
              height 48, radius 4
            </SpecLabel>
          </div>

          <SpecPalette className="mt-16" delay={1.6} />
        </div>

        <figure className="w-full max-w-[360px] shrink-0 lg:w-[360px]">
          <div className="relative">
            <div className="intro-wipe overflow-hidden rounded" style={at(250)}>
              <Image
                src="/daniel-ariel.jpg"
                alt={`Portrait of ${site.name}`}
                width={640}
                height={800}
                sizes="360px"
                loading="eager"
                fetchPriority="high"
                className="intro-settle block aspect-[4/5] w-full object-cover"
                style={at(250)}
              />
            </div>
            <SpecBox delay={1.25} />
            <SpecLabel className="right-3 top-3" delay={1.4}>
              4:5, object-fit: cover
            </SpecLabel>
            <SpecLabel className="-bottom-2.5 left-3 max-md:hidden" delay={1.5}>
              360 × 450
            </SpecLabel>
          </div>
          <figcaption className="intro-fade mt-5 text-[15px]/6 text-muted" style={at(750)}>
            {site.photoCaption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

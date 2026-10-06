"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
import { useSpecs } from "@/components/Specs";
import { site } from "@/lib/content";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 40,
    restDelta: 0.001,
  });

  useEffect(() => {
    const ids = site.nav.map((item) => item.href.slice(1));
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const probe = window.scrollY + window.innerHeight * 0.4;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= probe) current = `#${id}`;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open ? "border-line bg-bg/85 backdrop-blur-md" : "border-transparent"
      }`}
    >
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 origin-left bg-accent"
        style={{ scaleX: reduce ? scrollYProgress : smoothProgress }}
      />
      <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-5 md:px-12">
        <a href="#top" className="text-[17px] font-semibold tracking-[-0.01em]">
          {site.name}
        </a>
        <div className="hidden items-center gap-7 lg:flex">
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`group relative py-2 text-[15px] transition-colors hover:text-ink ${
                active === item.href ? "text-ink" : "text-muted"
              }`}
            >
              {item.label}
              <span
                className={`absolute bottom-0.5 left-0 h-px w-full origin-left bg-accent transition-transform duration-300 ${
                  active === item.href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </a>
          ))}
          <SpecsToggle />
          <a
            href={site.cvPath}
            download
            className="inline-flex h-10 items-center rounded border border-ink px-3.5 text-sm font-medium transition-colors hover:bg-ink hover:text-white"
          >
            CV
          </a>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <SpecsToggle />
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex h-11 items-center px-2 text-sm font-medium"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden"
          >
            <div className="mx-auto flex max-w-[1200px] flex-col px-5 pb-6 md:px-12">
              {site.nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`border-b border-line py-3 text-[17px] ${
                    active === item.href ? "text-accent" : "text-ink"
                  }`}
                >
                  {item.label}
                </a>
              ))}
              <a
                href={site.cvPath}
                download
                className="mt-5 inline-flex h-12 w-fit items-center rounded border border-ink px-5 font-medium"
              >
                Download CV
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function SpecsToggle() {
  const { on, toggle } = useSpecs();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      title="Show the spacing and type measurements on this page"
      className={`inline-flex h-11 items-center gap-2 rounded border px-3 lg:h-10 text-sm font-medium transition-colors ${
        on
          ? "border-accent bg-accent text-white hover:bg-accent-soft"
          : "border-accent bg-bg text-accent hover:bg-accent/10"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        <rect x="1.5" y="4.5" width="13" height="7" rx="1" />
        <path d="M4.5 4.5v2.5M7 4.5v1.5M9.5 4.5v2.5M12 4.5v1.5" />
      </svg>
      Specs
    </button>
  );
}

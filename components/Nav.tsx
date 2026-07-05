"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
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
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-line bg-bg/80 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 origin-left bg-accent"
        style={{ scaleX: reduce ? scrollYProgress : smoothProgress }}
      />
      <nav className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6">
        <a href="#top" className="font-mono text-sm tracking-widest text-accent">
          {site.initials}
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`group relative text-sm transition-colors hover:text-ink ${
                active === item.href ? "text-ink" : "text-muted"
              }`}
            >
              {item.label}
              <span
                className={`absolute -bottom-1 left-0 h-px w-full origin-left bg-accent transition-transform duration-300 ${
                  active === item.href ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </a>
          ))}
          <a
            href={site.cvPath}
            download
            className="rounded border border-accent px-3 py-1.5 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
          >
            CV
          </a>
        </div>
        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="font-mono text-sm text-ink md:hidden"
        >
          {open ? "close" : "menu"}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border-b border-line bg-bg/95 backdrop-blur-md md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {site.nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`text-sm hover:text-ink ${
                    active === item.href ? "text-accent" : "text-muted"
                  }`}
                >
                  {item.label}
                </a>
              ))}
              <a href={site.cvPath} download className="font-mono text-sm text-accent">
                Download CV
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

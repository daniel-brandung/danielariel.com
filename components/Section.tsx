import { Reveal } from "@/components/Reveal";

export function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1100px] scroll-mt-24 px-6 py-16 md:py-32">
      <Reveal>
        <p className="mb-2 font-mono text-sm text-accent">
          {number} — {title}
        </p>
        <div className="mb-10 h-px w-full bg-line" />
      </Reveal>
      {children}
    </section>
  );
}

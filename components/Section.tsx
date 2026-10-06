export function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-16 md:px-12 md:py-24">
      <div className="border-t border-line pt-10 md:pt-14">
        <h2 className="text-[30px]/[38px] font-semibold tracking-[-0.015em] md:text-[40px]/[48px]">
          {title}
        </h2>
        {intro && (
          <p className="mt-4 max-w-[36em] text-pretty text-lg/[1.6] text-muted">{intro}</p>
        )}
      </div>
      <div className="mt-12">{children}</div>
    </section>
  );
}

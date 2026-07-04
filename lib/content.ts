export const site = {
  name: "Daniel Ariel",
  initials: "DA",
  location: "Berlin, Germany",
  email: "ariel.daniel@proton.me",
  linkedin: "https://www.linkedin.com/in/danielariel/",
  cvPath: "/daniel-ariel-cv.pdf",
  roles: [
    "Senior AI Consultant",
    "Senior Frontend Developer",
    "Composable Architecture Consultant",
  ],
  tagline:
    "Helping teams ship faster with composable architecture and AI-driven workflows.",
  about: [
    "I'm Daniel — a Senior AI Consultant and Senior Frontend Developer based in Berlin. I help teams ship faster with composable architecture and AI-driven workflows.",
    "On the frontend, I craft robust web experiences with React, Next.js, TypeScript, and GraphQL — with meticulous attention to CSS and semantic HTML. On the AI side, I introduce AI-assisted development workflows to engineering teams, integrate LLM-powered features into products, and advise stakeholders on where AI genuinely adds value.",
    "With a background as a teaching fellow in economics and a PSPO I certificate, I bring analytical rigor and open communication to every phase of the product lifecycle — in English, Hebrew, or German.",
  ],
  whatIDo: [
    {
      glyph: "✦",
      title: "AI Consulting",
      bullets: [
        "AI-assisted development workflows and agentic coding — introduced, coached, and measured",
        "LLM-powered features integrated into client products",
        "AI-supported content pipelines in composable CMS stacks",
        "Use-case evaluation, tooling selection, and rollout advisory",
      ],
    },
    {
      glyph: "</>",
      title: "Frontend Engineering",
      bullets: [
        "Enterprise web platforms with React, Next.js, TypeScript, and GraphQL",
        "Composable architecture: headless CMS, design systems",
        "Meticulous CSS and semantic HTML",
        "Core Web Vitals performance optimization",
      ],
    },
  ],
  experience: [
    {
      title: "Senior AI Consultant & Senior Frontend Developer",
      org: "BRANDUNG",
      period: "Mar 2025 — Present",
      summary: [
        "Deliberate return to hands-on engineering — doubling down on technical depth in frontend and AI.",
        "Introducing AI-assisted development workflows, integrating LLM-powered features, and building AI-supported content pipelines in composable CMS stacks.",
        "Building enterprise web platforms with React, Next.js, TypeScript, and GraphQL.",
      ],
    },
    {
      title: "Business Director",
      org: "BRANDUNG",
      period: "Jun 2023 — Mar 2025",
      summary: [
        "Leadership chapter on the business side — closer to clients, strategy, and delivery.",
        "After parental leave, made a conscious choice of craft over the management track and returned to an IC role.",
      ],
    },
    {
      title: "Frontend Web Developer",
      org: "BRANDUNG",
      period: "Oct 2018 — Jul 2023",
      summary: [
        "Nearly five years building and shipping web platforms for enterprise clients.",
      ],
    },
    {
      title: "Full Stack Web Developer (Bootcamp)",
      org: "SPICED Academy",
      period: "Feb 2018 — May 2018",
      summary: [
        "Intensive full-stack bootcamp across the JavaScript ecosystem.",
      ],
    },
    {
      title: "Teaching Fellow",
      org: "The Academic College of Tel-Aviv, Yaffo",
      period: "Oct 2014 — Oct 2016",
      summary: [
        "Taught economics — the origin of the analytical, communication-first approach I bring to teams.",
      ],
    },
  ],
  skills: [
    {
      group: "Frontend",
      items: [
        "Next.js",
        "React",
        "TypeScript",
        "JavaScript",
        "GraphQL",
        "CSS & semantic HTML",
        "Tailwind CSS",
      ],
    },
    {
      group: "AI",
      items: [
        "AI-assisted development",
        "LLM integration",
        "Agentic coding workflows",
        "AI content pipelines",
      ],
    },
    {
      group: "Practices",
      items: [
        "Composable architecture",
        "Design systems",
        "Core Web Vitals",
        "Agile & Scrum",
      ],
    },
  ],
  credentials: [
    "PSPO I — Professional Scrum Product Owner (Scrum.org)",
    "MA Economics — Tel Aviv University",
  ],
  languages: [
    { name: "Hebrew", level: "Native" },
    { name: "English", level: "Full professional" },
    { name: "German", level: "Professional working" },
  ],
  nav: [
    { label: "About", href: "#about" },
    { label: "What I Do", href: "#what-i-do" },
    { label: "Experience", href: "#experience" },
    { label: "Skills", href: "#skills" },
    { label: "Contact", href: "#contact" },
  ],
} as const;

export type Site = typeof site;

import { About } from "@/components/About";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { WhatIDo } from "@/components/WhatIDo";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <WhatIDo />
      </main>
    </>
  );
}

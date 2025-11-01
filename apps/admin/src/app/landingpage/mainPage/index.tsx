import { useState } from "react";

import { WelcomeSection } from "./welcome";
import { HeaderSection } from "./header";
import { HeroSection } from "./hero";
import { ModelsSection } from "./models";
import { VideoSection } from "./video";
import { RequirementsSection } from "./requirements";
import { Footer } from "./footer";
import { MiniWorld } from "./miniWorld";

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* HEADER */}
      <HeaderSection
        menuOpen={menuOpen}
        handleMenuOpen={setMenuOpen}
        color="white"
      />

      <main className="relative min-h-screen">
        {/* HERO */}
        <HeroSection />

        {/* MODELS */}
        <ModelsSection />

        {/*  VIDEO  */}
        <VideoSection />

        {/*  WELCOME   */}
        <WelcomeSection />

        {/* Requirements */}
        <RequirementsSection />

        {/* MINI World */}
        <MiniWorld />

        {/* About SEO */}
        {/* <AboutSection /> */}
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}

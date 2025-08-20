import { useState } from "react";

import { WelcomeSection } from "./welcome";
import { HeaderSection } from "./header";
import { HeroSection } from "./hero";
import { ModelsSection } from "./models";
import { VideoSection } from "./video";

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="relative min-h-screen">
      {/* HEADER */}
      <HeaderSection menuOpen={menuOpen} handleMenuOpen={setMenuOpen} />

      {/* HERO */}
      <HeroSection />

      {/* MODELS */}
      <ModelsSection />

      {/* === VIDEO === */}
      <VideoSection />

      {/* === WELCOME  === */}
      <WelcomeSection />
    </main>
  );
}

import { useState } from "react";

import { WelcomeSection } from "./welcome";
import { HeaderSection } from "./header";
import { HeroSection } from "./hero";
import { ModelsSection } from "./models";
import { VideoSection } from "./video";

export default function MiniRentalHero() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-black text-white">
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
    </div>
  );
}

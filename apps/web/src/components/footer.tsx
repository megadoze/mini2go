/* eslint-disable @next/next/no-img-element */
import { LanguagePicker } from "@/utils/languagePicker";

export function Footer() {
  return (
    <footer className="bg-black text-white mt-24">
      {/* TOP */}
      <div className="w-full max-w-[1200px] mx-auto px-4 py-14 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-12">
          {/* Region / Language */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-white/80">
              Region & Language
            </h4>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LanguagePicker />
            </div>

            {/* App badges (опционально) */}
            {/* <div className="mt-6 flex items-center gap-3">
              <a
                href="#"
                className="h-10 rounded-lg border border-white/20 px-3 flex items-center hover:bg-white/10 text-xs"
              >
                App Store
              </a>
              <a
                href="#"
                className="h-10 rounded-lg border border-white/20 px-3 flex items-center hover:bg-white/10 text-xs"
              >
                Google Play
              </a>
            </div> */}
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-white/80">
              Explore
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Rental
                </a>
              </li>
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Subscribe
                </a>
              </li>
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Models
                </a>
              </li>
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-white/80">
              Help
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  FAQ
                </a>
              </li>
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Minimum Requirements
                </a>
              </li>
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Insurance & Coverage
                </a>
              </li>
              <li>
                <a className="hover:underline hover:text-white/90" href="#">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          {/* Socials (с заголовком) */}
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-white/80 text-center sm:text-left">
              Follow us
            </h4>

            <div className="mt-4 flex items-center justify-center sm:justify-start gap-4">
              <a
                href="#"
                aria-label="Instagram"
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M12 7a5 5 0 105 5 5 5 0 00-5-5zm0 8.2A3.2 3.2 0 1115.2 12 3.2 3.2 0 0112 15.2zM17.4 6.6a1.2 1.2 0 111.2-1.2 1.2 1.2 0 01-1.2 1.2z" />
                  <path d="M17.8 2H6.2A4.2 4.2 0 002 6.2v11.6A4.2 4.2 0 006.2 22h11.6A4.2 4.2 0 0022 17.8V6.2A4.2 4.2 0 0017.8 2zm2.4 15.8a2.4 2.4 0 01-2.4 2.4H6.2a2.4 2.4 0 01-2.4-2.4V6.2a2.4 2.4 0 012.4-2.4h11.6a2.4 2.4 0 012.4 2.4z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="YouTube"
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.2 3.5 12 3.5 12 3.5s-7.2 0-9.4.6A3 3 0 00.5 6.2 31.2 31.2 0 000 12a31.2 31.2 0 00.5 5.8 3 3 0 002.1 2.1C4.8 20.5 12 20.5 12 20.5s7.2 0 9.4-.6a3 3 0 002.1-2.1A31.2 31.2 0 0024 12a31.2 31.2 0 00-.5-5.8zM9.6 15.6V8.4L15.8 12z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M13.5 22v-8h2.7l.4-3h-3.1V8.4c0-.9.2-1.5 1.6-1.5h1.6V4.2A22.5 22.5 0 0014.6 4a3.8 3.8 0 00-4.1 4.2V11H7.5v3h3v8z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="X"
                className="p-2 rounded-full hover:bg-white/10 transition"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M18.9 3H21l-6.7 7.7L22 21h-5.3l-4.2-5-4.8 5H3l7.4-8.3L2.3 3h5.4l3.8 4.6zM16.4 19h1.5L7.7 5H6.2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 border-t border-white/10 pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Legal links */}
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/70">
              <a href="#" className="hover:text-white/90 hover:underline">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white/90 hover:underline">
                Terms & Conditions
              </a>
              <a href="#" className="hover:text-white/90 hover:underline">
                Imprint
              </a>
              <a href="#" className="hover:text-white/90 hover:underline">
                Cookie Settings
              </a>
            </nav>

            {/* Copyright */}
            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} MINI2GO. All rights reserved.
            </p>
          </div>

          {/* Small print */}
          <p className="mt-6 text-xs text-white/50 max-w-[80ch]">
            Images shown for illustration only and may include optional
            equipment. Availability, pricing and conditions depend on region and
            selected model.
          </p>
          {/* Bottom centered brand */}
          <div className="mt-10 flex flex-col items-center">
            <a
              href="#"
              className="flex flex-col items-center shrink-0 font-roboto uppercase font-bold"
            >
              <img src="/icons/logow.png" className="w-20" alt="logo mini2go" />
              <p className="text-white text-sm mt-2">MINI2GO</p>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

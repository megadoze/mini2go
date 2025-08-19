import { NAV } from "@/constants/carOptions";
import { Burger, Drawer } from "@mantine/core";
import type { Dispatch, SetStateAction } from "react";

type HeaderMenuProps = {
  menuOpen: boolean;
  handleMenuOpen: Dispatch<SetStateAction<boolean>>;
};

export const HeaderLanding = ({
  menuOpen,
  handleMenuOpen,
}: HeaderMenuProps) => {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-50 transition-colors duration-300 ">
        <div className="px-4 sm:px-6 lg:px-10">
          <div className="flex h-16 items-center justify-between gap-6">
            <a href="#" className="shrink-0 font-bold tracking-wide text-lg">
              MINI2GO
            </a>
            <nav className="mx-auto hidden lg:block">
              <ul className="flex items-center gap-6 xl:gap-8 text-sm font-medium">
                {NAV.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="hover:text-white/90 text-white/80 transition"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="w-24 flex justify-end">
              <button className="hidden lg:inline-flex font-medium text-sm text-white/90 hover:text-white transition">
                Log In
              </button>
              <Burger
                opened={menuOpen}
                onClick={() => handleMenuOpen((v: any) => !v)}
                color="#fff"
                size="sm"
                aria-label="Toggle menu"
                className="lg:hidden h-10 w-10 rounded-md ring-1 ring-white/20 hover:ring-white/40"
              />
            </div>
          </div>
        </div>

        <Drawer
          opened={menuOpen}
          onClose={() => handleMenuOpen(false)}
          position="left"
          size="100%"
          withCloseButton
          title={null}
          padding={0}
          radius={0}
          overlayProps={{ opacity: 0.55, blur: 2 }}
          styles={{
            content: {
              backgroundColor: "rgba(0,0,0,0.95)",
              border: "none",
              boxShadow: "none",
            },
            header: { background: "transparent", borderBottom: "none" },
            body: { padding: 0 },
            title: { color: "#fff" },
            close: { color: "white", marginRight: "14px", marginTop: "4px" },
          }}
        >
          <div className="text-white min-h-[100dvh] px-6 py-8">
            <ul className="flex flex-col gap-4 text-2xl">
              {NAV.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="block py-2 text-white/90 hover:text-white"
                    onClick={() => handleMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <button
                className="w-full rounded-xl ring-1 ring-white/20 px-4 py-3 text-base hover:ring-white/40"
                onClick={() => handleMenuOpen(false)}
              >
                Log In
              </button>
            </div>
          </div>
        </Drawer>
      </header>
    </>
  );
};

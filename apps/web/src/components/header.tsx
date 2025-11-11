/* eslint-disable @next/next/no-img-element */

import { NAV } from "@/constants/carOptions";
import { ChevronRightIcon, FingerPrintIcon } from "@heroicons/react/24/outline";
import { Burger, Drawer } from "@mantine/core";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";

type HeaderMenuProps = {
  menuOpen: boolean;
  handleMenuOpen: Dispatch<SetStateAction<boolean>>;
  color: string;
};

export const HeaderSection = ({
  menuOpen,
  handleMenuOpen,
  color,
}: HeaderMenuProps) => {
  return (
    <header className="absolute inset-x-0 top-0 z-50 transition-colors duration-300">
      <div className="flex justify-between items-center px-4 sm:px-6 lg:px-10 mt-3">
        <div>
          <Burger
            opened={menuOpen}
            onClick={() => handleMenuOpen((v: any) => !v)}
            color={color}
            size="sm"
            aria-label="Toggle menu"
            className=" h-10 w-10 rounded-md"
          />
        </div>

        <div className="w-14 md:w-20">
          <Link
            href="/"
            className="flex flex-col items-center shrink-0 font-montserrat uppercase font-bold "
          >
            <img
              src={color === "white" ? `/icons/logow.png` : `/icons/logo.png`}
              className="w-14 md:w-20 h-8 md:h-11"
              alt="mini2go logo"
            />
            <p className={` text-${color} text-xs md:text-sm`}>MINI2GO</p>
          </Link>
        </div>

        <button
          className={` lg:inline-flex font-robotoCondensed font-medium text-${color} hover:text-${color} transition`}
        >
          <FingerPrintIcon className=" w-6" />
        </button>
      </div>

      <Drawer
        opened={menuOpen}
        onClose={() => handleMenuOpen(false)}
        position="left"
        size="md"
        withCloseButton
        title={null}
        padding={0}
        radius={0}
        overlayProps={{ opacity: 0.55, blur: 2 }}
        styles={{
          content: {
            backgroundColor: "white",
            border: "none",
            boxShadow: "none",
          },
          header: {
            background: "transparent",
            borderBottom: "none",
            marginLeft: "54px",
          },
          body: { padding: 0 },
          title: { color: "black", fontSize: "20px" },
          close: { marginRight: "54px", marginTop: "4px" },
        }}
      >
        <div className="px-10 py-8">
          <ul className="flex flex-col gap-4 text-xl md:text-2xl">
            {NAV.map((item) => (
              <li
                key={item.label}
                className=" hover:bg-neutral-100 rounded-md transition duration-300 ease-in-out py-1"
              >
                <Link
                  href={item.href}
                  className="flex items-center justify-between py-3 text-black font-roboto-condensed px-4"
                  onClick={() => handleMenuOpen(false)}
                >
                  <p>{item.label}</p>
                  <ChevronRightIcon className=" w-6 text-neutral-500" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <button
              className="w-full font-roboto-condensed rounded-xl ring-1 ring-black/80 px-4 py-3 text-base hover:ring-black/50"
              onClick={() => handleMenuOpen(false)}
            >
              Log In
            </button>
          </div>
        </div>
      </Drawer>
    </header>
  );
};

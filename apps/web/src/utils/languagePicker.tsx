import { useEffect, useRef, useState } from "react";

type LanguageOption = {
  locale: string;
  label: string;
  flag: string; // emoji-флаг
};

const LANG_OPTIONS: LanguageOption[] = [
  { locale: "en-GB", label: "International — English", flag: "🇬🇧" },
  { locale: "es-ES", label: "Spain — Spanish", flag: "🇪🇸" },
  { locale: "de-DE", label: "Germany — German", flag: "🇩🇪" },
];

export function LanguagePicker() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LanguageOption>(LANG_OPTIONS[0]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] leading-none ring-1 ring-white/15">
          {selected.flag}
        </span>
        {selected.label}
        <svg
          className="ml-1 h-4 w-4 opacity-70"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.104l3.71-3.872a.75.75 0 111.08 1.04l-4.24 4.424a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-72 rounded-xl border border-white/10 bg-black/95 p-2 backdrop-blur"
        >
          {LANG_OPTIONS.map((opt) => {
            const active = opt.locale === selected.locale;
            return (
              <button
                key={opt.locale}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setSelected(opt);
                  setOpen(false);
                  // TODO: здесь можно повесить смену локали роутера/стора
                }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] leading-none ring-1 ring-white/15">
                  {opt.flag}
                </span>
                <span className="grow">{opt.label}</span>
                {active && (
                  <svg
                    className="h-4 w-4 opacity-80"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M16.704 5.29a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3-3A1 1 0 015.29 9.79l2.293 2.293 6.793-6.793a1 1 0 011.328 0z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

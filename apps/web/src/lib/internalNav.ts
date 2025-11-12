// lib/internalNav.ts
export function markInternalNavigation(from?: string) {
  try {
    sessionStorage.setItem("__internal_nav__", from ?? "1");
  } catch {}
}

export function consumeInternalNavigation(): string | null {
  try {
    const v = sessionStorage.getItem("__internal_nav__");
    if (v) {
      sessionStorage.removeItem("__internal_nav__");
      return v;
    }
  } catch {}
  return null;
}

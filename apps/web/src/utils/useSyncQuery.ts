import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";

export function useSyncQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const base =
        typeof window !== "undefined"
          ? searchParams?.toString()
            ? searchParams.toString()
            : window.location.search.replace(/^\?/, "")
          : searchParams?.toString() ?? "";

      const params = new URLSearchParams(base);

      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      });

      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;

      try {
        router.replace(href);
      } catch (err) {
        console.warn("[updateQuery] router.replace failed:", err);
      }

      setTimeout(() => {
        if (typeof window === "undefined") return;
        const current =
          window.location.pathname + (window.location.search || "");
        if (current !== href) {
          window.history.replaceState({}, "", href);
        }
      }, 50);
    },
    [router, pathname, searchParams]
  );

  return updateQuery;
}

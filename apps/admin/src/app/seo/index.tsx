// pages/AdminSeoCarsList.tsx
import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  Badge,
  Drawer,
  Loader,
  NativeSelect,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  GlobeAltIcon,
  MapPinIcon,
  EyeIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { fetchSeoCarsPage } from "@/services/seo.service";
import { seoSave, seoTemplate } from "@/services/seoActions.service";
import type { SeoCarRow } from "@/types/seoCarRow";
import { SeoEditModal } from "@/components/seoEditModal";
import { highlightMatch } from "@/utils/highlightMatch";

const PAGE_SIZE = 10;
const QK_SEO = ["seoCars", PAGE_SIZE] as const;

type Page = { items: SeoCarRow[]; count: number };
type SeoFilter = "" | "auto" | "custom" | "no";
type SortKey = "updated";

function seoBadge(row: SeoCarRow) {
  if (!row.seo_exists)
    return (
      <Badge className="pointer-events-none" color="gray">
        No SEO
      </Badge>
    );
  if (row.seo_is_custom)
    return (
      <Badge className="pointer-events-none" color="dark">
        Custom
      </Badge>
    );
  return (
    <Badge className="pointer-events-none" color="blue">
      Auto
    </Badge>
  );
}

function carLabel(r: SeoCarRow) {
  return `${r.brand_name} ${r.model_name} ${r.year ?? ""}`.trim();
}

function extractErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as any;
  return anyErr?.message ?? anyErr?.error?.message ?? fallback;
}

function formatUpdated(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSeoCarsList() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // filters
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [seoFilter, setSeoFilter] = useState<SeoFilter>("");

  // sorting
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [reversed, setReversed] = useState(true); // newest first by default

  // mobile filters drawer
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const currentKey = QK_SEO;

  const q = useInfiniteQuery<Page, Error>({
    queryKey: currentKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const pageIndex = typeof pageParam === "number" ? pageParam : 0;
      return fetchSeoCarsPage({
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      });
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((acc, p) => acc + p.items.length, 0);
      const total = last.count ?? loaded;
      return loaded < total ? all.length : undefined;
    },

    // instant from cache
    initialData: () => qc.getQueryData<InfiniteData<Page>>(currentKey),
    placeholderData: (prev) => prev,

    staleTime: 60_000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const trimToFirstPage = () => {
    qc.setQueryData<InfiniteData<Page>>(currentKey, (old) => {
      if (!old?.pages?.length) return old;
      return { pages: [old.pages[0]], pageParams: [0] };
    });
  };

  useEffect(() => {
    return () => {
      trimToFirstPage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = useMemo(() => q.data?.pages ?? [], [q.data]);
  const rows = useMemo(() => pages.flatMap((p) => p.items) ?? [], [pages]);

  const editingRow = useMemo(
    () => rows.find((r) => r.car_id === editingId) ?? null,
    [rows, editingId]
  );

  // filter options from loaded data
  const countries = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.country_name) s.add(r.country_name);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const locationsByCountry = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const c = r.country_name ?? "";
      const l = r.location_name ?? "";
      if (!c || !l) continue;
      if (!map.has(c)) map.set(c, new Set<string>());
      map.get(c)!.add(l);
    }
    return map;
  }, [rows]);

  const locations = useMemo(() => {
    if (!countryFilter) return [];
    const set = locationsByCountry.get(countryFilter);
    if (!set) return [];
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countryFilter, locationsByCountry]);

  const filtered = useMemo(() => {
    const qText = search.trim().toLowerCase();
    let arr = rows;

    if (qText) {
      arr = arr.filter((r) => {
        const hay = `${r.brand_name ?? ""} ${r.model_name ?? ""} ${
          r.year ?? ""
        } ${r.license_plate ?? ""} ${r.vin ?? ""}`.toLowerCase();
        return hay.includes(qText);
      });
    }

    if (countryFilter) {
      arr = arr.filter((r) => (r.country_name ?? "") === countryFilter);
    }
    if (locationFilter) {
      arr = arr.filter((r) => (r.location_name ?? "") === locationFilter);
    }

    if (seoFilter) {
      if (seoFilter === "no") arr = arr.filter((r) => !r.seo_exists);
      if (seoFilter === "custom")
        arr = arr.filter((r) => !!r.seo_exists && !!r.seo_is_custom);
      if (seoFilter === "auto")
        arr = arr.filter((r) => !!r.seo_exists && !r.seo_is_custom);
    }

    return arr;
  }, [rows, search, countryFilter, locationFilter, seoFilter]);

  const updatedTs = (r: SeoCarRow) => {
    const v = r.seo_updated_at ?? r.created_at ?? null;
    const t = v ? new Date(v).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };

  const filteredSorted = useMemo(() => {
    const arr = [...filtered];

    if (sortBy === "updated") {
      arr.sort((a, b) => {
        const diff = updatedTs(a) - updatedTs(b);
        return reversed ? -diff : diff;
      });
    }

    return arr;
  }, [filtered, sortBy, reversed]);

  const setSorting = (key: SortKey) => {
    if (key === sortBy) setReversed((p) => !p);
    else {
      setSortBy(key);
      setReversed(true); // newest first
    }
  };

  const SortButton = ({
    label,
    active,
    desc,
    onClick,
  }: {
    label: string;
    active: boolean;
    desc: boolean;
    onClick: () => void;
  }) => (
    <UnstyledButton
      onClick={onClick}
      className="inline-flex items-center gap-1 group"
    >
      <span className="text-sm text-gray-800 group-hover:text-gray-900">
        {label}
      </span>
      {active ? (
        desc ? (
          <ChevronDownIcon className="size-3 text-gray-700" />
        ) : (
          <ChevronUpIcon className="size-3 text-gray-700" />
        )
      ) : (
        <ChevronUpDownIcon className="size-4 text-gray-600" />
      )}
    </UnstyledButton>
  );

  const patchRow = (car_id: string, next: Partial<SeoCarRow>) => {
    qc.setQueryData<InfiniteData<Page>>(currentKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          items: p.items.map((it) =>
            it.car_id === car_id ? { ...it, ...next } : it
          ),
        })),
      };
    });
  };

  const onSave = async (
    row: SeoCarRow,
    title: string,
    description: string,
    isCustom: boolean
  ) => {
    try {
      const res = await seoSave(row.car_id, title, description, isCustom);
      const seo = res?.seo;

      patchRow(row.car_id, {
        seo_exists: true,
        seo_is_custom: seo?.is_custom ?? isCustom,
        seo_title: seo?.seo_title ?? title,
        seo_description: seo?.seo_description ?? description,
        seo_updated_at: seo?.updated_at ?? new Date().toISOString(),
      });

      toast.success(
        isCustom
          ? `SEO saved (Custom): ${carLabel(row)}`
          : `SEO saved (Template): ${carLabel(row)}`
      );

      setEditingId(null);
    } catch (e) {
      toast.error(
        extractErrorMessage(e, `Failed to save SEO: ${carLabel(row)}`)
      );
      throw e;
    }
  };

  const resetFilters = () => {
    setSearch("");
    setCountryFilter("");
    setLocationFilter("");
    setSeoFilter("");
    trimToFirstPage();
  };

  const isFetchingNext = q.isFetchingNextPage;
  const totalLoaded = rows.length;
  const totalAvailable = q.data?.pages?.[0]?.count ?? totalLoaded;
  const canLoadMore = totalLoaded < totalAvailable;

  const FilterFields = (
    <>
      {/* Country */}
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <GlobeAltIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={countryFilter}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setCountryFilter(v);
            setLocationFilter("");
          }}
          className="w-full sm:w-auto min-w-[180px] rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        >
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Location */}
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <MapPinIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.currentTarget.value)}
          disabled={!countryFilter}
          className={`w-full sm:w-auto min-w-[180px] rounded-xl pl-9 pr-3 py-2 text-sm shadow-sm transition focus:ring-2 focus:ring-black/10 ${
            !countryFilter
              ? "bg-gray-100/80 text-zinc-400 cursor-not-allowed"
              : "bg-white/60 backdrop-blur-sm hover:bg-white/80"
          }`}
        >
          <option value="">Location</option>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* SEO status */}
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <EyeIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={seoFilter}
          onChange={(e) => setSeoFilter(e.currentTarget.value as SeoFilter)}
          className="w-full sm:w-auto min-w-[180px] rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        >
          <option value="">SEO (all)</option>
          <option value="auto">Auto</option>
          <option value="custom">Custom</option>
          <option value="no">No SEO</option>
        </NativeSelect>
      </div>
    </>
  );

  return (
    <>
      {/* header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            SEO Cars
          </h1>
          {totalLoaded > 0 && <Badge color="black">{totalLoaded}</Badge>}
          {q.isFetching && <Loader size="xs" color="gray" />}
        </div>
      </div>

      {/* Desktop controls */}
      <div className="hidden sm:flex sm:flex-nowrap items-center gap-3 w-full mb-5 overflow-x-auto">
        {FilterFields}

        {/* Search */}
        <div className="relative min-w-[320px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <TextInput
            placeholder="Search brand / model / vin / plate"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={resetFilters}
          className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="Reset filters"
          title="Reset filters"
        >
          <XMarkIcon className="size-5 text-gray-800 stroke-1" />
        </button>
      </div>

      {/* Mobile search */}
      <div className="relative w-full mb-4 sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile filters button */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md bg-black text-white active:opacity-80"
          aria-label="Open filters"
        >
          <FunnelIcon className="size-4" />
          Filters
        </button>
      </div>

      {/* Mobile filters drawer */}
      <Drawer
        opened={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        position="bottom"
        withinPortal
        size="42%"
        padding="md"
        keepMounted
        withCloseButton={false}
        overlayProps={{ opacity: 0.2, blur: 2 }}
        styles={{
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        }}
      >
        <div className="flex flex-col gap-3 mt-2">{FilterFields}</div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-zinc-500 underline underline-offset-4"
          >
            Reset filters
          </button>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(false)}
            className="text-sm text-black"
          >
            Close
          </button>
        </div>
      </Drawer>

      {/* list */}
      <div className="w-full rounded-xl overflow-hidden">
        {/* header row (desktop only) */}
        <div className="hidden md:grid grid-cols-[1.8fr,1.2fr,1.2fr,24px] gap-2 px-2 sm:px-3 py-4 text-xs bg-white border-b border-zinc-100">
          <div className="text-sm text-gray-800">Car</div>
          <div className="text-sm text-gray-800">
            <SortButton
              label="Last updated"
              active={sortBy === "updated"}
              desc={reversed}
              onClick={() => setSorting("updated")}
            />
          </div>
          <div className="text-sm text-gray-800 text-center">SEO</div>
          <div />
        </div>

        {filteredSorted.length === 0 ? (
          <div className="px-3 py-6 text-sm text-zinc-500">No cars found</div>
        ) : (
          <>
            <ul role="list" className="divide-y divide-neutral-200/40">
              {filteredSorted.map((r) => {
                const updated = formatUpdated(
                  r.seo_updated_at ?? r.created_at ?? null
                );

                const title = `${r.brand_name} ${r.model_name} ${
                  r.year ?? ""
                }`.trim();

                return (
                  <li key={r.car_id}>
                    <button
                      type="button"
                      onClick={() => setEditingId(r.car_id)}
                      className={[
                        "w-full text-left",
                        "bg-white hover:bg-emerald-50/40",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20",
                        "px-2 sm:px-3 py-3",
                      ].join(" ")}
                    >
                      {/* MOBILE layout */}
                      <div className="md:hidden flex items-center justify-between gap-3">
                        <div className="w-2/3">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {highlightMatch(title, search)}
                          </div>
                          <div className="text-xs text-zinc-500 truncate mt-0.5">
                            {r.license_plate
                              ? highlightMatch(r.license_plate, search)
                              : "—"}
                            {r.vin ? (
                              <> • {highlightMatch(r.vin, search)}</>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-indigo-600 mt-1">
                            Last updated: {updated}
                          </div>
                        </div>

                        <div className="flex items-center">{seoBadge(r)}</div>

                        <div className="shrink-0 flex items-center gap-2 mt-0.5">
                          <ChevronRightIcon className="size-5 stroke-1 text-gray-700 opacity-60" />
                        </div>
                      </div>

                      {/* DESKTOP layout */}
                      <div className="hidden md:grid grid-cols-[1.8fr,1.2fr,1.2fr,24px] items-center gap-2">
                        {/* car */}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {highlightMatch(title, search)}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {r.license_plate
                              ? highlightMatch(r.license_plate, search)
                              : "—"}
                            {r.vin ? (
                              <> • {highlightMatch(r.vin, search)}</>
                            ) : null}
                          </div>
                        </div>

                        {/* updated */}
                        <div className="text-sm text-gray-800 truncate">
                          {updated}
                        </div>

                        {/* seo */}
                        <div className="mx-auto">{seoBadge(r)}</div>

                        {/* chevron */}
                        <div className="flex justify-end opacity-60">
                          <ChevronRightIcon className="size-5 stroke-1 text-gray-700" />
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Load more */}
            <div className="w-full flex justify-center mt-6 mb-2">
              {canLoadMore ? (
                <button
                  type="button"
                  onClick={() => q.fetchNextPage()}
                  disabled={isFetchingNext}
                  aria-busy={isFetchingNext}
                  className="rounded-2xl bg-black text-white px-4 py-2 text-sm hover:opacity-85 disabled:opacity-60"
                >
                  {isFetchingNext ? "Loading..." : "Show more"}
                </button>
              ) : (
                <div className="text-xs text-zinc-400">
                  There are no more cars
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <SeoEditModal
        opened={!!editingId && !!editingRow}
        row={editingRow}
        onClose={() => setEditingId(null)}
        onSave={(t, d, isCustom) =>
          editingRow ? onSave(editingRow, t, d, isCustom) : Promise.resolve()
        }
        onAutofill={async () => {
          if (!editingRow) return { title: "", description: "" };
          const res = await seoTemplate(editingRow.car_id);
          return {
            title: res?.template?.title ?? "",
            description: res?.template?.description ?? "",
          };
        }}
      />
    </>
  );
}

// pages/AdminSeoCarsList.tsx
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Loader, TextInput, Tooltip } from "@mantine/core";
import type { InfiniteData } from "@tanstack/react-query";

import { fetchSeoCarsPage } from "@/services/seo.service";
import { seoGenerate, seoReset, seoSave } from "@/services/seoActions.service";
import type { SeoCarRow } from "@/types/seoCarRow";
import { SeoEditModal } from "@/components/seoEditModal";
import { toast } from "sonner";

const PAGE_SIZE = 10;
const QK_SEO = ["seoCars", PAGE_SIZE] as const;

type Page = { items: SeoCarRow[]; count: number };

function seoBadge(row: SeoCarRow) {
  if (!row.seo_exists) return <Badge color="gray">No SEO</Badge>;
  if (row.seo_is_custom) return <Badge color="dark">Custom</Badge>;
  return <Badge color="blue">Auto</Badge>;
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

export default function AdminSeoCarsList() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SeoCarRow | null>(null);
  const [busyCarId, setBusyCarId] = useState<string | null>(null);

  const q = useInfiniteQuery<Page, Error>({
    queryKey: QK_SEO,
    queryFn: async ({ pageParam }) => {
      const pageIndex = typeof pageParam === "number" ? pageParam : 0;
      const offset = pageIndex * PAGE_SIZE;
      return fetchSeoCarsPage({ limit: PAGE_SIZE, offset });
    },
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((acc, p) => acc + p.items.length, 0);
      const total = last.count ?? loaded;
      return loaded < total ? all.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 60_000,
  });

  const rows = useMemo(
    () => q.data?.pages.flatMap((p) => p.items) ?? [],
    [q.data]
  );

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => {
      const s = `${r.brand_name} ${r.model_name} ${r.license_plate ?? ""} ${
        r.vin ?? ""
      }`.toLowerCase();
      return s.includes(t);
    });
  }, [rows, search]);

  const patchRow = (car_id: string, next: Partial<SeoCarRow>) => {
    qc.setQueryData<InfiniteData<Page>>(QK_SEO, (old) => {
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

  const onGenerate = async (row: SeoCarRow) => {
    setBusyCarId(row.car_id);
    try {
      const res = await seoGenerate(row.car_id);
      const seo = res?.seo;

      if (seo) {
        patchRow(row.car_id, {
          seo_exists: true,
          seo_is_custom: seo.is_custom,
          seo_title: seo.seo_title,
          seo_description: seo.seo_description,
        });
        toast.success(`SEO generated: ${carLabel(row)}`);
      } else {
        qc.invalidateQueries({ queryKey: QK_SEO });
        toast.success(`SEO up to date: ${carLabel(row)}`);
      }
    } catch (e) {
      toast.error(
        extractErrorMessage(e, `Failed to generate SEO: ${carLabel(row)}`)
      );
    } finally {
      setBusyCarId(null);
    }
  };

  const onReset = async (row: SeoCarRow) => {
    setBusyCarId(row.car_id);
    try {
      const res = await seoReset(row.car_id);
      const seo = res?.seo;

      if (seo) {
        patchRow(row.car_id, {
          seo_exists: true,
          seo_is_custom: seo.is_custom, // ожидаем false
          seo_title: seo.seo_title,
          seo_description: seo.seo_description,
        });
      } else {
        qc.invalidateQueries({ queryKey: QK_SEO });
      }

      toast.success(`SEO reset to Auto: ${carLabel(row)}`);
    } catch (e) {
      toast.error(
        extractErrorMessage(e, `Failed to reset SEO: ${carLabel(row)}`)
      );
    } finally {
      setBusyCarId(null);
    }
  };

  // ✅ onSave теперь принимает isCustom
  // и сохраняет либо Custom, либо Template одной кнопкой "Save"
  const onSave = async (
    row: SeoCarRow,
    title: string,
    description: string,
    isCustom: boolean
  ) => {
    setBusyCarId(row.car_id);
    try {
      // ⚠️ убедись что seoSave обновлён: seoSave(carId, title, desc, isCustom)
      const res = await seoSave(row.car_id, title, description, isCustom);
      const seo = res?.seo;

      patchRow(row.car_id, {
        seo_exists: true,
        seo_is_custom: seo?.is_custom ?? isCustom,
        seo_title: seo?.seo_title ?? title,
        seo_description: seo?.seo_description ?? description,
      });

      toast.success(
        isCustom
          ? `SEO saved (Custom): ${carLabel(row)}`
          : `SEO saved (Template): ${carLabel(row)}`
      );

      setEditing(null); // закрываем только при успехе
    } catch (e) {
      toast.error(
        extractErrorMessage(e, `Failed to save SEO: ${carLabel(row)}`)
      );
      // модалку НЕ закрываем
      throw e;
    } finally {
      setBusyCarId(null);
    }
  };

  const loading =
    !q.data && (q.fetchStatus === "fetching" || q.status === "pending");

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">SEO Cars</h1>
        <div className="w-[360px]">
          <TextInput
            placeholder="Search by brand, model, vin, plate"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 mt-10">
          <Loader size="sm" /> Loading...
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left p-3">Car</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Price</th>
                <th className="text-left p-3">SEO</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isBusy = busyCarId === r.car_id;

                const resetDisabled =
                  !r.seo_exists || !r.seo_is_custom || isBusy;

                const resetTooltip = !r.seo_exists
                  ? "No SEO to reset"
                  : !r.seo_is_custom
                  ? "Reset is available only for Custom SEO"
                  : "Reset to Auto";

                return (
                  <tr key={r.car_id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">
                        {r.brand_name} {r.model_name} {r.year ?? ""}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {r.license_plate ?? ""} {r.vin ? `• ${r.vin}` : ""}
                      </div>
                    </td>
                    <td className="p-3">
                      {r.location_name ?? "—"}
                      {r.country_name ? `, ${r.country_name}` : ""}
                    </td>
                    <td className="p-3">
                      {r.price != null ? `${r.price} ${r.currency ?? ""}` : "—"}
                    </td>
                    <td className="p-3">{seoBadge(r)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg bg-black text-white text-xs hover:opacity-85 disabled:opacity-60"
                          onClick={() => onGenerate(r)}
                          disabled={isBusy}
                          aria-busy={isBusy}
                        >
                          Generate
                        </button>

                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-60"
                          onClick={() => setEditing(r)}
                          disabled={isBusy}
                        >
                          Edit
                        </button>

                        <Tooltip
                          label={resetTooltip}
                          withArrow
                          disabled={!resetDisabled}
                        >
                          <span>
                            <button
                              type="button"
                              className="px-3 py-1 rounded-lg border text-xs hover:bg-zinc-50 disabled:opacity-50"
                              disabled={resetDisabled}
                              onClick={() => onReset(r)}
                            >
                              Reset
                            </button>
                          </span>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="p-6 text-zinc-500" colSpan={5}>
                    No cars found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SeoEditModal
        opened={!!editing}
        row={editing}
        onClose={() => setEditing(null)}
        onSave={(t, d, isCustom) =>
          editing ? onSave(editing, t, d, isCustom) : Promise.resolve()
        }
        onAutofill={async () => {
          if (!editing) return { title: "", description: "" };

          // Auto-fill = reset to template
          const res = await seoReset(editing.car_id);
          const seo = res?.seo;

          return {
            title: seo?.seo_title ?? "",
            description: seo?.seo_description ?? "",
          };
        }}
      />
    </>
  );
}

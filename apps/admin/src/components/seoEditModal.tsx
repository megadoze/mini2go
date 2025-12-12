import { Drawer, TextInput, Textarea, Button } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SeoCarRow } from "@/types/seoCarRow";
import { toast } from "sonner";
import {
  ClipboardIcon,
  CheckIcon,
  CodeBracketSquareIcon,
} from "@heroicons/react/24/outline";

type AutofillResult = { title: string; description: string };
type Tone = "muted" | "warn" | "bad" | "good";

function toneClass(tone: Tone) {
  switch (tone) {
    case "good":
      return "text-emerald-600";
    case "warn":
      return "text-amber-600";
    case "bad":
      return "text-red-600";
    default:
      return "text-zinc-500";
  }
}

function clampHint(count: number, min: number, max: number) {
  if (count === 0)
    return { text: `Recommended: ${min}–${max} chars`, tone: "muted" as const };
  if (count < min)
    return {
      text: `Too short (${count}). Aim for ${min}–${max}.`,
      tone: "warn" as const,
    };
  if (count > max)
    return {
      text: `Too long (${count}). Aim for ${min}–${max}.`,
      tone: "bad" as const,
    };
  return { text: `Good length (${count}).`, tone: "good" as const };
}

function estimateGoogleTitlePx(title: string) {
  const s = title ?? "";
  let px = 0;
  for (const ch of s) {
    if (ch === " ") px += 3.5;
    else if (".,:;|!iIl1".includes(ch)) px += 3.8;
    else if ("mwMW@#%&".includes(ch)) px += 9.5;
    else if (/[A-Z]/.test(ch)) px += 7.2;
    else if (/[0-9]/.test(ch)) px += 6.2;
    else px += 6.6;
  }
  return Math.round(px);
}

function pxHint(px: number, maxPx: number) {
  if (px === 0) return { text: `Target: ≤ ${maxPx}px`, tone: "muted" as const };
  if (px > maxPx)
    return {
      text: `May truncate (${px}px > ${maxPx}px)`,
      tone: "bad" as const,
    };
  if (px > maxPx * 0.9)
    return { text: `Close to limit (${px}px)`, tone: "warn" as const };
  return { text: `Good (${px}px)`, tone: "good" as const };
}

function ellipsize(str: string, maxChars: number) {
  const s = (str ?? "").trim();
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

function wordCount(text: string) {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text ?? "");
    toast.success(`${label} copied`);
    return true;
  } catch {
    toast.error("Copy failed (clipboard blocked)");
    return false;
  }
}

/** Copy button (fixed width, no layout shift) */
export function CopyButton(props: {
  label: string;
  value: string;
  disabled?: boolean;
  kind?: "text" | "json";
}) {
  const { label, value, disabled, kind = "text" } = props;
  const [copied, setCopied] = useState(false);
  const tRef = useRef<number | null>(null);

  const Icon = copied
    ? CheckIcon
    : kind === "json"
    ? CodeBracketSquareIcon
    : ClipboardIcon;

  useEffect(() => {
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, []);

  const onClick = async () => {
    if (!value || disabled) return;
    const ok = await copyToClipboard(value, label);
    if (!ok) return;

    setCopied(true);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => setCopied(false), 900);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !value}
      className={[
        "h-7 px-2 shrink-0 rounded-lg border",
        "inline-flex items-center justify-center",
        "text-xs leading-none",
        "transition-colors duration-150 hover:bg-zinc-50",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        copied
          ? "border-emerald-400 bg-emerald-50"
          : "border-zinc-200 bg-white",
      ].join(" ")}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      <span className="inline-flex items-center justify-center gap-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="relative text-left">
          <span
            className={[
              "absolute inset-0 transition-opacity duration-150",
              copied ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            Copy
          </span>
          <span
            className={[
              "absolute inset-0 transition-opacity duration-150",
              copied ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            Copied
          </span>
          <span className="invisible">Copied</span>
        </span>
      </span>
    </button>
  );
}

type ScoreIssue = { tone: Tone; text: string };
type ScoreResult = { score: number; issues: ScoreIssue[] };

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}
function includesNorm(haystack: string, needle: string) {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return true;
  return h.includes(n);
}
function hasYear(text: string, year?: number | null) {
  if (!year) return false;
  return new RegExp(`\\b${year}\\b`).test(text);
}
function hasPriceLike(text: string) {
  const t = normalize(text);
  return (
    /\bfrom\b\s*\d+/.test(t) ||
    /[$€£]\s*\d+/.test(text) ||
    /\b\d+\s*(eur|usd|gbp)\b/i.test(text)
  );
}
function hasLocationLike(
  titleOrDesc: string,
  location?: string | null,
  country?: string | null
) {
  const t = normalize(titleOrDesc);
  const loc = normalize(location ?? "");
  const c = normalize(country ?? "");
  if (loc && t.includes(loc)) return true;
  if (c && t.includes(c)) return true;
  return false;
}
function hasSpammyPunctuation(text: string) {
  return /([!?.,\-])\1{3,}/.test(text);
}
function hasAllCapsWord(text: string) {
  const words = (text ?? "").split(/\s+/).filter(Boolean);
  return words.some((w) => w.length >= 4 && /^[A-Z0-9]+$/.test(w));
}

function computeSeoScore(params: {
  title: string;
  description: string;
  titlePx: number;
  titleWords: number;
  descWords: number;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  locationName?: string | null;
  countryName?: string | null;
}): ScoreResult {
  const {
    title,
    description,
    titlePx,
    titleWords,
    brand,
    model,
    year,
    locationName,
    countryName,
  } = params;

  const TITLE_MIN = 30;
  const TITLE_MAX = 60;
  const DESC_MIN = 120;
  const DESC_MAX = 160;
  const TITLE_PX_MAX = 580;

  const issues: ScoreIssue[] = [];
  let score = 100;

  const t = title.trim();
  const d = description.trim();
  const tLen = t.length;
  const dLen = d.length;

  if (!tLen) {
    score -= 45;
    issues.push({ tone: "bad", text: "Title is empty." });
  }
  if (!dLen) {
    score -= 35;
    issues.push({ tone: "bad", text: "Description is empty." });
  }

  if (tLen && tLen < TITLE_MIN) {
    score -= 10;
    issues.push({
      tone: "warn",
      text: `Title is short (${tLen}). Aim for ${TITLE_MIN}–${TITLE_MAX}.`,
    });
  } else if (tLen > TITLE_MAX) {
    score -= 10;
    issues.push({
      tone: "warn",
      text: `Title is long (${tLen}). Aim for ${TITLE_MIN}–${TITLE_MAX}.`,
    });
  }

  if (titlePx > TITLE_PX_MAX) {
    score -= 10;
    issues.push({
      tone: "warn",
      text: `Title may truncate in Google (${titlePx}px > ${TITLE_PX_MAX}px).`,
    });
  }

  if (dLen && dLen < DESC_MIN) {
    score -= 8;
    issues.push({
      tone: "warn",
      text: `Description is short (${dLen}). Aim for ${DESC_MIN}–${DESC_MAX}.`,
    });
  } else if (dLen > DESC_MAX + 40) {
    score -= 8;
    issues.push({
      tone: "warn",
      text: `Description is very long (${dLen}). It will likely truncate.`,
    });
  }

  const b = (brand ?? "").trim();
  const m = (model ?? "").trim();
  if (b && !includesNorm(t, b)) {
    score -= 8;
    issues.push({ tone: "warn", text: "Brand is missing in title." });
  }
  if (m && !includesNorm(t, m)) {
    score -= 8;
    issues.push({ tone: "warn", text: "Model is missing in title." });
  }

  if (year && !hasYear(t, year)) {
    score -= 4;
    issues.push({
      tone: "muted",
      text: "Year is not in title (optional but helpful).",
    });
  }

  const hasLoc =
    hasLocationLike(t, locationName, countryName) ||
    hasLocationLike(d, locationName, countryName);
  if (!hasLoc) {
    score -= 6;
    issues.push({
      tone: "muted",
      text: "Location is not mentioned (can improve CTR).",
    });
  }

  if (!hasPriceLike(d)) {
    score -= 3;
    issues.push({
      tone: "muted",
      text: "Price is not mentioned in description (optional).",
    });
  }

  if (titleWords > 14) {
    score -= 4;
    issues.push({
      tone: "muted",
      text: "Title is quite wordy; consider shortening.",
    });
  }
  if (hasSpammyPunctuation(t) || hasSpammyPunctuation(d)) {
    score -= 6;
    issues.push({
      tone: "warn",
      text: "Too much punctuation (may look spammy).",
    });
  }
  if (hasAllCapsWord(t)) {
    score -= 4;
    issues.push({
      tone: "muted",
      text: "ALL CAPS words in title can look spammy.",
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (!issues.length)
    issues.push({ tone: "good", text: "Looks great — no issues detected." });

  return { score, issues };
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "good";
  if (score >= 70) return "warn";
  return "bad";
}

export function SeoEditModal(props: {
  opened: boolean;
  onClose: () => void;
  row: SeoCarRow | null;
  onSave: (
    title: string,
    description: string,
    isCustom: boolean
  ) => Promise<void>;
  onAutofill: () => Promise<AutofillResult>;
}) {
  const { opened, onClose, row, onSave, onAutofill } = props;

  // ✅ full width on mobile, 1/3 on desktop
  const isMobile = useMediaQuery("(max-width: 48em)");
  const drawerSize = isMobile ? "100%" : "33%";

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const [saving, setSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [initialTitle, setInitialTitle] = useState("");
  const [initialDesc, setInitialDesc] = useState("");

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  useEffect(() => {
    const t = row?.seo_title ?? "";
    const d = row?.seo_description ?? "";

    setTitle(t);
    setDesc(d);

    setInitialTitle(t);
    setInitialDesc(d);

    setTemplateTitle("");
    setTemplateDesc("");

    setTemplateLoading(false);
    setSaving(false);
  }, [row?.car_id, row?.seo_title, row?.seo_description]);

  const disabled = !row;
  const busy = saving || templateLoading;

  const titleCount = title.length;
  const descCount = desc.length;
  const titleWords = useMemo(() => wordCount(title), [title]);
  const descWords = useMemo(() => wordCount(desc), [desc]);

  const TITLE_MIN = 30;
  const TITLE_MAX = 60;
  const DESC_MIN = 120;
  const DESC_MAX = 160;

  const titleLenHint = useMemo(
    () => clampHint(titleCount, TITLE_MIN, TITLE_MAX),
    [titleCount]
  );
  const descLenHint = useMemo(
    () => clampHint(descCount, DESC_MIN, DESC_MAX),
    [descCount]
  );

  const TITLE_PX_MAX = 580;
  const titlePx = useMemo(() => estimateGoogleTitlePx(title), [title]);
  const titlePxHint = useMemo(() => pxHint(titlePx, TITLE_PX_MAX), [titlePx]);

  const dirty = useMemo(
    () => title !== initialTitle || desc !== initialDesc,
    [title, desc, initialTitle, initialDesc]
  );

  const previewTitle = useMemo(() => ellipsize(title, 70), [title]);
  const previewDesc = useMemo(() => ellipsize(desc, 170), [desc]);

  const scoreResult = useMemo(() => {
    return computeSeoScore({
      title,
      description: desc,
      titlePx,
      titleWords,
      descWords,
      brand: row?.brand_name,
      model: row?.model_name,
      year: row?.year ?? null,
      locationName: row?.location_name ?? null,
      countryName: row?.country_name ?? null,
    });
  }, [
    title,
    desc,
    titlePx,
    titleWords,
    descWords,
    row?.brand_name,
    row?.model_name,
    row?.year,
    row?.location_name,
    row?.country_name,
  ]);

  const canDetermineCustom =
    templateTitle.trim() !== "" && templateDesc.trim() !== "";

  const willBeCustom = useMemo(() => {
    if (!canDetermineCustom) return true;
    return !(
      title.trim() === templateTitle.trim() &&
      desc.trim() === templateDesc.trim()
    );
  }, [title, desc, templateTitle, templateDesc, canDetermineCustom]);

  const slugBrand = useMemo(
    () => (row?.brand_name ? row.brand_name.toLowerCase() : ""),
    [row?.brand_name]
  );
  const slugModel = useMemo(
    () =>
      row?.model_name
        ? row.model_name.toLowerCase().trim().replace(/\s+/g, "-")
        : "",
    [row?.model_name]
  );

  const handleAutofill = async () => {
    if (!row) return;

    setTemplateLoading(true);
    try {
      const tpl = await onAutofill();
      const t = (tpl.title ?? "").trim();
      const d = (tpl.description ?? "").trim();

      if (!t || !d) {
        toast.error("Template returned empty values");
        return;
      }

      setTitle(t);
      setDesc(d);

      setTemplateTitle(t);
      setTemplateDesc(d);

      toast.success("Template applied");
    } catch (e: any) {
      toast.error(e?.message ?? "Autofill failed");
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleSave = async () => {
    if (!row) return;

    const t = title.trim();
    const d = desc.trim();

    if (!t || !d) {
      toast.error("Title and description are required");
      return;
    }

    const isCustom = willBeCustom;

    setSaving(true);
    try {
      await onSave(t, d, isCustom);
      setInitialTitle(t);
      setInitialDesc(d);
      toast.success(isCustom ? "Saved as Custom" : "Saved as Template");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const jsonValue = useMemo(
    () =>
      JSON.stringify(
        { title: title.trim(), description: desc.trim() },
        null,
        2
      ),
    [title, desc]
  );

  const canAutofill = !!row && !saving;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={drawerSize}
      withCloseButton
      withinPortal
      keepMounted
      overlayProps={{ opacity: 0.2, blur: 2 }}
      styles={{
        content: { borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
        header: { paddingBottom: 6 },
        body: { paddingTop: 8, paddingBottom: 16 },
      }}
      title={
        <div className="flex items-center justify-between w-full pr-2">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Edit SEO (EN)</div>
            <div className="text-xs text-zinc-500 truncate max-w-[260px]">
              {row ? `${row.brand_name} ${row.model_name} ${row.year ?? ""}` : "—"}
            </div>
          </div>
          {dirty && <div className="text-xs text-zinc-500">Unsaved</div>}
        </div>
      }
    >
      {/* SCORE + actions */}
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs text-zinc-500">SEO score (heuristic)</div>
              <div
                className={`text-2xl font-semibold ${toneClass(
                  scoreTone(scoreResult.score)
                )}`}
              >
                {scoreResult.score}
                <span className="text-zinc-400 text-sm font-normal"> / 100</span>
              </div>
            </div>
          </div>

          <Button
            variant="default"
            onClick={handleAutofill}
            disabled={!canAutofill}
            loading={templateLoading}
            className="h-9"
          >
            Auto-fill
          </Button>
        </div>

        <div className="mt-3 space-y-1">
          {scoreResult.issues.slice(0, 6).map((it, idx) => (
            <div key={idx} className={`text-xs ${toneClass(it.tone)}`}>
              • {it.text}
            </div>
          ))}
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Expected facts:{" "}
          <span className="text-zinc-700">
            {row?.brand_name ?? "—"} / {row?.model_name ?? "—"} /{" "}
            {row?.year ?? "—"} / {row?.location_name ?? "—"}
            {row?.country_name ? `, ${row.country_name}` : ""}
          </span>
        </div>
      </div>

      {/* SERP preview */}
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3">
        <div className="text-xs text-zinc-500 mb-1">Preview (approx)</div>

        <div className="text-sm text-blue-700 font-medium leading-snug">
          {previewTitle || "Title preview…"}
        </div>

        <div className="text-xs text-emerald-700 mt-0.5">
          https://mini2go.rent/cars/{slugBrand}/{slugModel}/{row?.car_id ?? "…"}
        </div>

        <div className="text-sm text-zinc-700 mt-1 leading-snug">
          {previewDesc || "Description preview…"}
        </div>
      </div>

      {/* TITLE */}
      <TextInput
        label={
          <div className="flex items-center justify-between pb-1">
            <span className="mr-2">SEO title</span>
            <CopyButton label="Title" value={title} disabled={disabled || busy} />
          </div>
        }
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        disabled={disabled}
      />

      <div className="flex items-center justify-between text-xs mt-1 mb-3">
        <span className={toneClass(titleLenHint.tone)}>{titleLenHint.text}</span>
        <div className="flex items-center gap-3">
          <span className={toneClass(titlePxHint.tone)}>{titlePxHint.text}</span>
          <span className="text-zinc-500">
            {titleCount} chars • {titleWords} words
          </span>
        </div>
      </div>

      {/* DESCRIPTION */}
      <Textarea
        label={
          <div className="flex items-center justify-between pb-1">
            <span className="mr-2">SEO description</span>
            <CopyButton
              label="Description"
              value={desc}
              disabled={disabled || busy}
            />
          </div>
        }
        value={desc}
        onChange={(e) => setDesc(e.currentTarget.value)}
        minRows={4}
        autosize
        disabled={disabled}
      />

      <div className="flex items-center justify-between text-xs mt-1 mb-4">
        <span className={toneClass(descLenHint.tone)}>{descLenHint.text}</span>
        <span className="text-zinc-500">
          {descCount} chars • {descWords} words
        </span>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={disabled || busy || !title.trim() || !desc.trim()}
            className="h-9"
          >
            Save
          </Button>

          <div className="text-xs text-zinc-500">
            Will be:{" "}
            <span className="font-medium text-zinc-900">
              {canDetermineCustom ? (willBeCustom ? "Custom" : "Template") : "Custom"}
            </span>
          </div>

          <CopyButton
            label="SEO JSON"
            value={jsonValue}
            disabled={disabled || busy || !title.trim() || !desc.trim()}
            kind="json"
          />
        </div>

        <Button variant="default" onClick={onClose} disabled={busy} className="h-9">
          Close
        </Button>
      </div>

      {!canDetermineCustom && (
        <div className="mt-3 text-xs text-zinc-500">
          Tip: click <span className="font-medium">Auto-fill</span> once to load the
          template baseline.
        </div>
      )}
    </Drawer>
  );
}

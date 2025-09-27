import { useEffect, useState } from "react";
import {
  fetchMyProfile,
  updateMyProfile,
  type Profile,
} from "@/services/profile";
import { supabase } from "@/lib/supabase";

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    "full_name" | "phone" | "avatar_url" | "age" | "driver_license_issue"
  >
>;

export default function UserProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [emailRO, setEmailRO] = useState(""); // read-only email
  const [age, setAge] = useState<number | "">(""); // пусто или число
  const [dlIssue, setDlIssue] = useState<string>(""); // yyyy-MM-dd

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const p = await fetchMyProfile();
        if (!mounted || !p) return;
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");
        setAvatarUrl(p.avatar_url ?? "");
        setEmailRO(p.email ?? "");
        setAge(p.age ?? "");
        // p.driver_license_issue приходит ISO -> ставим в input[type=date] формат yyyy-MM-dd
        setDlIssue(
          p.driver_license_issue ? p.driver_license_issue.slice(0, 10) : ""
        );
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleAvatarFile(file: File) {
    setUploading(true);
    setError(null);
    setOk(null);
    try {
      // 1) узнаём своего user.id
      const {
        data: { user },
        error: uErr,
      } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("Not authenticated");

      // 2) делаем путь вида userId/timestamp_filename
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      // 3) грузим в bucket 'avatars'
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/*",
        });
      if (upErr) throw upErr;

      // 4) получаем публичный URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // 5) сохраняем в профиль
      const updated = await updateMyProfile({ avatar_url: publicUrl });
      setAvatarUrl(updated.avatar_url ?? "");
      setOk("Avatar updated");
      await cleanupOldAvatars(user.id, path);
    } catch (e: any) {
      setError(e?.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
      setTimeout(() => setOk(null), 1500);
    }
  }

  async function cleanupOldAvatars(userId: string, keepPath: string) {
    // получаем список файлов в папке userId/
    const { data: list, error: listErr } = await supabase.storage
      .from("avatars")
      .list(userId, { limit: 100 });
    if (listErr || !list) return;

    const toRemove = list
      .map((f) => `${userId}/${f.name}`)
      .filter((path) => path !== keepPath);

    if (toRemove.length > 0) {
      await supabase.storage.from("avatars").remove(toRemove);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: (phone.trim() || null) as string | null,
        avatar_url: (avatarUrl.trim() || null) as string | null,
        age: age === "" ? null : Number(age),
        // храним как timestamptz: из YYYY-MM-DD делаем ISO на полночь UTC
        driver_license_issue: dlIssue
          ? new Date(dlIssue + "T00:00:00Z").toISOString()
          : null,
      };

      const updated: Profile = await updateMyProfile(payload);
      setOk("Saved");
      // синхронизируем поля (на случай форматирования на сервере)
      setFullName(updated.full_name ?? "");
      setPhone(updated.phone ?? "");
      setAvatarUrl(updated.avatar_url ?? "");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(null), 1500);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl w-full">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-6 bg-gray-100 rounded mt-4" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-6 bg-gray-100 rounded mt-4" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl w-full ">
      <h1 className="text-xl md:text-2xl font-semibold">Edit profile</h1>

      {/* превью аватара */}
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={fullName || "User"} src={avatarUrl || null} />
        <div className="text-sm text-gray-500">
          Paste a public image URL in the field below.
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          id="avatar-file"
          type="file"
          accept="image/*"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm hover:file:bg-gray-50"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void handleAvatarFile(f);
            e.currentTarget.value = ""; // сбросить выбор, чтобы можно было выбрать тот же файл
          }}
          disabled={uploading}
        />
        <span className="text-sm text-gray-500">
          {uploading ? "Uploading…" : ""}
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="+34 600 000 000"
          />
        </div>

        {/* Email (только чтение) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            value={emailRO}
            readOnly
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-600"
          />
        </div>

        {/* Age */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Age
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={16}
            max={120}
            value={age}
            onChange={(e) => {
              const v = e.target.value;
              setAge(v === "" ? "" : Number(v));
            }}
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="30"
          />
        </div>

        {/* Driver license issue date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Driver license issue date
          </label>
          <input
            type="date"
            value={dlIssue}
            onChange={(e) => setDlIssue(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}
        {ok && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 p-3 text-sm">
            {ok}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-900 bg-gray-900 text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover border border-gray-100"
      />
    );
  }
  const initials = getInitials(name);
  return (
    <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gray-100 text-gray-600 border border-gray-100 grid place-items-center text-xl font-semibold">
      {initials}
    </div>
  );
}
function getInitials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

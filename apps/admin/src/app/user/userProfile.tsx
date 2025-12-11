import { useEffect, useRef, useState } from "react";
import {
  fetchMyProfile,
  updateMyProfile,
  type ProfileUpdate,
} from "@/services/profile";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";

export default function UserProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // base fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [emailRO, setEmailRO] = useState(""); // read-only email
  const [age, setAge] = useState<number | "">(""); // calculated from DOB
  const [status, setStatus] = useState<Profile["status"] | string | null>(null);

  // driver fields
  const [dob, setDob] = useState<string>(""); // yyyy-MM-dd
  const [dlIssue, setDlIssue] = useState<string>(""); // yyyy-MM-dd
  const [dlExpiry, setDlExpiry] = useState<string>(""); // yyyy-MM-dd
  const [dlNumber, setDlNumber] = useState<string>("");
  const [dlFilePath, setDlFilePath] = useState<string | null>(null);
  const [uploadingDl, setUploadingDl] = useState(false);

  // license preview
  const [dlSignedUrl, setDlSignedUrl] = useState<string | null>(null);
  const [loadingDlPreview, setLoadingDlPreview] = useState(false);

  // drag state
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [dlDragOver, setDlDragOver] = useState(false);

  // refs for hidden inputs
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const dlInputRef = useRef<HTMLInputElement | null>(null);

  // -------- helpers --------
  function calcAgeFromDob(d: string | null | undefined): number | "" {
    if (!d) return "";
    let date: Date;
    try {
      // d может быть "YYYY-MM-DD" или ISO
      date = d.length > 10 ? new Date(d) : new Date(d + "T00:00:00Z");
      if (isNaN(date.getTime())) return "";
    } catch {
      return "";
    }
    const now = new Date();
    let years = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
      years--;
    }
    return years >= 0 ? years : "";
  }

  // -------- load profile --------
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
        setStatus(p.status ?? null);

        // dates → yyyy-MM-dd
        const dobStr = p.driver_dob ? p.driver_dob.slice(0, 10) : "";
        setDob(dobStr);
        setDlIssue(
          p.driver_license_issue ? p.driver_license_issue.slice(0, 10) : ""
        );
        setDlExpiry(
          p.driver_license_expiry ? p.driver_license_expiry.slice(0, 10) : ""
        );
        setDlNumber(p.driver_license_number ?? "");
        setDlFilePath(p.driver_license_file_url ?? null);

        // age from DOB if possible, fallback to stored age
        const calc = dobStr
          ? calcAgeFromDob(dobStr)
          : calcAgeFromDob(p.driver_dob);
        setAge(calc === "" ? p.age ?? "" : calc);
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

  // recalc age when DOB changes
  useEffect(() => {
    if (!dob) {
      setAge("");
      return;
    }
    const a = calcAgeFromDob(dob);
    setAge(a);
  }, [dob]);

  // -------- signed URL for DL --------
  useEffect(() => {
    let cancelled = false;

    if (!dlFilePath) {
      setDlSignedUrl(null);
      return;
    }

    (async () => {
      try {
        setLoadingDlPreview(true);
        const { data, error } = await supabase.storage
          .from("driver-licenses")
          .createSignedUrl(dlFilePath, 60 * 60); // 1 hour

        if (cancelled) return;

        if (error) {
          console.error("Failed to create DL signed URL", error);
          setDlSignedUrl(null);
          return;
        }

        setDlSignedUrl(data?.signedUrl ?? null);
      } catch (e) {
        console.error(e);
        if (!cancelled) setDlSignedUrl(null);
      } finally {
        if (!cancelled) setLoadingDlPreview(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dlFilePath]);

  // -------- AVATAR UPLOAD --------
  async function handleAvatarFile(file: File) {
    setUploadingAvatar(true);
    setError(null);
    setOk(null);
    try {
      const {
        data: { user },
        error: uErr,
      } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/*",
        });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const updated = await updateMyProfile({ avatar_url: publicUrl });
      setAvatarUrl(updated.avatar_url ?? "");
      setStatus(updated.status ?? status);
      setOk("Avatar updated");

      await cleanupOldAvatars(user.id, path);
    } catch (e: any) {
      setError(e?.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      setTimeout(() => setOk(null), 1500);
    }
  }

  async function cleanupOldAvatars(userId: string, keepPath: string) {
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

  async function handleRemoveAvatar() {
    setError(null);
    setOk(null);
    try {
      const updated = await updateMyProfile({ avatar_url: null });
      setAvatarUrl("");
      setStatus(updated.status ?? status);
      setOk("Avatar removed");
    } catch (e: any) {
      setError(e?.message || "Failed to remove avatar");
    } finally {
      setTimeout(() => setOk(null), 1500);
    }
  }

  // -------- DL FILE UPLOAD --------
  async function handleLicenseFile(file: File) {
    setUploadingDl(true);
    setError(null);
    setOk(null);
    try {
      const {
        data: { user },
        error: uErr,
      } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("Not authenticated");

      const cleanName = file.name.replace(/\s+/g, "_");
      const path = `${user.id}/${Date.now()}_${cleanName}`;

      const { error: upErr } = await supabase.storage
        .from("driver-licenses")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/*",
        });
      if (upErr) throw upErr;

      const updated = await updateMyProfile({
        driver_license_file_url: path,
      });

      const finalPath = updated.driver_license_file_url ?? path;
      setDlFilePath(finalPath);
      setStatus(updated.status ?? status);
      setOk("Driver license file updated");

      await cleanupOldDriverLicenses(user.id, finalPath);
    } catch (e: any) {
      setError(e?.message || "Failed to upload driver license");
    } finally {
      setUploadingDl(false);
      setTimeout(() => setOk(null), 1500);
    }
  }

  async function cleanupOldDriverLicenses(userId: string, keepPath: string) {
    const { data: list, error: listErr } = await supabase.storage
      .from("driver-licenses")
      .list(userId, { limit: 50 });
    if (listErr || !list) return;

    const toRemove = list
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keepPath);

    if (toRemove.length > 0) {
      await supabase.storage.from("driver-licenses").remove(toRemove);
    }
  }

  async function handleRemoveLicenseFile() {
    if (!dlFilePath) return;
    setError(null);
    setOk(null);
    try {
      await supabase.storage.from("driver-licenses").remove([dlFilePath]);

      const updated = await updateMyProfile({ driver_license_file_url: null });
      setDlFilePath(null);
      setDlSignedUrl(null);
      setStatus(updated.status ?? status);
      setOk("Driver license file removed");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to remove driver license file");
    } finally {
      setTimeout(() => setOk(null), 1500);
    }
  }

  // -------- SAVE FORM --------
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload: ProfileUpdate = {
        full_name: fullName.trim(),
        phone: (phone.trim() || null) as string | null,
        avatar_url: (avatarUrl.trim() || null) as string | null,
        age: age === "" ? null : Number(age),

        driver_dob: dob ? new Date(dob + "T00:00:00Z").toISOString() : null,
        driver_license_issue: dlIssue
          ? new Date(dlIssue + "T00:00:00Z").toISOString()
          : null,
        driver_license_expiry: dlExpiry
          ? new Date(dlExpiry + "T00:00:00Z").toISOString()
          : null,
        driver_license_number: dlNumber.trim() || null,
      };

      const updated: Profile = await updateMyProfile(payload);
      setOk("Saved");

      setFullName(updated.full_name ?? "");
      setPhone(updated.phone ?? "");
      setAvatarUrl(updated.avatar_url ?? "");
      setStatus(updated.status ?? status);

      // sync dates
      const updatedDob = updated.driver_dob
        ? updated.driver_dob.slice(0, 10)
        : "";
      setDob(updatedDob);
      setDlIssue(
        updated.driver_license_issue
          ? updated.driver_license_issue.slice(0, 10)
          : ""
      );
      setDlExpiry(
        updated.driver_license_expiry
          ? updated.driver_license_expiry.slice(0, 10)
          : ""
      );
      setDlNumber(updated.driver_license_number ?? "");
      setDlFilePath(updated.driver_license_file_url ?? dlFilePath);

      // recalc age from final DOB
      setAge(updatedDob ? calcAgeFromDob(updatedDob) : "");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(null), 1500);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl w-full">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-2">
            <div className="h-7 w-32 bg-gray-100 rounded" />
            <div className="h-4 w-72 bg-gray-100 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>

        {/* Two-column layout skeleton */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(0,2fr)]">
          {/* LEFT: avatar + account info */}
          <div className="rounded-2xl border border-gray-100 bg-white/70 p-4 md:p-5">
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="mt-2 h-3 w-48 bg-gray-100 rounded" />

            <div className="mt-4 flex items-center gap-4">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 bg-gray-100 rounded" />
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
            </div>

            <div className="mt-4 h-24 rounded-2xl bg-gray-50" />

            <div className="mt-6 border-t border-gray-100 pt-4 space-y-2">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-4 w-40 bg-gray-100 rounded" />
              <div className="h-3 w-60 bg-gray-100 rounded" />
            </div>
          </div>

          {/* RIGHT: form skeleton */}
          <div className="rounded-2xl border border-gray-100 bg-white/70 p-4 md:p-5">
            {/* section title */}
            <div className="h-4 w-40 bg-gray-100 rounded" />
            <div className="mt-2 h-3 w-64 bg-gray-100 rounded" />

            <div className="mt-4 space-y-4">
              {/* Full name */}
              <div className="space-y-2">
                <div className="h-3 w-24 bg-gray-100 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-xl" />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-xl" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-xl" />
              </div>

              {/* Age + DOB */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                  <div className="h-9 w-full bg-gray-100 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-28 bg-gray-100 rounded" />
                  <div className="h-9 w-full bg-gray-100 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Driver license block */}
            <div className="mt-6 border-t border-gray-100 pt-4 space-y-4">
              <div className="h-4 w-32 bg-gray-100 rounded" />
              <div className="h-3 w-56 bg-gray-100 rounded" />

              <div className="space-y-2">
                <div className="h-3 w-28 bg-gray-100 rounded" />
                <div className="h-9 w-full bg-gray-100 rounded-xl" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                  <div className="h-9 w-full bg-gray-100 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                  <div className="h-9 w-full bg-gray-100 rounded-xl" />
                </div>
              </div>

              {/* dropzone skeleton */}
              <div className="space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded" />
                <div className="h-24 w-full rounded-2xl bg-gray-100" />
              </div>
            </div>

            {/* Save button skeleton */}
            <div className="mt-6 flex justify-end">
              <div className="h-9 w-28 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dlFileName = dlFilePath
    ? dlFilePath.split("/").pop() ?? dlFilePath
    : null;

  const dlExt = dlFileName?.split(".").pop()?.toLowerCase();
  const dlIsImage =
    dlExt &&
    ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(dlExt);

  return (
    <div className="max-w-5xl w-full">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold">Profile</h1>
          <UserStatusBadge status={status} />
        </div>
        <p className="text-sm text-gray-500">
          Update your contact and driver details. Accurate information helps
          hosts and guests trust you more.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(0,2fr)]">
        {/* LEFT: Avatar + account info */}
        <SectionCard>
          <h2 className="text-sm font-medium text-gray-900">Photo & account</h2>
          <p className="mt-1 text-xs text-gray-500">
            Your profile photo is visible to hosts and, if you are a host, to
            guests.
          </p>

          {/* Avatar preview + controls */}
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={fullName || emailRO || "User"} src={avatarUrl} />
              <div className="text-xs text-gray-500 flex-1">
                Upload a clear face photo or logo. Recommended size — square, at
                least 400×400.
              </div>
            </div>

            {/* avatar: existing vs dropzone */}
            {avatarUrl ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                >
                  {uploadingAvatar ? "Uploading…" : "Change photo"}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                className={`mt-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition ${
                  avatarDragOver
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 bg-white/60 hover:border-gray-300 hover:bg-white"
                }`}
                onClick={() => avatarInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setAvatarDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setAvatarDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setAvatarDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleAvatarFile(file);
                }}
              >
                <div className="text-xs font-medium text-gray-800">
                  Click to upload or drag & drop
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  JPG, PNG, WEBP — up to 5 MB
                </div>
                {uploadingAvatar && (
                  <div className="mt-1 text-[11px] text-gray-500">
                    Uploading…
                  </div>
                )}
              </div>
            )}

            {/* hidden avatar input */}
            <input
              ref={avatarInputRef}
              id="avatar-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) void handleAvatarFile(f);
                e.currentTarget.value = "";
              }}
              disabled={uploadingAvatar}
            />
          </div>

          <div className="mt-6 border-top border-gray-100 pt-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500">Email</div>
              <div className="mt-0.5 text-sm text-gray-900 break-all">
                {emailRO || "—"}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-400">
                Email is used to sign in. To change it, contact support.
              </div>
            </div>
          </div>
        </SectionCard>

        {/* RIGHT: Editable form */}
        <SectionCard>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Personal */}
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                Personal details
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Hosts and admins use these details when working with your
                bookings.
              </p>

              <div className="mt-4 space-y-4">
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
                  <p className="mt-1 text-[11px] text-gray-400">
                    Your phone is only visible to hosts and support.
                  </p>
                </div>

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

                {/* DOB then Age (age is read-only, calculated) */}
                <div className="flex flex-col md:flex-row w-full gap-4">
                  <div className="flex-1 mr-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of birth
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className=" w-full md:max-w-full md:h-11 rounded-xl border border-gray-200 bg-white/60 p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      value={age === "" ? "" : age}
                      readOnly
                      className="w-full md:h-11 md:max-w-full   rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700"
                      placeholder="Auto-calculated"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Driver license block */}
            <div className="border-t border-gray-100 pt-4">
              <h2 className="text-sm font-medium text-gray-900">
                Driver license
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                We use these details to verify your right to drive and for
                insurance.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License number
                  </label>
                  <input
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
                    placeholder="1234 567890"
                  />
                </div>

                <div className="flex flex-col md:flex-row w-full gap-4">
                  <div className="flex-1 mr-4 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issue date
                    </label>
                    <input
                      type="date"
                      value={dlIssue}
                      onChange={(e) => setDlIssue(e.target.value)}
                      className="w-full md:max-w-full md:h-11 rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry date
                    </label>
                    <input
                      type="date"
                      value={dlExpiry}
                      onChange={(e) => setDlExpiry(e.target.value)}
                      className="w-full md:max-w-full md:h-11 rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10 -mr-4"
                    />
                  </div>
                </div>

                {/* driver license file */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver license file
                  </label>

                  {dlFilePath && dlSignedUrl ? (
                    <div className="mt-1 space-y-2">
                      <div className="relative rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                        {dlIsImage ? (
                          <a
                            href={dlSignedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                          >
                            <img
                              src={dlSignedUrl}
                              alt="Driver license preview"
                              className="w-full max-h-64 object-contain group-hover:opacity-95 transition"
                            />
                          </a>
                        ) : (
                          <div className="p-4 flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-700 truncate">
                              {dlFileName}
                            </div>
                            <a
                              href={dlSignedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Open
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => dlInputRef.current?.click()}
                          disabled={uploadingDl}
                          className="inline-flex items-center rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {uploadingDl ? "Uploading…" : "Replace file"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveLicenseFile}
                          disabled={uploadingDl}
                          className="inline-flex items-center rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>

                      {loadingDlPreview && (
                        <p className="text-[11px] text-gray-400">
                          Loading preview…
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`mt-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition ${
                        dlDragOver
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 bg-white/60 hover:border-gray-300 hover:bg-white"
                      }`}
                      onClick={() => dlInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDlDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setDlDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDlDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) void handleLicenseFile(file);
                      }}
                    >
                      <div className="text-xs font-medium text-gray-800">
                        Click to upload or drag & drop
                      </div>
                      <div className="mt-1 text-[11px] text-gray-400">
                        Photo or scan of the front side. Formats: JPG, PNG, PDF.
                      </div>
                      {uploadingDl && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          Uploading driver license…
                        </div>
                      )}
                    </div>
                  )}

                  {/* hidden input */}
                  <input
                    ref={dlInputRef}
                    id="dl-file"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) void handleLicenseFile(f);
                      e.currentTarget.value = "";
                    }}
                    disabled={uploadingDl}
                  />
                </div>
              </div>
            </div>

            {/* Alerts */}
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-900 bg-gray-900 text-white disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}

// ——— UI helpers ———

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-full rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm shadow-sm p-4 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <div className="relative">
        <img
          src={src}
          alt={name}
          className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover border border-gray-100"
        />
      </div>
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

function UserStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const v = String(status).toLowerCase();

  let label = status;
  let classes =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";

  if (v === "active") {
    classes += " bg-emerald-50 text-emerald-700 border-emerald-100";
    label = "Active";
  } else if (v === "blocked" || v === "ban") {
    classes += " bg-red-50 text-red-700 border-red-100";
    label = "Blocked";
  } else if (v === "pending") {
    classes += " bg-amber-50 text-amber-700 border-amber-100";
    label = "Pending";
  } else {
    classes += " bg-gray-50 text-gray-700 border-gray-100";
  }

  return <span className={classes}>{label}</span>;
}

import {
  useLocation,
  useParams,
  Link,
  useNavigate,
  useRouteLoaderData,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  LockOpenIcon,
  LockClosedIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  getUserById,
  updateUserStatus,
  fetchUserBookings,
  fetchUserNotes,
  createUserNote,
  deleteUserNote,
  type BookingItem,
  type UserNoteItem,
  sendPasswordReset,
} from "@/services/user.service";
import { format, isSameDay, parseISO } from "date-fns";
import { CreateUserCard } from "./createUserCard";

// Types
export type AppUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "blocked" | string | null;
  avatar_url: string | null;
  age?: number | null;
  driver_license_issue?: string | null;
};

export const UserPage = () => {
  const { userId } = useParams();

  const rootData = useRouteLoaderData("rootAuth") as
    | { ownerId: string }
    | undefined;
  const ownerId = rootData?.ownerId ?? null;

  const isCreate = userId === "new";

  const { state } = useLocation() as { state?: Partial<AppUser> };
  const navigate = useNavigate();

  // ——— Local state
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [notes, setNotes] = useState<UserNoteItem[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  // ——— Prime user from route state immediately (для мгновенного рендера)
  const primed = useMemo<AppUser | null>(() => {
    if (state && state.id) {
      return {
        id: state.id!,
        full_name: state.full_name ?? null,
        email: state.email ?? null,
        phone: state.phone ?? null,
        status: (state.status as AppUser["status"]) ?? "active",
        avatar_url: state.avatar_url ?? null,
      };
    }
    if (userId) {
      return {
        id: userId,
        full_name: null,
        email: null,
        phone: null,
        status: "active",
        avatar_url: null,
      } as AppUser;
    }
    return null;
  }, [state, userId]);

  // ——— Fetch user
  useEffect(() => {
    if (isCreate) return;

    let mounted = true;
    (async () => {
      if (!primed?.id) return;
      setLoading(true);
      setNotesLoading(true);
      setError(null);
      try {
        const full = await getUserById(primed.id);
        if (!mounted) return;
        const merged: AppUser = {
          id: primed.id,
          full_name: (full as any)?.full_name ?? primed.full_name ?? null,
          email: (full as any)?.email ?? primed.email ?? null,
          phone: (full as any)?.phone ?? primed.phone ?? null,
          status: (full as any)?.status ?? primed.status ?? "active",
          avatar_url: (full as any)?.avatar_url ?? primed.avatar_url ?? null,
          age: (full as any)?.age ?? null,
          driver_license_issue: (full as any)?.driver_license_issue ?? null,
        };
        setUser(merged);
      } catch (e: any) {
        setError(e?.message || "Failed to load user");
      } finally {
        if (mounted) setLoading(false);
        if (mounted) setNotesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isCreate, primed?.id]);

  // ——— Fetch bookings
  useEffect(() => {
    if (isCreate) return;

    let mounted = true;
    (async () => {
      if (!primed?.id) return;

      setBookingsLoading(true);
      try {
        const data = await fetchUserBookings(primed.id, ownerId ?? undefined);
        if (mounted) setBookings(data);
      } finally {
        if (mounted) setBookingsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isCreate, primed?.id, ownerId]);

  // ——— Fetch notes
  useEffect(() => {
    if (isCreate) return;
    let mounted = true;
    (async () => {
      if (!primed?.id) return;
      setNotesLoading(true);
      try {
        const data = await fetchUserNotes(primed.id);
        if (!mounted) return;
        setNotes(data);
      } catch (error) {
        console.log(error);
      } finally {
        if (mounted) setNotesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isCreate, primed?.id]);

  // ——— Actions
  const handleToggleStatus = async () => {
    if (!user) return;
    setToggling(true);
    try {
      const next = user.status === "blocked" ? "active" : "blocked";
      const updated = await updateUserStatus(
        user.id,
        next as "active" | "blocked"
      );
      setUser((u) => (u ? { ...u, status: updated.status } : u));
    } catch (e) {
      console.error(e);
      alert("Не удалось изменить статус пользователя");
    } finally {
      setToggling(false);
    }
  };

  const handleAddNote = async () => {
    if (!user || !noteText.trim()) return;
    setSavingNote(true);

    try {
      const created = await createUserNote({
        userId: user.id,
        text: noteText.trim(),
      });

      setNotes([created, ...notes]);
      setNoteText("");
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить заметку");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!id) return;
    if (!window.confirm("Удалить заметку?")) return;

    setDeletingNoteId(id);
    const prev = notes; // сохраним для отката
    setNotes(prev.filter((n) => n.id !== id)); // оптимистично убираем

    try {
      await deleteUserNote(id);
    } catch (e) {
      console.error(e);
      alert("Не удалось удалить заметку");
      setNotes(prev); // откат
    } finally {
      setDeletingNoteId(null);
    }
  };

  if (isCreate) {
    return (
      <div className="">
        <div className="flex items-center gap-2 ">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <>
              <ArrowLeftIcon className="w-4 h-4" />
              <span className=" sm:inline">Back</span>
            </>
          </button>
          <span className="text-xs text-gray-400">/</span>
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            Create User
          </h1>
        </div>

        <CreateUserCard />
      </div>
    );
  }

  if (!primed) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowLeftIcon className="w-4 h-4" />
          <Link to="/users" className="hover:underline">
            Back to users
          </Link>
        </div>
        <h1 className="mt-3 text-xl md:text-2xl font-semibold">
          User not found
        </h1>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <>
              <ArrowLeftIcon className="w-4 h-4" />
              <span className=" sm:inline">Back</span>
            </>
          </button>
          <span className="text-xs text-gray-400">/</span>
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            User
          </h1>
          {user && <StatusBadge status={(user.status as any) ?? "active"} />}
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => openChat(user.id)}>
              <ChatBubbleLeftRightIcon className="size-4 sm:mr-1" />
              <span className="hidden sm:inline">Message</span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleToggleStatus}
              title={user.status === "blocked" ? "Unblock" : "Block"}
              disabled={toggling}
              aria-busy={toggling}
            >
              {toggling ? (
                <>
                  <ArrowPathIcon className="size-4 animate-spin sm:mr-1" />
                  <span className="hidden sm:inline">Updating…</span>
                </>
              ) : user.status === "blocked" ? (
                <>
                  <LockOpenIcon className="size-4 sm:mr-1" />
                  <span className="hidden sm:inline">Unblock</span>
                </>
              ) : (
                <>
                  <LockClosedIcon className="size-4 sm:mr-1" />
                  <span className="hidden sm:inline">Block</span>
                </>
              )}
            </Button>
            {user?.email && (
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await sendPasswordReset(user.email!);
                    alert("Reset email sent");
                  } catch (e: any) {
                    alert(e.message || "Failed to send reset email");
                  }
                }}
                title="Send password reset email"
              >
                <ArrowPathIcon className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Reset password</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Top card */}
      <section className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="lg:col-span-2">
          {loading ? (
            <Skeleton lines={4} />
          ) : error ? (
            <InlineError message={error} />
          ) : user ? (
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-4">
                <Avatar
                  name={user.full_name ?? user.email ?? user.id}
                  src={user.avatar_url}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg md:text-xl font-semibold truncate">
                      {user.full_name || "No name"}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500">ID: {user.id}</p>
                </div>
              </div>

              <div className="w-full">
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                  <InfoRow
                    icon={<EnvelopeIcon className="w-5 h-5" />}
                    label="Email"
                    value={user.email || "—"}
                    copy={user.email || undefined}
                  />
                  <InfoRow
                    icon={<PhoneIcon className="w-5 h-5" />}
                    label="Phone"
                    value={user.phone || "—"}
                    copy={user.phone || undefined}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <KVP
                    label="Age"
                    value={isNil(user.age) ? "—" : String(user.age)}
                  />
                  <KVP
                    label="Driver license issue date"
                    value={formatDate(user.driver_license_issue)}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </SectionCard>

        {/* Notes */}
        <SectionCard>
          <h3 className="text-sm font-medium text-gray-900">Notes</h3>
          <p className="text-sm text-gray-500 mt-2">
            Host-only notes about the user.
          </p>

          <textarea
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white/60 p-3 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            rows={4}
            placeholder="Type a note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "Enter" &&
                noteText.trim()
              ) {
                handleAddNote();
              }
            }}
          />
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-gray-400">Visible only to hosts</span>
            <button
              onClick={handleAddNote}
              disabled={savingNote || !noteText.trim()}
              aria-busy={savingNote}
              className=" border py-1 px-2 text-sm rounded-md text-white bg-black"
            >
              {savingNote ? "Saving…" : "Save note"}
            </button>
          </div>

          <div className="mt-4 space-y-3 max-h-64 overflow-auto">
            {notesLoading ? (
              <Skeleton lines={3} />
            ) : notes.length === 0 ? (
              <EmptyState
                title="No notes yet"
                description="Add your first note."
              />
            ) : (
              notes.map((n) => (
                <div key={n.id} className="border p-3 rounded-xl text-sm">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <div>
                      <span>{n.author || "Host"}</span>
                      {", "}
                      <span>{formatDate(n.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-gray-200 p-1 hover:bg-gray-50 disabled:opacity-50"
                        onClick={() => handleDeleteNote(n.id)}
                        disabled={deletingNoteId === n.id}
                        title="Delete note"
                        aria-label="Delete note"
                      >
                        <TrashIcon className="size-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {n.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </section>

      {/* Bookings + Activity */}
      <section className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Recent bookings
            </h3>
            <Link
              to={`/bookings?userId=${primed.id}`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              View all
            </Link>
          </div>

          <div className="mt-2 max-h-80 sm:max-h-96 overflow-auto pr-1">
            {bookingsLoading ? (
              <Skeleton lines={4} />
            ) : bookings.length === 0 ? (
              <EmptyState
                title="No bookings yet"
                description="When this user makes a booking, it will appear here."
              />
            ) : (
              <ul className="space-y-2">
                {bookings.slice(0, 20).map((b) => {
                  const brand = b.car?.model?.brand.name ?? "—";
                  const model = b.car?.model?.name ?? "—";
                  const plate = (b.car?.license_plate ??
                    (b.car as any)?.plate_number ??
                    (b.car as any)?.reg_number ??
                    "—") as string;
                  const short = shortId(b.id);
                  const photo = getCarPhoto(b.car?.cover_photos);

                  return (
                    <li
                      key={b.id}
                      role="button"
                      onClick={() =>
                        navigate(`/bookings/${b.id}`, {
                          state: {
                            carId: b.car?.id || b.car_id,
                            from: location.pathname,
                          },
                        })
                      }
                      className="group flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white/60 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {photo ? (
                          <img
                            src={photo}
                            alt={`${brand} ${model}`}
                            className="size-14 rounded-lg object-cover object-left border border-gray-100"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-gray-100 bg-gray-100 grid place-items-center text-xs text-gray-500">
                            🚗
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {brand} {model}
                            </p>
                            <span className="text-sm text-gray-500">
                              #{short}
                            </span>
                          </div>
                          <p className="text-xs rounded border w-fit p-0.5 shadow-sm text-gray-600 truncate">
                            {plate}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDateRange(b.start_at, b.end_at)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusPill value={b.status || "—"} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Activity</h3>
            <span className="text-xs text-gray-500">Most recent</span>
          </div>
          <EmptyState
            title="No activity yet"
            description="Profile updates, status changes, and notes will show here."
          />
        </SectionCard>
      </section>
    </div>
  );
};

// —————————————————————————————————————————————————————
// UI bits (minimal, Tailwind-only)
// —————————————————————————————————————————————————————

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm shadow-sm p-4 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2 mt-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mt-2 rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
      {message}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-medium transition border";
  const styles = {
    primary: "bg-gray-900 text-white border-gray-900 hover:opacity-90",
    secondary: "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
    ghost: "bg-transparent text-gray-700 border-gray-200 hover:bg-gray-50",
  } as const;
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: AppUser["status"] }) {
  const map: Record<string, { text: string; tone: "ok" | "bad" | "neutral" }> =
    {
      active: { text: "Active", tone: "ok" },
      blocked: { text: "Blocked", tone: "bad" },
    };
  const cfg = map[String(status || "active")] || {
    text: String(status),
    tone: "neutral" as const,
  };
  const tone =
    cfg.tone === "ok"
      ? "bg-green-50 text-green-700 border-green-100"
      : cfg.tone === "bad"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-gray-50 text-gray-700 border-gray-100";
  const Icon =
    cfg.tone === "ok"
      ? CheckCircleIcon
      : cfg.tone === "bad"
      ? XCircleIcon
      : UserIcon;
  return (
    <span
      className={` inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${tone}`}
    >
      <Icon className="size-4" /> {cfg.text}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "confirmed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : value === "canceled"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-gray-50 text-gray-700 border-gray-100";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${tone}`}
    >
      {value}
    </span>
  );
}

function InfoRow({
  icon,
  label,
  value,
  copy,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  copy?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white/60 p-3">
      <div className="shrink-0 text-gray-500">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 truncate max-w-[220px]">
          {value}
        </div>
      </div>
      {copy && <CopyButton value={copy} />}
    </div>
  );
}

function KVP({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white/60 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch (e) {
          console.error(e);
        }
      }}
      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
      title="Copy"
    >
      {copied ? (
        <>
          <ClipboardDocumentCheckIcon className="w-4 h-4" /> Copied
        </>
      ) : (
        <>
          <ClipboardDocumentIcon className="w-4 h-4" /> Copy
        </>
      )}
    </button>
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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 p-6 text-center">
      <UserIcon className="w-8 h-8 text-gray-300" />
      <p className="mt-2 text-sm font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

function isNil(v: any): v is null | undefined {
  return v === null || v === undefined;
}

function openChat(userId: string) {
  // адаптируй под свой маршрут/модалку с перепиской
  window.location.href = `/messages?userId=${userId}`;
}

function formatDateRange(startISO: string, endISO: string) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);

  return isSameDay(s, e)
    ? `${format(s, "d MMM yy")} • ${format(s, "HH:mm")}–${format(e, "HH:mm")}`
    : `${format(s, "d MMM yy HH:mm")} — ${format(e, "d MMM yy HH:mm")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = parseISO(value);
  if (isNaN(d.getTime())) return String(value);
  return format(d, "d MMM yy"); // напр., 5 Sep 2025
}

function shortId(id: string) {
  // "732981a0-2233-4429-b0cd-16ac22e47244" -> "732981a0"
  return (id || "").split("-")[0] || id;
}

function getCarPhoto(photos?: string[] | null) {
  if (!photos || photos.length === 0) return null;
  // если хранишь объекты {url}, поправь на photos[0].url
  return photos[0];
}

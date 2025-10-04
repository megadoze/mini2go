import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import { getUserById } from "@/services/user.service";

type Host = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export default function HostPage() {
  const { hostId } = useParams();
  const navigate = useNavigate();

  const primed = useMemo<Host | null>(() => {
    if (!hostId) return null;
    return {
      id: hostId,
      full_name: null,
      email: null,
      phone: null,
      avatar_url: null,
    };
  }, [hostId]);

  const [host, setHost] = useState<Host | null>(primed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!primed?.id) return;
      setLoading(true);
      setError(null);
      try {
        const full = await getUserById(primed.id);
        if (!alive) return;
        setHost({
          id: primed.id,
          full_name: (full as any)?.full_name ?? null,
          email: (full as any)?.email ?? null,
          phone: (full as any)?.phone ?? null,
          avatar_url: (full as any)?.avatar_url ?? null,
        });
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load host");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [primed?.id]);

  if (!primed) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowLeftIcon className="w-4 h-4" />
          <Link to="/" className="hover:underline">
            Back
          </Link>
        </div>
        <h1 className="mt-3 text-xl md:text-2xl font-semibold">
          Host not found
        </h1>
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-xs text-gray-400">/</span>
        <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
          Host
        </h1>
      </div>

      <section className="mt-4 rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm shadow-sm p-4 md:p-5">
        {loading ? (
          <div className="animate-pulse space-y-2 mt-2">
            <div className="h-4 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ) : error ? (
          <div className="mt-2 rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
            {error}
          </div>
        ) : host ? (
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={host.full_name ?? host.email ?? host.id}
                src={host.avatar_url}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg md:text-xl font-semibold truncate">
                    {host.full_name || "No name"}
                  </h2>
                </div>
                <p className="text-sm text-gray-500">ID: {host.id}</p>
              </div>
            </div>

            <div className="w-full">
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow
                  icon={<EnvelopeIcon className="w-5 h-5" />}
                  label="Email"
                  value={host.email || "—"}
                  copy={host.email || undefined}
                />
                <InfoRow
                  icon={<PhoneIcon className="w-5 h-5" />}
                  label="Phone"
                  value={host.phone || "—"}
                  copy={host.phone || undefined}
                />
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
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
        } catch {}
      }}
      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
      title="Copy"
    >
      {copied ? "Copied" : "Copy"}
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

function getInitials(name?: string | null) {
  if (!name) return "H";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "H";
}

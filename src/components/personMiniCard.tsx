// src/components/personMiniCard.tsx
import { Link } from "react-router-dom";

export default function PersonMiniCard({
  title,
  name,
  email,
  phone,
  avatar_url,
  to,
}: {
  title: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  to?: string | null; // путь для клика
}) {
  // аватар
  const Avatar = avatar_url ? (
    <img
      src={avatar_url}
      alt={name ?? ""}
      className="size-14 rounded-xl object-cover ring-1 ring-gray-200 bg-gray-100 flex-shrink-0"
    />
  ) : (
    <div className="size-14 rounded-xl ring-1 ring-gray-200 bg-gray-100 flex items-center justify-center text-[11px] text-gray-500 flex-shrink-0">
      —
    </div>
  );

  // тело карточки
  const Body = (
    <div className="flex flex-col flex-1 min-w-0">
      <p className="font-medium text-gray-900 text-sm leading-tight truncate">
        {name ?? "—"}
      </p>

      <p className="text-[11px] text-gray-500 leading-tight break-all mt-1">
        {email ?? "—"}
      </p>

      {phone ? (
        <p className="text-[11px] text-gray-500 leading-tight break-all">
          {phone}
        </p>
      ) : null}
    </div>
  );

  const Inner = (
    <div className="flex items-start gap-3">
      {Avatar}
      {Body}
    </div>
  );

  const Clickable = to ? (
    <Link
      to={to}
      className="block focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-2xl"
    >
      {Inner}
    </Link>
  ) : (
    <div>{Inner}</div>
  );

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 px-4 py-4 sm:px-5 sm:py-5 text-gray-700">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] font-semibold text-gray-900 leading-tight">
          {title}
        </p>
      </div>

      {Clickable}
    </section>
  );
}

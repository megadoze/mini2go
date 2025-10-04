// src/components/PersonMiniCard.tsx
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
  const CardInner = (
    <div className="flex items-start gap-4 border rounded-md border-gray-400 p-2 mt-2">
      <img src={avatar_url ?? "-"} alt="" className=" size-16 rounded-md" />
      <div className=" flex flex-col flex-1 gap-0">
        <p className="font-medium">{name ?? "—"}</p>
        <p className="text-xs text-gray-600 pt-1">{email ?? "—"}</p>
        <p className="text-xs text-gray-600">{phone ? `${phone}` : ""}</p>
      </div>
    </div>
  );

  return (
    <section className="mt-6 text-gray-700">
      <p className="md:text-lg font-semibold">{title}</p>
      {to ? <Link to={to}>{CardInner}</Link> : CardInner}
    </section>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router";
import { createUserProfile } from "@/services/user.service";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";

type UserRow = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
};
type Page = { items: UserRow[]; count: number };
const PAGE_SIZE = 10; // тот же, что в UsersPage

export function CreateUserCard() {
  const navigate = useNavigate();

  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(""); // опционально, можно оставить пустым — сгенерим

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tempPass, setTempPass] = useState<string | null>(null);

  function injectNewUserIntoCache(row: UserRow) {
    const key = ["users", "infinite", PAGE_SIZE] as const;

    qc.setQueryData<InfiniteData<Page>>(key, (old) => {
      if (!old?.pages?.length) return old;

      // первая страница
      const first = old.pages[0];

      // уже есть? тогда ничего не делаем
      if (first.items.some((u) => u.id === row.id)) return old;

      // кладём нового в начало первой страницы, обрезаем до PAGE_SIZE
      const newFirst: Page = {
        items: [row, ...first.items].slice(0, PAGE_SIZE),
        count: (first.count ?? first.items.length) + 1, // увеличим общее кол-во
      };

      return {
        pages: [newFirst, ...old.pages.slice(1)],
        pageParams: old.pageParams,
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setTempPass(null);
    setLoading(true);
    try {
      const {
        user,
        profile,
        password: usedPass,
      } = await createUserProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        password: password.trim() || undefined,
      });

      const newRow: UserRow = {
        id: user.id,
        full_name: profile?.full_name ?? fullName.trim(),
        email: user.email,
        phone: profile?.phone ?? (phone.trim() || null),
        status: profile?.status ?? "active",
        avatar_url: profile?.avatar_url ?? null,
      };

      // 🔥 патчим кэш списка
      injectNewUserIntoCache(newRow);

      // покажем временный пароль (если генерили)
      setTempPass(usedPass);

      // навигация на карточку пользователя
      navigate(`/users/${user.id}`, {
        replace: true,
        state: newRow, // можно прокинуть состояние
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white/70 shadow-sm p-4 md:p-5">
      <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="Customer Name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="customer@example.com"
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
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password (optional)
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white/60 p-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
            placeholder="Leave blank to auto-generate"
          />
          <p className="mt-1 text-xs text-gray-500">
            Если оставить пустым — создадим временный пароль автоматически.
          </p>
        </div>

        {err && (
          <div className="rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
            {err}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-gray-900 bg-gray-900 text-white disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create user"}
          </button>
        </div>

        {tempPass && (
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 text-amber-800 p-3 text-sm">
            Временный пароль: <code className="font-mono">{tempPass}</code>
          </div>
        )}
      </form>
    </div>
  );
}

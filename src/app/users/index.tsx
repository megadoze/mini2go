import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Loader,
  NativeSelect,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { fetchUsers } from "@/services/user.service";

type UserRow = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
};

type SortKey = "name" | "email";

function statusColor(s?: string | null) {
  const v = (s ?? "").toLowerCase();
  if (v === "active") return "green";
  if (v === "blocked" || v === "ban") return "red";
  if (v === "pending" || v === "new") return "yellow";
  return "gray";
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function cmp(a?: string | null, b?: string | null, reversed = false) {
  const av = (a ?? "").toString();
  const bv = (b ?? "").toString();
  const r = av.localeCompare(bv, undefined, { sensitivity: "base" });
  return reversed ? -r : r;
}

export default function UsersPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [reversed, setReversed] = useState(false);

  const usersQ = useQuery<UserRow[]>({
    queryKey: ["users", "all"],
    queryFn: fetchUsers,
    initialData: qc.getQueryData<UserRow[]>(["users", "all"]),
    staleTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const users = usersQ.data ?? [];

  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.status) s.add(String(u.status));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();

    // 1) text filter
    let arr = q
      ? users.filter((u) => {
          const hay = `${u.full_name ?? ""} ${u.email ?? ""} ${
            u.phone ?? ""
          }`.toLowerCase();
          return hay.includes(q);
        })
      : users;

    // 2) status filter
    if (statusFilter) {
      arr = arr.filter((u) => (u.status ?? "") === statusFilter);
    }

    // 3) sort
    arr = [...arr].sort((a, b) => {
      if (sortBy === "name") return cmp(a.full_name, b.full_name, reversed);
      if (sortBy === "email")
        return cmp(a.email ?? "", b.email ?? "", reversed);
      return cmp(a.phone ?? "", b.phone ?? "", reversed);
    });

    return arr;
  }, [users, search, statusFilter, sortBy, reversed]);

  const setSorting = (key: SortKey) => {
    if (key === sortBy) {
      setReversed((p) => !p);
    } else {
      setSortBy(key);
      setReversed(false);
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

  return (
    <div className="w-full max-w-screen-2xl">
      {/* header */}
      <div className="flex items-center gap-2 mb-4">
        <h1 className="font-openSans font-bold text-2xl">Users</h1>
        {users.length > 0 && <Badge color="black">{users.length}</Badge>}
        {usersQ.isFetching && <Loader size="xs" color="gray" />}
      </div>

      {/* controls */}
      <div className="flex gap-2 items-center w-full mb-5">
        <TextInput
          variant="unstyled"
          placeholder="Search name / email / phone"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          radius="xs"
          className="flex-1 md:flex-none w-80 border border-gray-300 focus-within:border-gray-500 rounded px-1"
          leftSection={<MagnifyingGlassIcon className="size-4" />}
        />
        <NativeSelect
          value={statusFilter}
          variant="unstyled"
          onChange={(e) => setStatusFilter(e.currentTarget.value)}
          radius="xs"
          className="pl-2 rounded border border-gray-300 font-normal"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="w-full rounded-xl overflow-hidden">
        {/* header row */}
        <div className="grid grid-cols-[2fr,2fr,1.5fr,1fr,24px] px-2 sm:px-3 py-3 text-xs bg-neutral-200/50">
          <div>
            <SortButton
              label="Name"
              active={sortBy === "name"}
              desc={reversed}
              onClick={() => setSorting("name")}
            />
          </div>
          <div className=" col-start-2 col-span-2 md:col-auto">
            <SortButton
              label="Email"
              active={sortBy === "email"}
              desc={reversed}
              onClick={() => setSorting("email")}
            />
          </div>
          <div className="hidden md:block text-sm text-gray-800">Phone</div>
          <div className="text-sm text-gray-800 text-center col-start-4 col-span-2 md:col-auto">
            Status
          </div>
          <div />
        </div>

        {filteredSorted.length === 0 ? (
          <div className="px-3 py-6 text-sm text-zinc-500">Users not found</div>
        ) : (
          <ul role="list" className="divide-y divide-neutral-200/60">
            {filteredSorted.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/users/${u.id}`}
                  className="grid grid-cols-[2fr,2fr,1.5fr,1fr,24px] items-center px-2 sm:px-3 py-3 hover:bg-neutral-100/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded-[6px]"
                >
                  {/* name + avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.full_name ?? "User"}
                        className=" w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="hidden w-9 h-9 rounded-full bg-gray-200 text-gray-700 text-xs md:flex items-center justify-center">
                        {initials(u.full_name)}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {u.full_name ?? "—"}
                      </div>
                    </div>
                  </div>

                  {/* email */}
                  <div className=" col-start-2 col-span-2 md:col-auto text-sm text-gray-800 truncate">
                    {u.email ?? "—"}
                  </div>

                  {/* phone */}
                  <div className="hidden md:block text-sm text-gray-800 truncate">
                    {u.phone ?? "—"}
                  </div>

                  {/* status */}
                  <div className=" col-start-4 col-span-2 mx-auto md:col-auto">
                    <Badge
                      variant="dot"
                      color={statusColor(u.status)}
                      radius="lg"
                      fw={400}
                      className=" mx-auto"
                      size="sm"
                    >
                      {u.status ?? "unknown"}
                    </Badge>
                  </div>

                  {/* декоративный chevron (вся строка — ссылка) */}
                  <div className="hidden md:flex justify-end opacity-60">
                    <ChevronRightIcon className="size-5 stroke-1 text-gray-700" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

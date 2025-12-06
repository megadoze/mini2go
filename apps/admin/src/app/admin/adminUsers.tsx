import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  Badge,
  Loader,
  NativeSelect,
  TextInput,
  UnstyledButton,
  Drawer,
} from "@mantine/core";
import {
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { highlightMatch } from "@/utils/highlightMatch";
import { fetchUsersPage } from "@/services/user.service";
import { QK } from "@/queryKeys";

type UserRow = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
};

type SortKey = "name" | "email";

const PAGE_SIZE = 10;
type Page = { items: UserRow[]; count: number };

function statusColor(s?: string | null, blockedForHost?: boolean) {
  if (blockedForHost) return "red"; // локальный блок для этого хоста

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

export default function AdminUsers() {
  const qc = useQueryClient();

  const { excludeUserId } = useLoaderData() as {
    excludeUserId: string | null;
    q: string;
    status: string;
    sort: "full_name" | "email" | "created_at";
    dir: "asc" | "desc";
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [reversed, setReversed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [blockedMap, setBlockedMap] = useState<Record<string, boolean>>({});

  const currentKey = QK.usersInfinite(
    PAGE_SIZE, // ← 1-й аргумент: pageSize (number)
    null, // ← q
    null, // ← status
    null, // ← sort
    null, // ← dir
    excludeUserId // ← excludeUserId (string | null) как последний
  );

  const usersQ = useInfiniteQuery<Page, Error>({
    queryKey: currentKey,
    enabled: true,
    queryFn: async ({ pageParam }) => {
      const pageIndex = typeof pageParam === "number" ? pageParam : 0;
      const offset = pageIndex * PAGE_SIZE;
      return fetchUsersPage({
        limit: PAGE_SIZE,
        offset,
        excludeUserId: excludeUserId,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      const total = lastPage.count ?? loaded;
      return loaded < total ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 5 * 60_000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    initialData: excludeUserId
      ? () => qc.getQueryData<InfiniteData<Page>>(currentKey)
      : undefined,
    placeholderData: (prev) => prev,
  });

  // ✂️ helper, чтобы обрезать кэш до первой страницы без сети (как у тебя в cars/users)
  const trimToFirstPage = () => {
    qc.setQueryData<InfiniteData<Page>>(currentKey, (old) => {
      if (!old?.pages?.length) return old;
      return { pages: [old.pages[0]], pageParams: [0] };
    });
  };

  useEffect(() => {
    return () => {
      trimToFirstPage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeUserId]);

  const EMPTY_PAGES: ReadonlyArray<Page> = [];

  const pages = useMemo(() => usersQ.data?.pages ?? EMPTY_PAGES, [usersQ.data]);

  const users = useMemo<UserRow[]>(
    () => pages.flatMap((p) => p.items) ?? [],
    [pages]
  );

  useEffect(() => {
    if (!excludeUserId) return;
    if (users.length === 0) {
      setBlockedMap({});
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ids = users.map((u) => u.id);

        const { data, error } = await supabase
          .from("host_user_blocks")
          .select("user_id")
          .eq("owner_id", excludeUserId)
          .in("user_id", ids);

        if (cancelled) return;

        if (error) {
          console.error("Failed to load host blocks for users list", error);
          return;
        }

        const next: Record<string, boolean> = {};
        (data ?? []).forEach((row: { user_id: string }) => {
          next[row.user_id] = true;
        });

        setBlockedMap(next);
      } catch (e) {
        if (!cancelled) console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [excludeUserId, users]);

  // уникальные статусы из уже загруженного (для селекта)
  const statuses = useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.status) s.add(String(u.status));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [users]);

  // фильтрация+сортировка по клиенту (по загруженному)
  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = q
      ? users.filter((u) => {
          const hay = `${u.full_name ?? ""} ${u.email ?? ""} ${
            u.phone ?? ""
          }`.toLowerCase();
          return hay.includes(q);
        })
      : users;

    if (statusFilter) {
      arr = arr.filter((u) => (u.status ?? "") === statusFilter);
    }

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

  // reset: поля + обрезка к первой странице (без сети)
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    trimToFirstPage();
  };

  // const loadingInitial = usersQ.isLoading && !usersQ.data;
  const isFetchingNext = usersQ.isFetchingNextPage;
  const totalLoaded = users.length;
  const totalAvailable = usersQ.data?.pages[0]?.count ?? totalLoaded;
  const canLoadMore = totalLoaded < totalAvailable;

  // общие поля фильтров (статус)
  const FilterFields = (
    <>
      <div className="relative w-full sm:w-auto sm:shrink-0">
        <EyeIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <NativeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.currentTarget.value)}
          className="w-full sm:w-auto min-w-[180px] rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm transition hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
      </div>
    </>
  );

  return (
    <div className="w-full max-w-screen-2xl">
      {/* header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-roboto text-xl md:text-2xl font-medium md:font-bold">
            Users
          </h1>
          {totalLoaded > 0 && <Badge color="black">{totalLoaded}</Badge>}
          {usersQ.isFetching && <Loader size="xs" color="gray" />}
        </div>
      </div>

      {/* Desktop controls row (status + search + reset) */}
      <div className="hidden sm:flex sm:flex-nowrap items-center gap-3 w-full mb-5 overflow-x-auto">
        {FilterFields}

        {/* Search inline */}
        <div className="relative  min-w-[300px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <TextInput
            placeholder="Search name / email / phone"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={resetFilters}
          className="p-2 rounded hover:bg-gray-100 active:bg-gray-200 transition"
          aria-label="Reset filters"
          title="Reset filters"
        >
          <XMarkIcon className="size-5 text-gray-800 stroke-1" />
        </button>
      </div>

      {/* Mobile search (always visible) */}
      <div className="relative w-full mb-4 sm:hidden">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <TextInput
          placeholder="Search name / email / phone"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-xl bg-white/60 shadow-sm pl-9 pr-3 py-2 text-sm hover:bg-white/80 focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Mobile floating Filters button */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-md bg-black text-white active:opacity-80"
          aria-label="Open filters"
        >
          <FunnelIcon className="size-4" />
          Filters
        </button>
      </div>

      {/* Bottom sheet for mobile filters (status) */}
      <Drawer
        opened={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        position="bottom"
        withinPortal
        size="35%"
        padding="md"
        keepMounted
        withCloseButton={false}
        overlayProps={{ opacity: 0.2, blur: 2 }}
        styles={{
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        }}
      >
        <div className="flex flex-col gap-3 mt-2">{FilterFields}</div>
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={resetFilters}
            className="text-sm text-zinc-500 underline underline-offset-4"
          >
            Reset filters
          </button>
        </div>
      </Drawer>

      <div className="w-full rounded-xl overflow-hidden">
        {/* header row */}
        <div className="grid grid-cols-[2fr,2fr,1.5fr,1fr,24px] px-2 sm:px-3 py-4 text-xs bg-white border-b border-zinc-100">
          <div className="col-start-1 col-span-3 md:col-auto">
            <SortButton
              label="Name"
              active={sortBy === "name"}
              desc={reversed}
              onClick={() => setSorting("name")}
            />
          </div>
          <div className="hidden md:block">
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
          <>
            <ul role="list" className="divide-y divide-neutral-200/40">
              {filteredSorted.map((u) => (
                <li key={u.id}>
                  <Link
                    to={`/admin/users/${u.id}`}
                    state={u}
                    className="grid grid-cols-[2fr,2fr,1.5fr,1fr,24px] items-center px-2 sm:px-3 py-3 bg-white hover:bg-emerald-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 rounded-[6px]"
                  >
                    {/* name + avatar */}
                    <div className="col-start-1 col-span-3 md:col-auto flex items-center gap-3 min-w-0">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.full_name ?? "User"}
                          className=" size-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className=" w-9 h-9 rounded-full bg-gray-200 text-gray-700 text-xs flex items-center justify-center">
                          {initials(u.full_name)}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {u.full_name
                            ? highlightMatch(u.full_name, search)
                            : "—"}
                        </div>
                      </div>
                    </div>

                    {/* email */}
                    <div className="hidden md:block col-start-2 col-span-2 md:col-auto text-sm text-gray-800 truncate">
                      {u.email ? highlightMatch(u.email, search) : "—"}
                    </div>

                    {/* phone */}
                    <div className="hidden md:block text-sm text-gray-800 truncate">
                      {u.phone ? highlightMatch(u.phone, search) : "—"}
                    </div>

                    {/* status */}
                    <div className=" col-start-4 col-span-2 mx-auto md:col-auto">
                      <Badge
                        variant="dot"
                        color={statusColor(u.status, blockedMap[u.id])}
                        radius="lg"
                        fw={400}
                        className=" mx-auto"
                        size="sm"
                      >
                        {blockedMap[u.id]
                          ? "Blocked for you"
                          : u.status ?? "unknown"}
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

            {/* Load more */}
            <div className="w-full flex justify-center mt-6 mb-2">
              {canLoadMore ? (
                <button
                  type="button"
                  onClick={() => usersQ.fetchNextPage()}
                  disabled={isFetchingNext}
                  aria-busy={isFetchingNext}
                  className="rounded-2xl bg-black text-white px-4 py-2 text-sm hover:opacity-85 disabled:opacity-60"
                >
                  {isFetchingNext ? "Loading..." : "Показать ещё"}
                </button>
              ) : (
                <div className="text-xs text-zinc-400">
                  There are no more users
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

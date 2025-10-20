import type { LoaderFunction } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchHostUsersPage } from "@/services/user.service";
import type { InfiniteData } from "@tanstack/react-query";
import { QK } from "@/queryKeys";

type UserRow = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  avatar_url?: string | null;
};

type Page = { items: UserRow[]; count: number };

const PAGE_SIZE = 10;

export const usersLoader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  const { data: { session } } = await supabase.auth.getSession();
  const meId = session?.user?.id ?? null;
  const ownerId = (url.searchParams.get("owner") ?? meId) as string | null;

  // гость — без прогрева
  if (!ownerId) return { ownerId: null };

  // ВАЖНО: прогреваем ТЕМ ЖЕ ключом и ТЕМ ЖЕ форматом, что читает useInfiniteQuery
  await queryClient.ensureQueryData<InfiniteData<Page, number>>({
    queryKey: QK.usersByHostInfinite(ownerId, PAGE_SIZE, null),
    queryFn: async () => {
      const firstPage = await fetchHostUsersPage({
        ownerId,
        limit: PAGE_SIZE,
        offset: 0,
      });
      return { pages: [firstPage], pageParams: [0] };
    },
    staleTime: 5 * 60_000,
  });

  return { ownerId };
};


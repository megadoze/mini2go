import { queryClient } from "@/lib/queryClient";
import { fetchUsers } from "@/services/user.service";

export async function usersLoader() {
  await queryClient.ensureQueryData({
    queryKey: ["users", "all"],
    queryFn: () => fetchUsers(),
    staleTime: 5 * 60_000,
  });

  // компонент возьмёт данные из кэша по тому же ключу
  return {};
}

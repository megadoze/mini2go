// src/components/UserMenu.tsx
import { useEffect, useMemo, useState } from "react";
import { Group, Menu, UnstyledButton } from "@mantine/core";
import {
  ArrowLeftEndOnRectangleIcon,
  ChatBubbleOvalLeftIcon,
  RocketLaunchIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import multiavatar from "@multiavatar/multiavatar/esm";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useIsHost } from "@/hooks/useIsHost";

type Props = { onClick: () => void };
type ProfileRow = { full_name: string | null; avatar_url: string | null };

type MeCache = {
  id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};
const ME_CACHE_KEY = "ui.me.v1";

function readMeCache(): MeCache | null {
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY);
    return raw ? (JSON.parse(raw) as MeCache) : null;
  } catch {
    return null;
  }
}
function writeMeCache(v: MeCache) {
  try {
    localStorage.setItem(ME_CACHE_KEY, JSON.stringify(v));
  } catch {}
}
function clearMeCache() {
  try {
    localStorage.removeItem(ME_CACHE_KEY);
  } catch {}
}
function slugFromEmail(email?: string | null) {
  if (!email) return "";
  const name = email.split("@")[0] ?? "";
  return name.trim().replace(/\s+/g, "-");
}

// где-то рядом с slugFromEmail
function slugify(input?: string | null) {
  if (!input) return "";
  return input
    .trim()
    .normalize("NFKD") // убрать диакритику
    .replace(/[\u0300-\u036f]/g, "") // доп. очистка диакритики
    .replace(/[^\p{L}\p{N}]+/gu, "-") // всё, что не буква/цифра -> "-"
    .replace(/^-+|-+$/g, "") // обрезать дефисы по краям
    .toLowerCase();
}

function UserMenu({ onClick }: Props) {
  const navigate = useNavigate();

  const loc = useLocation();

  const { isHost, loading: hostLoading } = useIsHost();
  const [user, setUser] = useState<User | null>(null);

  // профиль — ЕДИНСТВЕННЫЙ источник правды для аватарки и имени
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [initializing, setInitializing] = useState(true);

  // 0) гидратация из кэша — синхронно
  useEffect(() => {
    const cache = readMeCache();
    if (cache) {
      const p: ProfileRow = {
        full_name: cache.full_name,
        avatar_url: cache.avatar_url,
      };
      setProfile(p);
      const best = cache.full_name?.trim() || slugFromEmail(cache.email) || "";
      setDisplayName(best);
    }
    setInitializing(false);
  }, []);

  // 1) сессия (не используем для UI)
  useEffect(() => {
    const setFromSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    };
    setFromSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        clearMeCache();
        setProfile(null);
        setDisplayName("");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) грузим профиль по user.id, обновляем кэш и только ПОСЛЕ этого решаем, что показывать
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (cancelled) return;

      const row: ProfileRow | null = error
        ? null
        : (data as ProfileRow) ?? null;
      if (row) {
        setProfile(row);
        const best =
          row.full_name?.trim() ||
          (user.user_metadata?.name as string | undefined)?.trim() ||
          slugFromEmail(user.email) ||
          "";
        if (best && best !== displayName) setDisplayName(best);

        writeMeCache({
          id: user.id,
          full_name:
            row.full_name ?? (user.user_metadata?.name as string) ?? null,
          avatar_url: row.avatar_url ?? null,
          email: user.email ?? null,
        });
      } else {
        // профиля нет → кэш хотя бы с именем из user, но аватар_url null
        writeMeCache({
          id: user.id,
          full_name: (user.user_metadata?.name as string | undefined) ?? null,
          avatar_url: null,
          email: user.email ?? null,
        });
        const best =
          (user.user_metadata?.name as string | undefined)?.trim() ||
          slugFromEmail(user.email) ||
          "";
        if (best && best !== displayName) setDisplayName(best);
        setProfile(
          (prev) => prev ?? { full_name: best || null, avatar_url: null }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // === АВАТАР ===
  // Показываем multiavatar ТОЛЬКО если точно знаем, что avatar_url нет (т.е. profile есть и avatar_url пуст)
  const shouldShowMulti = !!profile && !profile.avatar_url;

  // seed — только от профиля, НИКАКОГО user, чтобы избежать раннего мигания
  const multiSeed = useMemo(() => {
    const name = profile?.full_name?.trim() ?? "";
    return name.replace(/[<>]/g, ""); // микро-санитайз
  }, [profile?.full_name]);

  // один раз генерим svg для текущего seed
  const svgAvatar = useMemo(() => {
    if (!shouldShowMulti || !multiSeed) return "";
    return multiavatar(multiSeed);
  }, [shouldShowMulti, multiSeed]);

  // если картинка не загрузилась — fallback на multiavatar
  const [imgBroken, setImgBroken] = useState(false);
  const showImg = !!profile?.avatar_url && !imgBroken;

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.id;

    if (id === "host") {
      // если ещё грузится — можно временно дизейблить пункт меню или ничего не делать
      if (hostLoading) return;

      // ✅ главное: роутим по факту
      navigate(isHost ? "/dashboard" : "/cars/add", {
        state: { from: loc.pathname + loc.search + loc.hash },
      });
      onClick();
      return;
    }

    const slug = slugify(displayName) || "me";
    navigate(`/user/${slug}${id ? `/${id}` : ""}`);
    onClick();
  };

  const handleLogout = async () => {
    navigate("/auth", { replace: true });
    clearMeCache();
    await supabase.auth.signOut();
  };

  return (
    <Menu
      withArrow
      arrowPosition="center"
      transitionProps={{ transition: "rotate-right", duration: 150 }}
      offset={6}
      width={"200"} // ширина выпадающего меню
      position="bottom-end"
    >
      <Menu.Target>
        <UnstyledButton aria-label="User menu" className=" w-full">
          <Group
            gap={10}
            className="inline-flex !justify-center items-center rounded-xl lg:bg-white/60 ring-1 ring-black/5 shadow-sm px-2.5 py-3 md:py-1.5 transition hover:bg-white-800/80"
          >
            {showImg ? (
              <img
                src={profile!.avatar_url!}
                alt={displayName || "me"}
                className="size-6 rounded-full object-cover border border-gray-200"
                loading="lazy"
                onError={() => setImgBroken(true)}
              />
            ) : shouldShowMulti && svgAvatar ? (
              <div
                className="size-6"
                dangerouslySetInnerHTML={{ __html: svgAvatar }}
              />
            ) : (
              // Пока не знаем профиль или нет seed — стабильный плейсхолдер
              <div className="size-6 rounded-full bg-gray-200 border border-gray-200" />
            )}

            <div className="min-w-[40px]">
              {!displayName && initializing ? (
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                <p className="truncate max-w-[120px]">{displayName}</p>
              )}
            </div>
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          id="profile"
          leftSection={<UserCircleIcon className="size-4" />}
          onClick={handleMenuClick}
        >
          Profile
        </Menu.Item>
        <Menu.Item
          id="host"
          leftSection={<RocketLaunchIcon className="size-4" />}
          onClick={handleMenuClick}
          disabled={hostLoading} // пока считаем — лучше отключить
        >
          {hostLoading ? "…" : isHost ? "Host" : "Become a host"}
        </Menu.Item>
        <Menu.Item
          id="messages"
          leftSection={<ChatBubbleOvalLeftIcon className="size-4" />}
          onClick={handleMenuClick}
        >
          Messages
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          color="red"
          leftSection={<ArrowLeftEndOnRectangleIcon className="size-4" />}
          onClick={handleLogout}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default UserMenu;

// src/components/UserMenu.tsx
import { useEffect, useState } from "react";
import { Group, Menu, UnstyledButton } from "@mantine/core";
import {
  ArrowLeftEndOnRectangleIcon,
  ChatBubbleOvalLeftIcon,
  Cog8ToothIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import multiavatar from "@multiavatar/multiavatar/esm";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Props = {
  onClick: () => void;
};

type ProfileRow = { full_name: string | null; avatar_url: string | null };

function UserMenu({ onClick }: Props) {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // 1) Получаем пользователя при монтировании
  useEffect(() => {
    let unsub = () => {};

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    // 2) Подписка на изменения сессии (логин/логаут)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    unsub = () => sub.subscription.unsubscribe();
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();
      if (!cancelled) {
        if (!error) setProfile(data as ProfileRow);
        else setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // 3) Утилиты
  const cutBeforeAt = (str: string) => {
    const idx = str.indexOf("@");
    return idx !== -1 ? str.slice(0, idx) : str;
  };
  const toSlug = (str: string) => str.trim().replace(/\s+/g, "-");

  // 4) Имя/емейл/аватар из Supabase
  const email = user?.email ?? "user@example.com";
  const userName =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.name as string | undefined) ||
    toSlug(cutBeforeAt(email));

  const avatarSeed = user?.id ?? email;

  // 5) Переходы по пунктам меню
  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.id; // profile | settings | messages
    navigate(`/user/${userName}${id ? `/${id}` : ""}`);
    onClick();
  };

  // 6) Logout + редирект на /auth с возвратом
  const handleLogout = async () => {
    // 1) Сначала уходим на публичный роут
    navigate("/auth", { replace: true });

    // 2) Потом разлогиниваемся — состояние обновится уже на /auth
    await supabase.auth.signOut();
  };

  return (
    <Menu
      withArrow
      transitionProps={{ transition: "rotate-right", duration: 150 }}
      offset={4}
    >
      <Menu.Target>
        <UnstyledButton className="p-3" aria-label="User menu">
          <Group
            gap={10}
            className="inline-flex items-center rounded-xl lg:bg-white/60 ring-1 ring-black/5 shadow-sm px-2.5 py-1.5 transition hover:bg-white-800/80"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={userName}
                className="size-6 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div
                className="size-6"
                dangerouslySetInnerHTML={{ __html: multiavatar(avatarSeed) }}
              />
            )}

            <div>
              <p>{userName}</p>
              {/* Можно показать email ниже, если нужно */}
              {/* <span className="text-xs opacity-70">{email}</span> */}
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
          id="settings"
          leftSection={<Cog8ToothIcon className="size-4" />}
          onClick={handleMenuClick}
        >
          Settings
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

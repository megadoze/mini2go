import { useEffect, useMemo, useState } from "react";
import { Group, Text, Menu, UnstyledButton } from "@mantine/core";
import {
  ArrowLeftEndOnRectangleIcon,
  ChatBubbleOvalLeftIcon,
  Cog8ToothIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
// import { useAuth } from "../context/authProvider";
import multiavatar from "@multiavatar/multiavatar/esm";
import { useNavigate } from "react-router";

type Props = {
  onClick: () => void;
};

function UserMenu({ onClick }: Props) {
  // const { user, LogOut } = useAuth();

  const user = useMemo(
    () => ({
      displayName: "Parmegano",
      email: "parmegano@gmail.com",
      photoURL: "",
      uid: "dskjfs410nb4986",
    }),
    []
  );

  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);

  const cutBeforeSpace = (str: string) => {
    const index = str.indexOf("@");
    return index !== -1 ? str.slice(0, index) : str;
  };

  const toSlug = (str: string) =>
    str
      .trim()
      // .toLowerCase()
      .replace(/\s+/g, "-");
  // .replace(/[^a-z0-9-_]/g, "");

  const rawName = cutBeforeSpace(user.email);

  const userName = user.displayName || toSlug(rawName);

  // 🔥 Следим за изменением `user` и обновляем `avatar`
  useEffect(() => {
    setAvatar(user.uid);
  }, [user]);

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.id;
    navigate(`/user/${userName}${id ? `/${id}` : ""}`);
    onClick();
  };

  const handleLogout = () => {
    // LogOut(); // 🔥 `navigate("/")` уже внутри LogOut()
  };

  return (
    <Menu
      withArrow
      transitionProps={{ transition: "rotate-right", duration: 150 }}
      offset={12}
    >
      <Menu.Target>
        <UnstyledButton className=" p-3">
          <Group>
            <div
              className="size-8"
              // dangerouslySetInnerHTML={{ __html: multiavatar(avatar) }}
              dangerouslySetInnerHTML={{ __html: multiavatar(avatar ?? "") }}
            />
            <div>
              <Text size="sm" fw={500}>
                {userName}
              </Text>
              <Text c="cyan" size="sm">
                {user?.email}
              </Text>
            </div>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {/* <Menu.Label>Application</Menu.Label> */}
        <Menu.Item
          id="profile"
          leftSection={<UserCircleIcon className=" size-4" />}
          onClick={handleMenuClick}
        >
          Profile
        </Menu.Item>
        <Menu.Item
          id="settings"
          leftSection={<Cog8ToothIcon className=" size-4" />}
          onClick={handleMenuClick}
        >
          Settings
        </Menu.Item>
        <Menu.Item
          id="messages"
          leftSection={<ChatBubbleOvalLeftIcon className=" size-4" />}
          onClick={handleMenuClick}
        >
          Messages
        </Menu.Item>
        <Menu.Divider />
        {/* <Menu.Label>Danger zone</Menu.Label> */}
        {/* <Menu.Item leftSection={"-"}>Transfer my data</Menu.Item> */}
        <Menu.Item
          color="red"
          leftSection={<ArrowLeftEndOnRectangleIcon className=" size-4" />}
          onClick={handleLogout}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default UserMenu;

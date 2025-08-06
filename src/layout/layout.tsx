import { AppShell, Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { NavLink, Outlet } from "react-router-dom";
import {
  ChartBarSquareIcon,
  DocumentTextIcon,
  FireIcon,
  RocketLaunchIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import UserMenu from "@/components/userMenu";

export default function Layout() {
  const [opened, { toggle }] = useDisclosure();

  const menuItems = [
    {
      to: "/dashboard",
      icon: <ChartBarSquareIcon className="size-5" />,
      label: "Dashboard",
      exact: true,
      onClick: toggle,
    },
    {
      to: "/bookings",
      icon: <DocumentTextIcon className="size-5" />,
      label: "Bookings",
      onClick: toggle,
      // count: unviewedCounts.draft,
    },
    {
      to: "/cars",
      icon: <FireIcon className="size-5" />,
      label: "Cars",
      onClick: toggle,
      // count: mainNews.length,
    },
    {
      to: "/extras",
      icon: <RocketLaunchIcon className="size-5" />,
      label: "Extras",
      onClick: toggle,
    },
    {
      to: "/users",
      icon: <UserGroupIcon className="size-5" />,
      label: "Users",
      onClick: toggle,
    },
    {
      to: "/settings",
      icon: <UserGroupIcon className="size-5" />,
      label: "Settings",
      onClick: toggle,
    },
  ];

  const SidebarMenu = () => {
    return (
      <ul className="flex flex-col gap-1 text-left">
        {menuItems.map(({ to, icon, label, exact, onClick }) => (
          <li key={to} className="rounded-md hover:bg-zinc-100 cursor-pointer">
            <NavLink
              to={to}
              end={exact} // ✅ end отключает частичное совпадение
              className={({ isActive }) =>
                `flex w-full h-full items-center justify-between p-3 ${
                  isActive ? "bg-zinc-100 rounded-md" : ""
                }`
              }
              onClick={onClick}
            >
              <div className="flex items-center gap-2">
                {icon}
                {label}
              </div>
              {/* {count > 0 && <Badge variant="default">{count}</Badge>} */}
            </NavLink>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      // padding="md"
      padding={{ base: "md", sm: "lg", md: "xl", lg: "xl" }}
    >
      <AppShell.Header className=" flex items-center justify-between">
        <NavLink
          to={"/"}
          className=" ml-1 flex px-3 py-2 items-center font-openSans font-black text-2xl"
        >
          MINI2go
        </NavLink>
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="md"
          size="sm"
          mx={10}
        />
        <div className=" hidden lg:block px-4">
          <UserMenu onClick={toggle} />
        </div>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <div>{SidebarMenu()}</div>
        <div className="lg:hidden fixed bottom-2">
          <UserMenu onClick={toggle} />
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

import { AppShell, Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { NavLink, Outlet } from "react-router-dom";
import {
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  RocketLaunchIcon,
  TicketIcon,
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
      to: "/calendar",
      icon: <CalendarDaysIcon className="size-5" />,
      label: "Calendar",
      onClick: toggle,
      // count: unviewedCounts.draft,
    },
    {
      to: "/bookings",
      icon: <TicketIcon className="size-5" />,
      label: "Bookings",
      onClick: toggle,
      // count: unviewedCounts.draft,
    },
    {
      to: "/cars",
      icon: <RocketLaunchIcon className="size-5" />,
      label: "Cars",
      onClick: toggle,
      // count: mainNews.length,
    },
    {
      to: "/finance",
      icon: <BanknotesIcon className="size-5" />,
      label: "Finance",
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
      icon: <AdjustmentsHorizontalIcon className="size-5" />,
      label: "Settings",
      onClick: toggle,
    },
  ];

  const SidebarMenu = () => {
    return (
      <>
        <NavLink
          to={"/"}
          // className=" ml-1 flex px-3 py-2 items-center font-openSans font-bold text-xl"
          className="flex flex-col items-center shrink-0 font-roboto uppercase font-bold"
        >
          <img src="/icons/logow.png" className=" w-16 opacity-90" />
          <p className=" text-white/90 text-xs">MINI2GO</p>
        </NavLink>
        <ul className="flex flex-col gap-1 text-left mt-5">
          {menuItems.map(({ to, icon, label, exact, onClick }) => (
            <li
              key={to}
              className="rounded-md hover:bg-gradient-to-r hover:from-teal-900/40 from-30% hover:to-indigo-900/5 cursor-pointer text-white/90"
            >
              <NavLink
                to={to}
                end={exact} // ✅ end отключает частичное совпадение
                className={({ isActive }) =>
                  `flex w-full h-full items-center justify-between p-3 ${
                    isActive
                      ? "bg-gradient-to-r from-teal-900/90 from-30%  to-indigo-900/10 rounded-md"
                      : ""
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
      </>
    );
  };

  return (
    <AppShell
      layout="alt"
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      padding={{ base: "md", sm: "lg", md: "xl", lg: "xl" }}
    >
      <AppShell.Header
        className=" flex items-center justify-end"
        withBorder={false}
      >
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

      <AppShell.Navbar px="" bg={"#ffffffc9"} withBorder={false}>
        {/* #102d20cc #073b25  #184230*/}
        <div className=" absolute right-1 top-5">
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="md"
            size="sm"
            mx={10}
            color="white"
          />
        </div>

        <div className="h-full bg-gradient-to-r from-teal-950 from-5% to-emerald-800 to-95% p-3 ">
          <div>{SidebarMenu()}</div>
          <div className="lg:hidden fixed bottom-2">
            <UserMenu onClick={toggle} />
          </div>
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

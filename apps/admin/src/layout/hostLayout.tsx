import { AppShell, Burger, Drawer } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { NavLink, Outlet } from "react-router-dom";
import {
  AdjustmentsHorizontalIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  RocketLaunchIcon,
  TicketIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import UserMenu from "@/components/userMenu";
import { useCarsRealtime } from "@/hooks/useCarsRealtime";

export default function HostLayout() {
  useCarsRealtime();

  const [opened, { toggle }] = useDisclosure();

  const isMobile = useMediaQuery("(max-width: 48em)");

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
          to={"dashboard"}
          className="flex flex-col items-center shrink-0 font-roboto uppercase font-bold pt-2"
        >
          <img src="/icons/logo.png" className=" w-16 h-9 opacity-90" />
          <p className=" text-black text-xs">MINI2GO</p>
        </NavLink>
        <ul className="flex flex-col gap-2 text-left mt-8">
          {menuItems.map(({ to, icon, label, exact, onClick }) => (
            <li
              key={to}
              className="rounded-full hover:bg-zinc-100 cursor-pointer "
            >
              <NavLink
                to={to}
                end={exact} // ✅ end отключает частичное совпадение
                className={({ isActive }) =>
                  `flex w-full h-full items-center justify-between p-3 ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-600/90 from-30% to-emerald-500/90 rounded-full text-white "
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
      header={{ height: 72 }}
      navbar={{
        width: 260,
        breakpoint: "md",
        collapsed: { mobile: !opened },
      }}
      // bg={"#f1f1f1ad"}
      padding={{ base: "md", sm: "lg", md: "lg", lg: "lg" }}
    >
      <AppShell.Header
        className=" flex items-center justify-between lg:justify-end px-4"
        withBorder={false}
      >
        <NavLink
          to={"/"}
          className="lg:hidden flex flex-col items-center shrink-0 font-roboto uppercase font-bold"
        >
          <img src="/icons/logo.png" className=" w-14 opacity-90" />
        </NavLink>
        <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" />

        <div className="hidden lg:block">
          <UserMenu onClick={toggle} variant="host" />
        </div>
      </AppShell.Header>

      {!isMobile && (
        <AppShell.Navbar px="md" bg={"white"} withBorder={false}>
          <div className=" ">{SidebarMenu()}</div>
        </AppShell.Navbar>
      )}

      {isMobile && (
        <Drawer
          opened={opened}
          onClose={toggle}
          size="100%"
          withCloseButton={false}
          padding="lg"
          lockScroll
          trapFocus
          withinPortal
          overlayProps={{ opacity: 0.2 }}
          classNames={{
            body: "h-full",
          }}
        >
          <div className=" absolute right-1 top-4 mr-3">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
              // mx={10}
              color="black"
            />
          </div>
          <SidebarMenu />
          <div className="lg:hidden fixed left-7 right-7 bottom-4 text-black/80 border border-white/80 rounded-xl">
            <UserMenu onClick={toggle} variant="host" />
          </div>
        </Drawer>
      )}

      <AppShell.Main className=" bg-zinc-50 lg:absolute lg:top-[72px] lg:right-0 lg:left-[280px] lg:rounded-l-2xl">
        <div className="lg:-ml-[280px] lg:-mt-[72px] lg:pl-6">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}

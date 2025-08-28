// src/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./layout/layout";
import Dashboard from "./app/dashboard";
import CarsPage from "./app/cars";
import UsersPage from "./app/users";
import UserPage from "./app/user";
import UserSettings from "./app/user/userSettings";
import UserProfile from "./app/user/userProfile";
import UserMessages from "./app/user/userMessages";
import AddCarPage from "./app/cars/addCar";
import CarPageLayout from "./layout/carPageLayout";
import CarDetails from "./app/car/cardetails";
import Pricing from "./app/car/pricing";
import Distance from "./app/car/distance";
import Photos from "./app/car/photos";
import Location from "./app/car/location";
import Settings from "./app/car/settings";
import Parking from "./app/car/location/parking";
import Delivery from "./app/car/location/delivery";
import ExtraComponent from "./app/car/extras/extraComponent";
import Extras from "./app/car/extras";
import SettingsGlobal from "./app/settings";
import { carLayoutLoader } from "@/routes/carLayoutLoader";
import HydrateFallback from "./components/hydrateFallback";
import CarErrorBoundary from "./components/carErrorBoundary";
import Finance from "./app/finance";
import BookingsList from "./app/bookings";
import BookingPage from "./app/bookings/bookingPage";
import BookingEditor from "./app/bookings/bookingEditor";
import MiniLandingPage from "./app/landingpage";
import { calendarLoader } from "./routes/calendarLoader";
import Calendar from "./app/car/calendar";
import CalendarPage from "./app/calendarGant";
import { bookingsLoader } from "./routes/bookings.loader";
import { carsLoader } from "./routes/carsLoader";
import { usersLoader } from "./routes/users.loader";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    HydrateFallback: HydrateFallback,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "user", element: <Navigate to="/" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      {
        id: "calendar",
        path: "/calendar",
        loader: calendarLoader,
        // ВАЖНО: не перезапускаем loader, если изменился только ?month
        shouldRevalidate: ({ currentUrl, nextUrl }) => {
          if (currentUrl.pathname !== nextUrl.pathname) return true;

          const a = new URL(currentUrl);
          const b = new URL(nextUrl);
          a.searchParams.delete("month");
          b.searchParams.delete("month");

          // ревалидируем только если изменилось что-то ещё, кроме month
          return a.search !== b.search;
        },
        element: <CalendarPage />,
      },
      { id: "cars", path: "cars", loader: carsLoader, element: <CarsPage /> },
      { path: "cars/add", element: <AddCarPage /> },
      { path: "finance", element: <Finance /> },
      {
        id: "bookings",
        path: "/bookings",
        loader: bookingsLoader,
        element: <BookingsList />,
      },
      { path: "bookings/new", element: <BookingEditor /> },
      { path: "bookings/:bookingId", element: <BookingPage /> },
      {
        path: "/users",
        loader: usersLoader,
        element: <UsersPage />,
      },
      { path: "settings", element: <SettingsGlobal /> },
      {
        path: "user/:id",
        element: <UserPage />,
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: "profile", element: <UserProfile /> },
          { path: "settings", element: <UserSettings /> },
          { path: "messages", element: <UserMessages /> },
        ],
      },
    ],
  },
  {
    path: "cars/:carId",
    element: <CarPageLayout />,
    loader: carLayoutLoader, // <-- предзагрузка всех данных
    HydrateFallback: HydrateFallback,
    errorElement: <CarErrorBoundary />,
    shouldRevalidate: ({ currentParams, nextParams }) => {
      // Перегружать только если поменялся сам carId
      return currentParams?.carId !== nextParams?.carId;
    },

    // shouldRevalidate: () => false,
    children: [
      { index: true, element: <Navigate to="cardetails" replace /> },
      { path: "cardetails", element: <CarDetails /> },
      { path: "calendar", element: <Calendar /> },
      { path: "bookings/new", element: <BookingEditor /> },
      {
        path: "bookings/:bookingId/edit",
        element: <BookingEditor />,
      },
      { path: "pricing", element: <Pricing /> },
      { path: "distance", element: <Distance /> },
      { path: "photos", element: <Photos /> },
      { path: "extra", element: <Extras /> },
      { path: "extra/:extraId", element: <ExtraComponent /> },
      { path: "location", element: <Location /> },
      { path: "location/parking", element: <Parking /> },
      { path: "location/delivery", element: <Delivery /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "/landing", element: <MiniLandingPage /> },
]);

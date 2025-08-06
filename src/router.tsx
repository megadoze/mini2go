// src/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "./layout/layout";
import Dashboard from "./app/dashboard";
import CarsPage from "./app/cars";
import BookingsPage from "./app/bookings";
import UsersPage from "./app/users";
import UserPage from "./app/user";
import UserSettings from "./app/user/userSettings";
import UserProfile from "./app/user/userProfile";
import UserMessages from "./app/user/userMessages";
import AddCarPage from "./app/cars/addCar";
import CarPageLayout from "./layout/carPageLayout";
import CarDetails from "./app/car/cardetails";
import Calendar from "./app/car/calendar";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    HydrateFallback: HydrateFallback,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "user", element: <Navigate to="/" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "cars", element: <CarsPage /> },
      { path: "cars/add", element: <AddCarPage /> },
      { path: "finance", element: <Finance /> },
      { path: "bookings", element: <BookingsPage /> },
      { path: "users", element: <UsersPage /> },
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
    path: "cars/:id",
    element: <CarPageLayout />,
    loader: carLayoutLoader, // <-- предзагрузка всех данных
    HydrateFallback: HydrateFallback,
    errorElement: <CarErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="cardetails" replace /> },
      { path: "cardetails", element: <CarDetails /> },
      { path: "calendar", element: <Calendar /> },
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
]);

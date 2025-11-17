import { createBrowserRouter, Navigate } from "react-router-dom";
import Dashboard from "./app/dashboard";
import CarsPage from "./app/cars";
import UsersPage from "./app/users";
import { UserPage } from "./app/users/userPage";
import UserSettings from "./app/user/userSettings";
import UserProfile from "./app/user/userProfile";
import UserMessages from "./app/user/userMessages";
import AddCarPage from "./app/cars/carWizard/addCar";
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
import BookingsList from "./app/bookings";
import BookingEditor from "./app/bookings/bookingEditor";
import { calendarLoader } from "./routes/calendarLoader";
import Calendar from "./app/car/calendar";
import CalendarPage from "./app/calendarGant";
import { bookingsLoader } from "./routes/bookings.loader";
import { carsLoader } from "./routes/carsLoader";
import { dashboardLoader } from "./routes/dashboard.loader";
import AuthenticationPage from "./app/auth/authenticationPage";
import Protected from "./components/auth/protected";
import UserLayout from "./layout/userLayout";
import UserBookings from "./app/user/userBookings";
import UserDashboard from "./app/user/userDashboard";
import HomeRedirect from "./components/homeRedirect";
import HostGate from "./components/auth/hostGate";
import CarPageLayout from "./layout/carPageLayout";
import { userBookingsLoader } from "./routes/userBookings.loader";
import { authLoader } from "./routes/auth.loader";
import ScrollToTop from "./components/scrollToTop";
import HostPage from "./app/hosts/hostPage";
import { usersLoader } from "./routes/usersLoader";
import { settingsGlobalLoader } from "./routes/settingsGlobal.loader";
import OfflineAwareErrorBoundary from "./components/offlineAwareErrorBoundary";

export const router = createBrowserRouter([
  { path: "/auth", element: <AuthenticationPage /> },
  {
    id: "rootAuth",
    path: "/",
    loader: authLoader,
    element: (
      <Protected>
        <>
          <ScrollToTop />
          <HostGate />
        </>
      </Protected>
    ),
    errorElement: <OfflineAwareErrorBoundary />,
    HydrateFallback: HydrateFallback,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "dashboard", loader: dashboardLoader, element: <Dashboard /> },
      {
        id: "calendar",
        path: "calendar",
        loader: calendarLoader,
        element: <CalendarPage />,
      },
      { id: "cars", path: "cars", loader: carsLoader, element: <CarsPage /> },
      {
        id: "bookings",
        path: "bookings",
        loader: bookingsLoader,
        element: <BookingsList />,
      },
      { path: "bookings/:bookingId", element: <BookingEditor /> },
      { path: "bookings/new", element: <BookingEditor /> },
      {
        id: "users",
        path: "users",
        loader: usersLoader,
        element: <UsersPage />,
      },
      { path: "users/:userId", element: <UserPage /> },
      {
        id: "settings",
        path: "settings",
        loader: settingsGlobalLoader,
        element: <SettingsGlobal />,
      },
    ],
  },
  { path: "hosts/:hostId", element: <HostPage /> },
  {
    path: "/cars/add",
    element: (
      <Protected>
        <>
          <ScrollToTop />
          <AddCarPage />
        </>
      </Protected>
    ),
  },
  {
    id: "userAuth",
    path: "user/:id",
    loader: authLoader,
    element: (
      <Protected>
        <>
          <ScrollToTop />
          <UserLayout />
        </>
      </Protected>
    ),
    errorElement: <OfflineAwareErrorBoundary />,
    HydrateFallback: HydrateFallback,
    children: [
      { index: true, element: <Navigate to="profile" replace /> },
      { path: "profile", element: <UserProfile /> },
      { path: "dashboard", element: <UserDashboard /> },
      {
        id: "userBookings",
        path: "bookings",
        loader: userBookingsLoader,
        element: <UserBookings />,
      },
      { path: "bookings/:bookingId", element: <BookingEditor /> },
      { path: "settings", element: <UserSettings /> },
      { path: "messages", element: <UserMessages /> },
    ],
  },
  {
    path: "cars/:carId",
    element: (
      <Protected>
        <>
          <ScrollToTop />
          <CarPageLayout />
        </>
      </Protected>
    ),
    loader: carLayoutLoader,
    HydrateFallback,
    errorElement: <CarErrorBoundary />,
    shouldRevalidate: ({ currentParams, nextParams }) =>
      currentParams?.carId !== nextParams?.carId,
    children: [
      { index: true, element: <Navigate to="cardetails" replace /> },
      { path: "cardetails", element: <CarDetails /> },
      { path: "calendar", element: <Calendar /> },
      { path: "bookings/new", element: <BookingEditor /> },
      { path: "bookings/:bookingId/edit", element: <BookingEditor /> },
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

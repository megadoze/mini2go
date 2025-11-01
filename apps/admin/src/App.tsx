// src/App.tsx
import { MantineProvider, createTheme } from "@mantine/core";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";

const theme = createTheme({ cursorType: "pointer" });

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <MantineProvider theme={theme}>
        <RouterProvider router={router} />
      </MantineProvider>
    </>
  );
}

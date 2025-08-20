import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import "./index.css";
import "/src/styles/fonts.css";
import "./App.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/tiptap/styles.css";
import "@mantine/dropzone/styles.css";
import "prosemirror-view/style/prosemirror.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // меньше «дёрганий» сети, особенно при таб-switch
      refetchOnWindowFocus: false,
      retry: 1,
      // можешь поставить 15_000, если хочешь кеш посвежее без мгновенного refetch
      staleTime: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* девтулы - только в dev */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";

type AuthTheme = "dark" | "light" | "system";

interface AuthenticationFormProps {
  theme?: AuthTheme;
}

const mainPhoto =
  "https://mediapool.bmwgroup.com/cache/P9/202407/P90562597/P90562597-mini-john-cooper-works-convertible-10-2024-600px.jpg";

export function AuthenticationForm({
  theme = "system",
}: AuthenticationFormProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [type, setType] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [themeMode, setThemeMode] = useState<AuthTheme>(theme);
  const [isLight, setIsLight] = useState(false);

  // --- theme init from localStorage ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("auth-theme-mode");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeMode(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("auth-theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode === "light") {
      setIsLight(true);
      return;
    }
    if (themeMode === "dark") {
      setIsLight(false);
      return;
    }

    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      setIsLight(mq.matches);

      const handleChange = (event: MediaQueryListEvent) => {
        setIsLight(event.matches);
      };

      if (mq.addEventListener) {
        mq.addEventListener("change", handleChange);
        return () => mq.removeEventListener("change", handleChange);
      } else {
        // @ts-ignore
        mq.addListener(handleChange);
        return () => {
          // @ts-ignore
          mq.removeListener(handleChange);
        };
      }
    } else {
      setIsLight(false);
    }
  }, [themeMode]);

  function cycleThemeMode() {
    setThemeMode((prev) =>
      prev === "system" ? "light" : prev === "light" ? "dark" : "system"
    );
  }

  function safeRedirect(path?: string | null) {
    if (!path || !path.startsWith("/")) return "/dashboard";
    return path;
  }

  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("redirect");
    const state = location.state as { from?: Location } | null;
    const fromState = state?.from
      ? state.from.pathname +
        (state.from.search ?? "") +
        (state.from.hash ?? "")
      : null;
    return safeRedirect(fromQuery || fromState);
  }, [location]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    try {
      if (type === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate(redirectTarget, { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (data.session) {
          navigate(redirectTarget, { replace: true });
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Auth failed");
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setAuthError(null);
    setSubmitting(true);
    try {
      let redirectTo: string | undefined = undefined;
      if (typeof window !== "undefined") {
        redirectTo = window.location.origin + redirectTarget;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || "Google auth failed");
      setSubmitting(false);
    }
  }

  const themeLabel =
    themeMode === "system" ? "Auto" : themeMode === "light" ? "Light" : "Dark";
  const themeIcon =
    themeMode === "system" ? "🌀" : themeMode === "light" ? "☀️" : "🌙";

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden ${
        isLight ? "bg-slate-100" : "bg-slate-950"
      }`}
    >
      {/* переключатель темы */}
      <button
        type="button"
        onClick={cycleThemeMode}
        className={`absolute right-4 top-4 flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur ${
          isLight
            ? "border-slate-300 bg-white/70 text-slate-700 hover:bg-white"
            : "border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-900"
        }`}
      >
        <span>{themeIcon}</span>
        <span>{themeLabel}</span>
      </button>

      {/* фоновые подсветки */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute -left-24 top-0 h-72 w-72 rounded-full blur-3xl ${
            isLight ? "bg-emerald-300/40" : "bg-emerald-500/20"
          }`}
        />
        <div
          className={`absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl ${
            isLight ? "bg-sky-300/40" : "bg-sky-500/20"
          }`}
        />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-4 py-8">
        <div
          className={`relative grid overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl md:grid-cols-[1.1fr_1fr] ${
            isLight
              ? "border-slate-200 bg-white/90"
              : "border-white/10 bg-slate-900/70"
          }`}
        >
          {/* индикатор загрузки */}
          {submitting && (
            <div className="absolute inset-x-0 top-0 h-0.5">
              <div className="h-full w-full animate-pulse bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400" />
            </div>
          )}

          {/* левая картинка с fade при смене темы */}
          <AnimatePresence mode="wait">
            {isLight ? (
              <motion.div
                key="image-light"
                className="relative hidden md:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <img
                  src={mainPhoto}
                  alt="People working at laptops"
                  className="max-h-[600px] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8 text-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                    Welcome
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    Добро пожаловать в панель
                  </h2>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Управляй своим проектом в одном месте — достаточно одного
                    логина.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="image-dark"
                className="relative hidden md:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <img
                  src={mainPhoto}
                  alt="People working at laptops"
                  className="max-h-[600px] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8 text-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                    Welcome
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    Добро пожаловать в панель
                  </h2>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Управляй своим проектом в одном месте — достаточно одного
                    логина.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* правая часть — с анимацией между login/register */}
          <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {/* хедер */}
                <div className="mb-6 text-center md:text-left">
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.25em] ${
                      isLight ? "text-emerald-500" : "text-emerald-400"
                    }`}
                  >
                    {type === "login" ? "Sign in" : "Create account"}
                  </p>
                  <h1
                    className={`mt-2 text-2xl font-bold ${
                      isLight ? "text-slate-900" : "text-slate-50"
                    }`}
                  >
                    {type === "login"
                      ? "С возвращением 👋"
                      : "Присоединяйся 🚀"}
                  </h1>
                  <p
                    className={`mt-1 text-sm ${
                      isLight ? "text-slate-500" : "text-slate-300"
                    }`}
                  >
                    {type === "login"
                      ? "Введи свои данные, чтобы продолжить."
                      : "Заполни поля, чтобы начать."}
                  </p>
                </div>

                {authError && (
                  <div
                    className={`mb-4 rounded-2xl border px-3 py-2 text-xs ${
                      isLight
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-red-500/40 bg-red-500/10 text-red-200"
                    }`}
                  >
                    {authError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {type === "register" && (
                    <div>
                      <label
                        className={`mb-1 block text-xs font-medium uppercase tracking-wide ${
                          isLight ? "text-slate-700" : "text-slate-300"
                        }`}
                      >
                        Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 ${
                          isLight
                            ? "border-slate-200 bg-white text-slate-900"
                            : "border-slate-700 bg-slate-900/70 text-slate-100"
                        }`}
                      />
                    </div>
                  )}

                  <div>
                    <label
                      className={`mb-1 block text-xs font-medium uppercase tracking-wide ${
                        isLight ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 ${
                        isLight
                          ? "border-slate-200 bg-white text-slate-900"
                          : "border-slate-700 bg-slate-900/70 text-slate-100"
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      className={`mb-1 block text-xs font-medium uppercase tracking-wide ${
                        isLight ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        className={`w-full rounded-xl border px-3 py-2 pr-10 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 ${
                          isLight
                            ? "border-slate-200 bg-white text-slate-900"
                            : "border-slate-700 bg-slate-900/70 text-slate-100"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute inset-y-0 right-0 flex items-center pr-3 transition ${
                          isLight
                            ? "text-slate-400 hover:text-slate-600"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="size-4" />
                        ) : (
                          <EyeIcon className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`mt-2 flex w-full items-center justify-center rounded-xl py-2 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isLight
                        ? "bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-400"
                        : "bg-emerald-500 text-slate-950 shadow-emerald-500/30 hover:bg-emerald-400"
                    }`}
                  >
                    {submitting
                      ? "Loading..."
                      : type === "login"
                      ? "Login"
                      : "Register"}
                  </button>
                </form>

                {/* разделитель + social */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-px flex-1 ${
                        isLight ? "bg-slate-200" : "bg-slate-700/70"
                      }`}
                    />
                    <span
                      className={`text-[10px] uppercase tracking-[0.25em] ${
                        isLight ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      или
                    </span>
                    <div
                      className={`h-px flex-1 ${
                        isLight ? "bg-slate-200" : "bg-slate-700/70"
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={submitting}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isLight
                          ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          : "border-slate-700/80 bg-slate-900/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                      }`}
                    >
                      Войти через Google
                    </button>
                    <button
                      type="button"
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                        isLight
                          ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          : "border-slate-700/80 bg-slate-900/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                      }`}
                    >
                      Войти через GitHub
                    </button>
                  </div>
                </div>

                <p
                  className={`mt-5 text-center text-xs ${
                    isLight ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {type === "login" ? (
                    <>
                      Нет аккаунта?{" "}
                      <button
                        type="button"
                        onClick={() => setType("register")}
                        className={`font-medium ${
                          isLight
                            ? "text-emerald-600 hover:underline"
                            : "text-emerald-400 hover:underline"
                        }`}
                      >
                        Зарегистрироваться
                      </button>
                    </>
                  ) : (
                    <>
                      Уже есть аккаунт?{" "}
                      <button
                        type="button"
                        onClick={() => setType("login")}
                        className={`font-medium ${
                          isLight
                            ? "text-emerald-600 hover:underline"
                            : "text-emerald-400 hover:underline"
                        }`}
                      >
                        Войти
                      </button>
                    </>
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// import { useMemo, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { supabase } from "@/lib/supabase";
// import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

// export function AuthenticationForm() {
//   const navigate = useNavigate();
//   const location = useLocation();

//   const [type, setType] = useState<"login" | "register">("login");
//   const [submitting, setSubmitting] = useState(false);
//   const [authError, setAuthError] = useState<string | null>(null);
//   const [showPassword, setShowPassword] = useState(false);

//   function safeRedirect(path?: string | null) {
//     if (!path || !path.startsWith("/")) return "/dashboard";
//     return path;
//   }

//   const redirectTarget = useMemo(() => {
//     const params = new URLSearchParams(location.search);
//     const fromQuery = params.get("redirect");
//     const state = location.state as { from?: Location } | null;
//     const fromState = state?.from
//       ? state.from.pathname +
//         (state.from.search ?? "") +
//         (state.from.hash ?? "")
//       : null;
//     return safeRedirect(fromQuery || fromState);
//   }, [location]);

//   async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
//     e.preventDefault();
//     setAuthError(null);
//     setSubmitting(true);

//     const formData = new FormData(e.currentTarget);
//     const email = formData.get("email") as string;
//     const password = formData.get("password") as string;
//     const name = formData.get("name") as string;

//     try {
//       if (type === "login") {
//         const { error } = await supabase.auth.signInWithPassword({
//           email,
//           password,
//         });
//         if (error) throw error;
//         navigate(redirectTarget, { replace: true });
//       } else {
//         const { data, error } = await supabase.auth.signUp({
//           email,
//           password,
//           options: { data: { name } },
//         });
//         if (error) throw error;
//         if (data.session) {
//           navigate(redirectTarget, { replace: true });
//         }
//       }
//     } catch (err: any) {
//       setAuthError(err.message || "Auth failed");
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
//       {/* неоновые пятна */}
//       <div className="pointer-events-none absolute inset-0">
//         <div className="absolute -left-12 top-0 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
//         <div className="absolute bottom-[-80px] right-[-40px] h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
//         <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />
//       </div>

//       <div className="relative z-10 w-full max-w-4xl px-4 py-8 md:px-6">
//         <div className="relative grid overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:grid-cols-[1.1fr_1fr]">
//           {/* индикатор загрузки */}
//           {submitting && (
//             <div className="absolute inset-x-0 top-0 h-0.5">
//               <div className="h-full w-full animate-pulse bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400" />
//             </div>
//           )}

//           {/* левая часть с картинкой */}
//           <div className="relative hidden md:block">
//             <img
//               src="https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80"
//               alt="Abstract neon tech"
//               className="h-full w-full object-cover"
//             />
//             <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
//             <div className="absolute inset-x-0 bottom-0 p-8 text-slate-50">
//               <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300/90">
//                 Control Panel
//               </p>
//               <h2 className="mt-3 text-2xl font-semibold">
//                 Управляй продуктом, не отвлекаясь
//               </h2>
//               <p className="mt-2 text-sm text-slate-200/85">
//                 Вся аналитика, пользователи и настройки — в одном месте. Просто
//                 войди и продолжай с того, где остановился.
//               </p>
//             </div>
//           </div>

//           {/* правая часть — форма */}
//           <div className="flex flex-col justify-center px-6 py-8 sm:px-8 sm:py-10">
//             {/* хедер + переключатель логин/регистрация */}
//             <div className="mb-6">
//               <div className="flex items-center justify-between gap-3">
//                 <div>
//                   <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
//                     {type === "login" ? "Sign in" : "Create account"}
//                   </p>
//                   <h1 className="mt-2 text-2xl font-bold text-slate-50">
//                     {type === "login"
//                       ? "С возвращением 👋"
//                       : "Добро пожаловать 🚀"}
//                   </h1>
//                   <p className="mt-1 text-sm text-slate-300">
//                     {type === "login"
//                       ? "Введи свои данные, чтобы продолжить."
//                       : "Заполни пару полей — и ты в системе."}
//                   </p>
//                 </div>

//                 <div className="hidden rounded-full bg-slate-900/60 p-1 text-[11px] font-medium text-slate-300 shadow-inner shadow-black/40 sm:flex">
//                   <button
//                     type="button"
//                     onClick={() => setType("login")}
//                     className={`rounded-full px-3 py-1 transition ${
//                       type === "login"
//                         ? "bg-slate-800 text-emerald-300 shadow-sm shadow-emerald-500/30"
//                         : "text-slate-400 hover:text-slate-200"
//                     }`}
//                   >
//                     Login
//                   </button>
//                   <button
//                     type="button"
//                     onClick={() => setType("register")}
//                     className={`rounded-full px-3 py-1 transition ${
//                       type === "register"
//                         ? "bg-slate-800 text-emerald-300 shadow-sm shadow-emerald-500/30"
//                         : "text-slate-400 hover:text-slate-200"
//                     }`}
//                   >
//                     Register
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {authError && (
//               <div className="mb-4 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
//                 <span className="mt-[2px] inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
//                 <span>{authError}</span>
//               </div>
//             )}

//             <form onSubmit={handleSubmit} className="space-y-4">
//               {type === "register" && (
//                 <div>
//                   <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
//                     Name
//                   </label>
//                   <input
//                     type="text"
//                     name="name"
//                     className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
//                   />
//                 </div>
//               )}

//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
//                   Email
//                 </label>
//                 <input
//                   type="email"
//                   name="email"
//                   required
//                   className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
//                 />
//               </div>

//               <div>
//                 <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">
//                   Password
//                 </label>
//                 <div className="relative">
//                   <input
//                     type={showPassword ? "text" : "password"}
//                     name="password"
//                     required
//                     className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 pr-10 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword(!showPassword)}
//                     className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-100"
//                   >
//                     {showPassword ? (
//                       <EyeSlashIcon className="size-4" />
//                     ) : (
//                       <EyeIcon className="size-4" />
//                     )}
//                   </button>
//                 </div>
//               </div>

//               <button
//                 type="submit"
//                 disabled={submitting}
//                 className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-400 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/35 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
//               >
//                 {submitting
//                   ? "Processing..."
//                   : type === "login"
//                   ? "Login"
//                   : "Register"}
//               </button>
//             </form>

//             {/* mobile переключатель */}
//             <p className="mt-5 text-center text-xs text-slate-400 sm:hidden">
//               {type === "login" ? (
//                 <>
//                   Нет аккаунта?{" "}
//                   <button
//                     type="button"
//                     onClick={() => setType("register")}
//                     className="font-medium text-emerald-400 hover:underline"
//                   >
//                     Зарегистрироваться
//                   </button>
//                 </>
//               ) : (
//                 <>
//                   Уже есть аккаунт?{" "}
//                   <button
//                     type="button"
//                     onClick={() => setType("login")}
//                     className="font-medium text-emerald-400 hover:underline"
//                   >
//                     Войти
//                   </button>
//                 </>
//               )}
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

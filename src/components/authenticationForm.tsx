import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

export function AuthenticationForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const [type, setType] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
      {/* контейнер: на мобиле без рамки, на md+ рамка/тень */}
      <div className="w-full max-w-sm p-6 md:rounded-xl md:bg-white md:shadow-lg">
        <h1 className="mb-4 text-center text-xl font-bold">
          {type === "login" ? "Login" : "Register"}
        </h1>

        {authError && (
          <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-600">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === "register" && (
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                type="text"
                name="name"
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                className="w-full rounded border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring focus:ring-green-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
              >
                {showPassword ? <EyeSlashIcon className="size-4"/> : <EyeIcon className="size-4"/>}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-emerald-600 py-2 text-white hover:bg-emerald-600/90 disabled:opacity-50"
          >
            {submitting
              ? "Loading..."
              : type === "login"
              ? "Login"
              : "Register"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          {type === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setType("register")}
                className="text-emerald-600 hover:underline"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setType("login")}
                className="text-emerald-600 hover:underline"
              >
                Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

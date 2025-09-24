import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function AuthenticationForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const [type, setType] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
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
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-300"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
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
                className="text-blue-600 hover:underline"
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
                className="text-blue-600 hover:underline"
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

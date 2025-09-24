// src/components/AuthenticationForm.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Anchor,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  type PaperProps,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Alert,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { upperFirst, useToggle } from "@mantine/hooks";
import { supabase } from "@/lib/supabase";

type AuthFormValues = {
  email: string;
  name: string;
  password: string;
  terms: boolean;
};

export function AuthenticationForm(props: PaperProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [type, toggle] = useToggle(["login", "register"]); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const form = useForm<AuthFormValues>({
    initialValues: {
      email: "",
      name: "",
      password: "",
      terms: true,
    },
    validate: {
      email: (val) => (/^\S+@\S+$/.test(val) ? null : "Invalid email"),
      password: (val) =>
        val.length < 6 ? "Password should include at least 6 characters" : null,
      // terms проверяем только когда type === 'register' (в сабмите ниже)
    },
  });

  function safeRedirect(path?: string | null) {
    // защита от внешних URL: разрешаем только внутренние пути
    if (!path || !path.startsWith("/")) return "/dashboard";
    return path;
  }

  const redirectTarget = useMemo(() => {
    // 1) приоритет: query ?redirect=...
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("redirect");

    // 2) fallback: location.state.from (если не было перезагрузки /auth)
    const state = location.state as { from?: Location } | null;
    const fromState = state?.from
      ? state.from.pathname +
        (state.from.search ?? "") +
        (state.from.hash ?? "")
      : null;

    return safeRedirect(fromQuery || fromState);
  }, [location]);

  async function handleSubmit(values: AuthFormValues) {
    setAuthError(null);
    setAuthSuccess(null);

    // базовая проверка формы
    const { hasErrors } = form.validate();
    if (hasErrors) return;

    // простая проверка terms только для регистрации
    if (type === "register" && !values.terms) {
      form.setFieldError("terms", "You must accept terms");
      return;
    }

    setSubmitting(true);
    try {
      if (type === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;

        setAuthSuccess("Logged in successfully!");
        navigate(redirectTarget, { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { name: values.name } },
        });
        if (error) throw error;

        if (!data.session) {
          setAuthSuccess(
            "Registration successful. Check your email to confirm your account."
          );
        } else {
          setAuthSuccess("Registered and signed in!");
          navigate(redirectTarget, { replace: true });
        }
      }

      form.setFieldValue("password", "");
    } catch (err: any) {
      const msg =
        err?.message ||
        (type === "login"
          ? "Failed to login. Check your credentials."
          : "Failed to register.");
      setAuthError(msg);

      if (/password/i.test(msg)) form.setFieldError("password", msg);
      if (/email/i.test(msg)) form.setFieldError("email", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper radius="md" p="lg" withBorder {...props}>
      <Text size="lg" fw={500}>
        Welcome to MINI2GO, {type} with email
      </Text>

      <Divider label="Continue with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          {type === "register" && (
            <TextInput
              label="Name"
              placeholder="Your name"
              value={form.values.name}
              onChange={(e) =>
                form.setFieldValue("name", e.currentTarget.value)
              }
              radius="md"
            />
          )}

          <TextInput
            required
            label="Email"
            placeholder="you@example.com"
            value={form.values.email}
            onChange={(e) => form.setFieldValue("email", e.currentTarget.value)}
            error={form.errors.email}
            radius="md"
            type="email"
            autoComplete="email"
          />

          <PasswordInput
            required
            label="Password"
            placeholder="Your password"
            value={form.values.password}
            onChange={(e) =>
              form.setFieldValue("password", e.currentTarget.value)
            }
            error={form.errors.password}
            radius="md"
            autoComplete={
              type === "login" ? "current-password" : "new-password"
            }
          />

          {type === "register" && (
            <Checkbox
              label="I accept terms and conditions"
              checked={form.values.terms}
              onChange={(e) =>
                form.setFieldValue("terms", e.currentTarget.checked)
              }
              error={form.errors.terms}
            />
          )}

          {authError && (
            <Alert color="red" variant="light">
              {authError}
            </Alert>
          )}
          {authSuccess && (
            <Alert color="green" variant="light">
              {authSuccess}
            </Alert>
          )}
        </Stack>

        <Group justify="space-between" mt="xl">
          <Anchor
            component="button"
            type="button"
            c="dimmed"
            onClick={() => toggle()}
            size="xs"
          >
            {type === "register"
              ? "Already have an account? Login"
              : "Don't have an account? Register"}
          </Anchor>
          <Button type="submit" radius="xl" loading={submitting}>
            {upperFirst(type)}
          </Button>
        </Group>
      </form>
    </Paper>
  );
}

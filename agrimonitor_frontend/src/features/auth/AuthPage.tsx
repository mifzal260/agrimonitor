import { useState } from "react";
import { useTranslation } from "react-i18next";

import { login, register } from "../../api/auth";
import { clearToken } from "../../auth/authStorage";
import type { AuthResponse } from "../../types/auth";

type AuthView = "login" | "register";

type AuthPageProps = {
  onAuthenticated: (response: AuthResponse) => void;
};

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<AuthView>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearToken();
    setError("");
    setIsLoading(true);

    try {
      const response =
        view === "register"
          ? await register({ name, email, password })
          : await login({ email, password });
      onAuthenticated(response);
    } catch (err) {
      clearToken();
      setError(err instanceof Error ? err.message : t("auth.authenticationFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-field-50 px-5 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-field-700">{t("common.appName")}</p>
        <h1 className="mt-2 text-3xl font-bold">{view === "login" ? t("auth.login") : t("auth.register")}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">{t("auth.intro")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-field-100 bg-white p-5 shadow-sm">
          {view === "register" && (
            <label className="block text-sm font-medium text-slate-800">
              {t("auth.name")}
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-field-700"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                required
              />
            </label>
          )}

          <label className="block text-sm font-medium text-slate-800">
            {t("auth.email")}
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-field-700"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            {t("auth.password")}
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-field-700"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={view === "register" ? 8 : 1}
              required
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            className="w-full rounded-md bg-field-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? t("common.pleaseWait") : view === "login" ? t("auth.login") : t("auth.createAccount")}
          </button>
        </form>

        <button
          className="mt-4 text-left text-sm font-medium text-field-700"
          type="button"
          onClick={() => {
            setView(view === "login" ? "register" : "login");
            setError("");
          }}
        >
          {view === "login" ? t("auth.needAccount") : t("auth.alreadyRegistered")}
        </button>
      </section>
    </main>
  );
}




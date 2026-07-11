import { useState } from "react";

import { login, register } from "../../api/auth";
import type { AuthResponse } from "../../types/auth";

type AuthView = "login" | "register";

type AuthPageProps = {
  onAuthenticated: (response: AuthResponse) => void;
};

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [view, setView] = useState<AuthView>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response =
        view === "register"
          ? await register({ name, email, password })
          : await login({ email, password });
      onAuthenticated(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-field-50 px-5 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-field-700">AgriMonitor</p>
        <h1 className="mt-2 text-3xl font-bold">{view === "login" ? "Login" : "Register"}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Access your farm monitoring workspace. The first registered account becomes the system administrator.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-field-100 bg-white p-5 shadow-sm">
          {view === "register" && (
            <label className="block text-sm font-medium text-slate-800">
              Name
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
            Email
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-field-700"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Password
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
            {isLoading ? "Please wait..." : view === "login" ? "Login" : "Create account"}
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
          {view === "login" ? "Need an account? Register" : "Already registered? Login"}
        </button>
      </section>
    </main>
  );
}

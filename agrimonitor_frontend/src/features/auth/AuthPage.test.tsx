import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "../../i18n";

import { ApiError } from "../../api/client";
import type { AuthResponse } from "../../types/auth";
import { login } from "../../api/auth";
import { AuthPage } from "./AuthPage";

vi.mock("../../api/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

describe("AuthPage login protection UI", () => {
  it("disables the login button while login request is active", async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: AuthResponse) => void = () => undefined;
    vi.mocked(login).mockReturnValue(new Promise((resolve) => {
      resolveLogin = resolve;
    }) as ReturnType<typeof login>);

    render(<AuthPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText(/emel|email/i), "farmer@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /log masuk|login/i }));

    expect(screen.getByRole("button", { name: /sila tunggu|please wait/i })).toBeDisabled();
    resolveLogin({ access_token: "token", token_type: "bearer", user: { id: 1, name: "Farmer", email: "farmer@example.com", role: "user" } });
  });

  it("shows a generic message for invalid login", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValue(new ApiError("backend detail", 401));

    render(<AuthPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText(/emel|email/i), "missing@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /log masuk|login/i }));

    expect(await screen.findByText("Nama pengguna atau kata laluan tidak sah.")).toBeInTheDocument();
    expect(screen.queryByText("backend detail")).not.toBeInTheDocument();
  });

  it("shows retry guidance for rate limited login", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValue(new ApiError("Too many attempts", 429, 60));

    render(<AuthPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText(/emel|email/i), "farmer@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /log masuk|login/i }));

    expect(await screen.findByText(/60 saat|60 seconds/i)).toBeInTheDocument();
  });

  it("shows a generic service message and re-enables login after 503", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValue(new ApiError("redis://secret@internal-host", 503));

    render(<AuthPage onAuthenticated={vi.fn()} />);
    await user.type(screen.getByLabelText(/emel|email/i), "farmer@example.com");
    await user.type(screen.getByLabelText(/kata laluan|password/i), "password123");
    await user.click(screen.getByRole("button", { name: /log masuk|login/i }));

    expect(await screen.findByText("Perkhidmatan log masuk tidak tersedia buat sementara waktu. Sila cuba lagi.")).toBeInTheDocument();
    expect(screen.queryByText(/internal-host|redis:\/\//i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log masuk|login/i })).toBeEnabled();
  });
});

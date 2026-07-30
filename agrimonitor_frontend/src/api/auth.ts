import { apiRequest } from "./client";
import type { AuthResponse, User } from "../types/auth";

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export function register(payload: RegisterPayload) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function logoutAll() {
  return apiRequest<void>("/auth/logout-all", { method: "POST" });
}

export function changePassword(payload: ChangePasswordPayload) {
  return apiRequest<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe() {
  return apiRequest<User>("/auth/me");
}

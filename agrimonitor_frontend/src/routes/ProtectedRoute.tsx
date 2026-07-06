import type { ReactNode } from "react";
import type { User } from "../types/auth";

type ProtectedRouteProps = {
  user: User | null;
  children: ReactNode;
  fallback: ReactNode;
};

export function ProtectedRoute({ user, children, fallback }: ProtectedRouteProps) {
  if (!user) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};
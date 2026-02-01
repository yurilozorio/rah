"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: "USER" | "ADMIN";
};

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("authToken");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch<AuthUser>("/me", {}, token)
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, [token]);

  const logout = () => {
    window.localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
  };

  return {
    token,
    setToken,
    user,
    setUser,
    logout
  };
};

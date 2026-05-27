"use client";

import { AuthProvider } from "../context/AuthContext";

export default function AuthProviderClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}

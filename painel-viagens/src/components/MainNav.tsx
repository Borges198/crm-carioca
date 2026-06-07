"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { auth } from "../lib/firebase";
import AccessProfileBadge from "./AccessProfileBadge";

const NAV_ITEMS = [
  { href: "/", label: "Nova cotação" },
  { href: "/historico", label: "Histórico" },
  { href: "/leads", label: "Leads" },
  { href: "/clientes", label: "Clientes" },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, accessProfile, isAdmin, profileLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const navItems = isAdmin || (!profileLoading && (accessProfile.role === "admin" || accessProfile.role === "supervisor"))
    ? [...NAV_ITEMS, { href: "/usuarios", label: "Usuários" }]
    : NAV_ITEMS;

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Não foi possível sair da conta. Tente novamente.");
    } finally {
      setIsSigningOut(false);
    }
  }

  if (!user || pathname === "/login") {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="min-w-0">
          <p className="text-xs font-black uppercase tracking-widest text-blue-700">
            Voo Singular
          </p>
          <p className="text-sm font-bold text-slate-700">
            Painel de Viagens
          </p>
        </Link>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <AccessProfileBadge />

          <nav aria-label="Navegação principal" className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? "Saindo..." : "Sair"}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { href: "/", label: "Nova cotação" },
  { href: "/historico", label: "Histórico" },
  { href: "/leads", label: "Leads" },
  { href: "/clientes", label: "Clientes" },
];

export default function MainNav() {
  const pathname = usePathname();
  const { user } = useAuth();

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

        <nav aria-label="Navegação principal" className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {NAV_ITEMS.map((item) => {
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
        </nav>
      </div>
    </header>
  );
}

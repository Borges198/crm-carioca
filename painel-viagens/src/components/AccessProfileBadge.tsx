"use client";

import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

const ROLE_LABELS: Record<UserRole, string> = {
  agent: "Agente",
  supervisor: "Supervisor",
  admin: "Admin",
};

export default function AccessProfileBadge() {
  const { accessProfile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
        Carregando perfil...
      </div>
    );
  }

  return (
    <div className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
      <span>Perfil: {ROLE_LABELS[accessProfile.role]}</span>
      {accessProfile.agencyId && (
        <span className="ml-2 border-l border-slate-300 pl-2">
          Agência: {accessProfile.agencyId}
        </span>
      )}
    </div>
  );
}

export type UserRole = 'agent' | 'supervisor' | 'admin';
export type UserProfileStatus = 'pendente' | 'aprovado' | 'bloqueado';

export interface AccessProfile {
  role: UserRole;
  agencyId?: string;
}

export const DEFAULT_AGENCY_ID = 'voo-singular';
export const DEFAULT_ACCESS_PROFILE: AccessProfile = { role: 'agent' };

export function isUserRole(value: unknown): value is UserRole {
  return value === 'agent' || value === 'supervisor' || value === 'admin';
}

export function buildAccessProfileFromUsuario(data: unknown): AccessProfile {
  if (!data || typeof data !== 'object') {
    return DEFAULT_ACCESS_PROFILE;
  }

  const usuario = data as {
    status?: unknown;
    role?: unknown;
    agencyId?: unknown;
  };

  if (usuario.status !== 'aprovado' || !isUserRole(usuario.role)) {
    return DEFAULT_ACCESS_PROFILE;
  }

  const accessProfile: AccessProfile = { role: usuario.role };

  if (typeof usuario.agencyId === 'string' && usuario.agencyId.trim()) {
    accessProfile.agencyId = usuario.agencyId;
  }

  return accessProfile;
}

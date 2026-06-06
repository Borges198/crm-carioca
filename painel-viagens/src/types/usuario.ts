import type { UserProfileStatus, UserRole } from './access';

export interface UsuarioPerfil {
  uid: string;
  status?: UserProfileStatus | string;
  role?: UserRole | string;
  agencyId?: string;
}

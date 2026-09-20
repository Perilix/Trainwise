import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api';
import type { ApiUser } from '@/lib/api-types';

/**
 * Le compte lui-même : identité, adresse, mot de passe, suppression.
 *
 * Ces quatre appels ne dépendent pas du rôle — un coach et un athlète gèrent
 * leur compte de la même façon, sur les mêmes routes.
 */
export function useAccountActions() {
  const { status, user, updateUser } = useSession();
  const live = status === 'signedIn';

  return {
    async updateIdentity(patch: { firstName: string; lastName: string }) {
      if (!user) return;
      if (!live) {
        updateUser({ ...user, ...patch });
        return;
      }
      updateUser(await api<ApiUser>('/api/auth/profile', { method: 'PATCH', body: patch }));
    },
    async changeEmail(email: string, password: string) {
      if (!user || !live) return;
      const { email: saved } = await api<{ email: string }>('/api/auth/email', { method: 'PATCH', body: { email, password } });
      updateUser({ ...user, email: saved });
    },
    async changePassword(currentPassword: string, newPassword: string) {
      if (!live) return;
      await api('/api/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
    },
    async deleteAccount() {
      if (!live) return;
      await api('/api/auth/account', { method: 'DELETE' });
    },
  };
}

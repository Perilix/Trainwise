import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import type { AuthResponse } from '@/lib/api-types';

/** L'utilisateur a fermé la feuille de connexion : on ne montre pas d'erreur. */
export class SocialSignInCancelled extends Error {
  constructor() {
    super('Connexion annulée');
    this.name = 'SocialSignInCancelled';
  }
}

// --- Google -----------------------------------------------------------------
// Flux OAuth dans le navigateur système (fonctionne dans Expo Go, contrairement
// aux modules Google natifs qui exigent un build de développement).
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const googleClientId = () =>
  (Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  }) || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ?? '';

export const googleAvailable = () => !!googleClientId();

export async function signInWithGoogleToken(): Promise<AuthResponse> {
  const clientId = googleClientId();
  if (!clientId) throw new Error('Connexion Google non configurée');

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'trainwise', path: 'auth/google' });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    // `id_token` seul : le serveur n'a besoin que de vérifier l'identité.
    responseType: AuthSession.ResponseType.IdToken,
    extraParams: { nonce: Crypto.randomUUID() },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new SocialSignInCancelled();
  if (result.type !== 'success') throw new Error('Connexion Google impossible');

  const idToken = result.params.id_token;
  if (!idToken) throw new Error('Connexion Google impossible');

  return api<AuthResponse>('/api/auth/google', { method: 'POST', body: { idToken } });
}

// --- Apple ------------------------------------------------------------------
export const appleAvailable = async () => Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());

export async function signInWithAppleToken(): Promise<AuthResponse> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });

    if (!credential.identityToken) throw new Error('Connexion Apple impossible');

    // Apple ne transmet le nom qu'à la toute première autorisation : on le relaie
    // pour que le compte ne soit pas créé sans identité.
    return await api<AuthResponse>('/api/auth/apple', {
      method: 'POST',
      body: {
        identityToken: credential.identityToken,
        fullName: credential.fullName ? { givenName: credential.fullName.givenName, familyName: credential.fullName.familyName } : undefined,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SocialSignInCancelled();
    throw error;
  }
}

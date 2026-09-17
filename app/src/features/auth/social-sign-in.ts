import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
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
// Flux OAuth dans le navigateur système : pas de module natif, mais une adresse
// de retour que seul un vrai build sait recevoir (cf. `googleAvailable`).
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

/**
 * Google refuse le schéma d'Expo Go (`exp://`) comme adresse de retour : la
 * connexion Google n'existe que dans un vrai build, où l'app répond à son
 * identifiant de bundle.
 */
const nativeScheme = () => Constants.expoConfig?.ios?.bundleIdentifier ?? Constants.expoConfig?.android?.package;

export const googleAvailable = () =>
  !!googleClientId() && (Platform.OS === 'web' || (Constants.executionEnvironment !== 'storeClient' && !!nativeScheme()));

export async function signInWithGoogleToken(): Promise<AuthResponse> {
  const clientId = googleClientId();
  if (!clientId) throw new Error('Connexion Google non configurée');

  // Adresse de retour attendue par un client OAuth natif : `<bundle>:/oauthredirect`.
  const redirectUri = AuthSession.makeRedirectUri({ native: `${nativeScheme()}:/oauthredirect` });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    // Google n'autorise que le flux `code` + PKCE pour une application installée.
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { nonce: Crypto.randomUUID() },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new SocialSignInCancelled();
  if (result.type !== 'success') throw new Error('Connexion Google impossible');

  // Échange du code : un client natif n'a pas de secret, le vérificateur PKCE suffit.
  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId, code: result.params.code, redirectUri, extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined },
    GOOGLE_DISCOVERY,
  );

  const idToken = tokens.idToken;
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

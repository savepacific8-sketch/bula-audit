import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';

export const isGoogleConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const googleClient = isGoogleConfigured
  ? new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    })
  : null;

export function getGoogleAuthUrl(state: string): string {
  if (!googleClient) throw new Error('Google OAuth not configured');
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'consent',
  });
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  if (!googleClient) throw new Error('Google OAuth not configured');
  const { tokens } = await googleClient.getToken(code);
  if (!tokens.id_token) throw new Error('No id_token from Google');
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Malformed Google payload');
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

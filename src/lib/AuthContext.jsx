import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import {
  base44,
  getToken,
  setToken,
  setRefreshToken,
  clearAllTokens,
} from '@/api/base44Client';
import { isSupabaseMode, supabase } from '@/lib/supabase.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState({ public_settings: {} });

  // On first load: if URL has ?access_token=... and/or ?refresh_token=...
  // (Google OAuth callback), capture them and strip from the URL.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tok = params.get('access_token');
      const refresh = params.get('refresh_token');
      if (tok || refresh) {
        if (tok) setToken(tok);
        if (refresh) setRefreshToken(refresh);
        params.delete('access_token');
        params.delete('refresh_token');
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname +
          (newSearch ? `?${newSearch}` : '') +
          window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
      if (err?.status !== 401) {
        setAuthError({ type: 'unknown', message: err?.message || 'Auth failed' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseMode() && supabase) {
      let cancelled = false;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
          setIsAuthenticated(false);
          return;
        }
        checkUserAuth();
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          setUser(null);
          setIsAuthenticated(false);
        } else if (authChecked) {
          checkUserAuth();
        }
      });
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    const token = getToken();
    if (!token) {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setIsAuthenticated(false);
      return;
    }
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (email, password, turnstileToken) => {
    const u = await base44.auth.login(email, password, turnstileToken);
    setUser(u);
    setIsAuthenticated(true);
    setAuthError(null);
    return u;
  }, []);

  const signup = useCallback(async (email, password, fullName, turnstileToken) => {
    const u = await base44.auth.signup(email, password, fullName, turnstileToken);
    if (!u) return null;
    setUser(u);
    setIsAuthenticated(true);
    setAuthError(null);
    return u;
  }, []);

  const logout = useCallback(async (redirectUrl) => {
    const target =
      typeof redirectUrl === 'string' && redirectUrl.startsWith('/')
        ? redirectUrl
        : '/login';
    clearAllTokens();
    setUser(null);
    setIsAuthenticated(false);
    try { await base44.auth.logout(target); } catch { /* ignore */ }
  }, []);

  const logoutEverywhere = useCallback(async () => {
    clearAllTokens();
    setUser(null);
    setIsAuthenticated(false);
    try { await base44.auth.logoutEverywhere(); } catch { /* ignore */ }
  }, []);

  const navigateToLogin = useCallback(() => {
    try { window.location.href = '/login'; } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        login,
        signup,
        logout,
        logoutEverywhere,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

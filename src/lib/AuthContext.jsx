import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, getToken, setToken, setRefreshToken, clearAllTokens } from '@/api/base44Client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState({ public_settings: {} });

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(!!currentUser);
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
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (email, password) => {
    const result = await base44.auth.loginViaEmailPassword(email, password);
    setUser(result);
    setIsAuthenticated(true);
    setAuthError(null);
    return result;
  }, []);

  const signup = useCallback(async (email, password, fullName) => {
    await base44.auth.register({ email, password, full_name: fullName });
    // After register, user needs OTP verification — redirect to verify page
    return null;
  }, []);

  const logout = useCallback(async () => {
    clearAllTokens();
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout('/login');
  }, []);

  const logoutEverywhere = useCallback(async () => {
    clearAllTokens();
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout('/login');
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
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
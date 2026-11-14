import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { signInWithGoogle, signOutUser, onAuthStateChangedListener, getStoredGoogleToken, setActiveGoogleUid, hydrateGoogleTokenForUser } from '../services/firebase';
import { setActiveCanvasUid } from '../services/canvas';
import { getGrantedScopes, hasFeatureAccess, hydrateRefreshGrant, type GoogleFeature } from '../services/googleAuth';

interface AuthContextValue {
  user: User | null;
  isLoggingIn: boolean;
  isDemoMode: boolean;
  setIsDemoMode: (v: boolean) => void;
  signIn: (requestWorkspace?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
  grantedScopes: string[];
  hasFeatureAccess: (feature: GoogleFeature) => boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredGoogleToken());
  const [grantedScopes, setGrantedScopes] = useState<string[]>(() => getGrantedScopes());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChangedListener((u) => {
      setUser(u);
      if (u?.uid) {
        // Restore this account's token bundle & granted scopes (per-uid vault → mirror).
        setActiveGoogleUid(u.uid);
        hydrateGoogleTokenForUser(u.uid).then((restored) => {
          setToken(restored ?? getStoredGoogleToken());
          setGrantedScopes(getGrantedScopes(u.uid));
          if (restored) setIsDemoMode(false);
        }).catch(() => {
          const curToken = getStoredGoogleToken();
          setToken(curToken);
          setGrantedScopes(getGrantedScopes(u.uid));
          if (u && curToken) setIsDemoMode(false);
        });
        hydrateRefreshGrant(u.uid).then(() => {
          setGrantedScopes(getGrantedScopes(u.uid));
        }).catch(() => {});
        try {
          // Point Canvas at this account's bundle too.
          setActiveCanvasUid(u.uid);
        } catch {}
      } else {
        setActiveGoogleUid(null);
        setToken(null);
        setGrantedScopes([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleTokenUpdate = (e: any) => {
      const updated = e.detail?.token ?? getStoredGoogleToken();
      setToken(updated);
      setGrantedScopes(getGrantedScopes());
    };
    const handleScopesUpdate = () => {
      setGrantedScopes(getGrantedScopes());
    };
    window.addEventListener('scc-google-token-updated', handleTokenUpdate);
    window.addEventListener('scc-google-scopes-updated', handleScopesUpdate);
    return () => {
      window.removeEventListener('scc-google-token-updated', handleTokenUpdate);
      window.removeEventListener('scc-google-scopes-updated', handleScopesUpdate);
    };
  }, []);

  const signIn = useCallback(async (requestWorkspace = false) => {
    setIsLoggingIn(true);
    try {
      const res = await signInWithGoogle({ requestWorkspace });
      if (res?.user) {
        setUser(res.user);
        setToken(res.accessToken || getStoredGoogleToken());
        setGrantedScopes(getGrantedScopes(res.user.uid));
      }
    } finally { setIsLoggingIn(false); }
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setActiveCanvasUid(null);
    setUser(null);
    setToken(null);
    setGrantedScopes([]);
  }, []);

  const checkFeatureAccess = useCallback(
    (feature: GoogleFeature) => hasFeatureAccess(feature, user?.uid),
    [user?.uid, grantedScopes, token]
  );

  return (
    <AuthContext.Provider value={{ user, isLoggingIn, isDemoMode, setIsDemoMode, signIn, signOut, token, grantedScopes, hasFeatureAccess: checkFeatureAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

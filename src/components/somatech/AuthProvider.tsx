import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
import { disablePushDeviceLocally } from './PWAUtils';
import { SubscriptionService } from '@/services/subscription';
import { UserProfile } from '@/types/subscription';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; requiresEmailConfirmation: boolean }>;
  signInWithOAuth: (provider: 'google') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  profile: Tables<'user_profiles'> | null;
  userProfile: UserProfile | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const AuthProviderComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Tables<'user_profiles'> | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const nullSessionHandledRef = useRef(false);

  /**
   * Authentication can disappear without going through the Account screen
   * (expiry, another tab, OAuth replacement, administrative revocation). Keep
   * the cleanup at the provider boundary so every loss path has the same
   * privacy guarantees as the explicit Sign out button.
   */
  const clearSignedOutClientState = useCallback(() => {
    if (nullSessionHandledRef.current) return;
    nullSessionHandledRef.current = true;

    // React Query can otherwise retain user-scoped rows until their gcTime.
    queryClient.clear();

    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.clear();

      const anonymousSafeKeys = new Set(['theme', 'somatech-cookie-consent']);
      const keysToRemove: string[] = [];
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);
        if (key && !anonymousSafeKeys.has(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      // Restricted browsing contexts can deny storage access. The in-memory
      // resets below still run, and individual providers also key state by user.
      console.warn('Could not clear signed-out browser state:', error);
    }

    window.dispatchEvent(new CustomEvent('somatech:signed-out'));
  }, [queryClient]);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile loading error:', error);
        return;
      }

      if (activeUserIdRef.current === userId) setProfile(data);
    } catch (error) {
      console.error('Profile loading failed:', error);
    }
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const profile = await SubscriptionService.getUserProfile(userId);
      if (activeUserIdRef.current === userId) setUserProfile(profile);
    } catch (error) {
      console.error('User profile loading failed:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let profileTimeout: ReturnType<typeof setTimeout> | undefined;

    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          if (mounted) {
            activeUserIdRef.current = null;
            setUser(null);
            setProfile(null);
            setUserProfile(null);
            void disablePushDeviceLocally();
            clearSignedOutClientState();
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          const nextUser = session?.user ?? null;
          activeUserIdRef.current = nextUser?.id ?? null;
          nullSessionHandledRef.current = false;
          setUser(nextUser);
          if (session?.user) {
            profileTimeout = setTimeout(() => {
              loadProfile(session.user.id);
              loadUserProfile(session.user.id);
            }, 100);
          } else {
            void disablePushDeviceLocally();
            clearSignedOutClientState();
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Initial session error:', error);
        if (mounted) {
          activeUserIdRef.current = null;
          setUser(null);
          setProfile(null);
          setUserProfile(null);
          void disablePushDeviceLocally();
          clearSignedOutClientState();
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (profileTimeout) clearTimeout(profileTimeout);

        const previousUserId = activeUserIdRef.current;
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;

        // A direct account replacement is unusual but supported by Supabase.
        // Clear cached query rows before loading the replacement account. Do
        // not clear localStorage here: it already contains the new auth token.
        if (previousUserId && nextUserId && previousUserId !== nextUserId) {
          void disablePushDeviceLocally();
          queryClient.clear();
          setProfile(null);
          setUserProfile(null);
        }

        activeUserIdRef.current = nextUserId;
        if (nextUserId) nullSessionHandledRef.current = false;
        setUser(nextUser);

        if (nextUser) {
          profileTimeout = setTimeout(() => {
            loadProfile(nextUser.id);
            loadUserProfile(nextUser.id);
          }, 150);
        } else {
          setProfile(null);
          setUserProfile(null);
          void disablePushDeviceLocally(previousUserId);
          clearSignedOutClientState();
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      if (profileTimeout) clearTimeout(profileTimeout);
      subscription.unsubscribe();
    };
  }, [clearSignedOutClientState, loadProfile, loadUserProfile, queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error, requiresEmailConfirmation: !data.session };
    } catch (error) {
      return { error: error as Error, requiresEmailConfirmation: false };
    }
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    const signingOutUserId = activeUserIdRef.current;
    try {
      await disablePushDeviceLocally(signingOutUserId);
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Remote sign out error:', error);
    } catch (error) {
      console.error('Remote sign out failed:', error);
    } finally {
      // Privacy is fail-closed: a network failure may prevent remote token
      // revocation, but it must never leave this device showing account data.
      setUser(null);
      setProfile(null);
      setUserProfile(null);
      activeUserIdRef.current = null;
      // onAuthStateChange normally performs this synchronously. This defensive
      // call covers mocked/native clients that resolve signOut without emitting.
      clearSignedOutClientState();
    }
  }, [clearSignedOutClientState]);

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    profile,
    userProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = AuthProviderComponent;
export default AuthProviderComponent;

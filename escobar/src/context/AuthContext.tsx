import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  display_name: string;
  spanish_level: number;
  preferences: Record<string, any>;
  avatar_ready: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  initError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err: any) {
      console.error('Catch error fetching profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key || !supabase) {
      setInitError(`Missing Supabase configuration. URL: ${url ? 'defined' : 'undefined'}, Anon Key: ${key ? 'defined' : 'undefined'}, Client: ${supabase ? 'initialized' : 'failed'}`);
      setLoading(false);
      return;
    }

    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err: any) {
        console.error('Error getting initial session:', err);
        setInitError(`Session Error: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };

    try {
      getInitialSession();

      // 2. Set up auth listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
        } catch (err: any) {
          console.error('Error in auth state change:', err);
          setInitError(`Auth Callback Error: ${err.message || err}`);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (err: any) {
      console.error('Error in AuthContext setup:', err);
      setInitError(`Setup Error: ${err.message || err}`);
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    refreshProfile,
    initError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

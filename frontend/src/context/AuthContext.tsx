"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { User, authService, AuthResponse } from "@/lib/api/authService";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  initialMode: "LOGIN" | "SIGNUP";
  isNewUser: boolean;
  openAuthModal: (mode?: "LOGIN" | "SIGNUP") => void;
  closeAuthModal: () => void;
  setUserSession: (user: User | null) => void;
  loginWithGoogleCredential: (credential: string) => Promise<AuthResponse>;
  logout: () => Promise<void> | void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<"LOGIN" | "SIGNUP">("LOGIN");
  const [isNewUser, setIsNewUser] = useState(false);

  const refreshUser = useCallback(async () => {
    const freshUser = await authService.fetchCurrentUser();
    if (freshUser) {
      setUser(freshUser);
    }
    return freshUser;
  }, []);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      refreshUser();
    } else {
      // Check session cookie with backend
      refreshUser();
    }

    const handleAuthSync = () => {
      const u = authService.getCurrentUser();
      setUser(u);
    };

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener("loki_auth_updated", handleAuthSync);
    window.addEventListener("swarmlens_auth_updated", handleAuthSync);
    window.addEventListener("loki_auth_unauthorized", handleUnauthorized);
    window.addEventListener("swarmlens_auth_unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("loki_auth_updated", handleAuthSync);
      window.removeEventListener("swarmlens_auth_updated", handleAuthSync);
      window.removeEventListener("loki_auth_unauthorized", handleUnauthorized);
      window.removeEventListener("swarmlens_auth_unauthorized", handleUnauthorized);
    };
  }, [refreshUser]);

  const openAuthModal = (mode: "LOGIN" | "SIGNUP" = "LOGIN") => {
    setInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const setUserSession = (newUser: User | null) => {
    setUser(newUser);
  };

  const loginWithGoogleCredential = async (credential: string): Promise<AuthResponse> => {
    const res = await authService.loginWithGoogleCredential(credential);
    setUser(res.user);
    setIsNewUser(res.is_new_user);
    return res;
  };

  const logout = async () => {
    setUser(null);
    setIsNewUser(false);
    await authService.logout();
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthContext.Provider
        value={{
          user,
          isAuthenticated: !!user,
          isAuthModalOpen,
          initialMode,
          isNewUser,
          openAuthModal,
          closeAuthModal,
          setUserSession,
          loginWithGoogleCredential,
          logout,
          refreshUser,
        }}
      >
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

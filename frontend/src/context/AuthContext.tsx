"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, authService } from "@/lib/api/authService";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  initialMode: "LOGIN" | "SIGNUP";
  openAuthModal: (mode?: "LOGIN" | "SIGNUP") => void;
  closeAuthModal: () => void;
  setUserSession: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<"LOGIN" | "SIGNUP">("LOGIN");

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

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

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthModalOpen,
        initialMode,
        openAuthModal,
        closeAuthModal,
        setUserSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

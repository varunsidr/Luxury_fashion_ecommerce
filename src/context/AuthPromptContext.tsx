"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AuthPromptContextType {
  openLoginPrompt: (message?: string) => void;
  promptMessage: string | null;
  clearPrompt: () => void;
}

const AuthPromptContext = createContext<AuthPromptContextType | null>(null);

export function AuthPromptProvider({ children }: { children: ReactNode }) {
  const [promptMessage, setPromptMessage] = useState<string | null>(null);

  const openLoginPrompt = useCallback((message?: string) => {
    setPromptMessage(message ?? "You need to sign in to perform this action.");
  }, []);

  const clearPrompt = useCallback(() => setPromptMessage(null), []);

  return (
    <AuthPromptContext.Provider value={{ openLoginPrompt, promptMessage, clearPrompt }}>
      {children}
    </AuthPromptContext.Provider>
  );
}

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) throw new Error("useAuthPrompt must be used within AuthPromptProvider");
  return ctx;
}

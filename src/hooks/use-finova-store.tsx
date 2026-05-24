import { useState, useCallback, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import type { Expense, Budget, SavingsGoal } from "@/lib/types";
import { apiUrl } from "@/lib/api";

// ---- Auth Context (shared) ----

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  resetPassword: (email: string, newPassword: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("finova_auth_user");
      return u ? JSON.parse(u) : null;
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("finova_auth_token") || null;
    }
    return null;
  });

  const saveAuth = (t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    localStorage.setItem("finova_auth_token", t);
    localStorage.setItem("finova_auth_user", JSON.stringify(u));
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Login failed";
      saveAuth(data.token, data.user);
      return null;
    } catch (err) {
      return "Network error";
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(apiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Signup failed";
      saveAuth(data.token, data.user);
      return null;
    } catch (err) {
      return "Network error";
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("finova_auth_user");
      localStorage.removeItem("finova_auth_token");
    }
  }, []);

  const resetPassword = useCallback(async (email: string, newPassword: string) => {
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Reset failed";
      return null;
    } catch (err) {
      return "Network error";
    }
  }, []);

  return (
    <AuthContext value={{ user, token, login, signup, logout, resetPassword }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null, token: null,
      login: async () => "Auth not available",
      signup: async () => "Auth not available",
      logout: () => {},
      resetPassword: async () => "Auth not available",
    };
  }
  return ctx;
}

// ---- Backend API Hooks ----

export function useExpenses() {
  const { token, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!token) { setExpenses([]); return; }
    fetch(apiUrl("/api/expenses"), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setExpenses(data); });
  }, [token, user]);

  const addExpense = useCallback((e: Omit<Expense, "id">) => {
    if (!token) return;
    const newExpense = { ...e, id: crypto.randomUUID() };
    setExpenses(prev => [newExpense, ...prev]);
    fetch(apiUrl("/api/expenses"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newExpense)
    }).catch(console.error);
  }, [token]);

  const deleteExpense = useCallback((id: string) => {
    if (!token) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    fetch(apiUrl(`/api/expenses/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(console.error);
  }, [token]);

  return { expenses, addExpense, deleteExpense };
}

export function useBudget() {
  const { token, user } = useAuth();
  const [budget, setBudgetState] = useState<Budget>({ monthly: 0 });

  useEffect(() => {
    if (!token) { setBudgetState({ monthly: 0 }); return; }
    fetch(apiUrl("/api/budget"), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setBudgetState(data || { monthly: 0 }));
  }, [token, user]);

  const setBudget = useCallback((monthly: number) => {
    if (!token) return;
    setBudgetState({ monthly });
    fetch(apiUrl("/api/budget"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ monthly })
    }).catch(console.error);
  }, [token]);

  return { budget, setBudget };
}

export function useSavingsGoals() {
  const { token, user } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    if (!token) { setGoals([]); return; }
    fetch(apiUrl("/api/goals"), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setGoals(data); });
  }, [token, user]);

  const addGoal = useCallback((g: Omit<SavingsGoal, "id">) => {
    if (!token) return;
    const newGoal = { ...g, id: crypto.randomUUID() };
    setGoals(prev => [...prev, newGoal]);
    fetch(apiUrl("/api/goals"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newGoal)
    }).catch(console.error);
  }, [token]);

  const updateGoal = useCallback((id: string, saved: number) => {
    if (!token) return;
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved } : g));
    fetch(apiUrl(`/api/goals/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ saved })
    }).catch(console.error);
  }, [token]);

  const deleteGoal = useCallback((id: string) => {
    if (!token) return;
    setGoals(prev => prev.filter(g => g.id !== id));
    fetch(apiUrl(`/api/goals/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(console.error);
  }, [token]);

  return { goals, addGoal, updateGoal, deleteGoal };
}

export function useOnboarding() {
  const [seen, setSeen] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("finova_onboarded") === "true";
    return false;
  });

  const complete = useCallback(() => {
    setSeen(true);
    if (typeof window !== "undefined") localStorage.setItem("finova_onboarded", "true");
  }, []);

  return { seen, complete };
}

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("finova_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("finova_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return { theme, toggleTheme };
}

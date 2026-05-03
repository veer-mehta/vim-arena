import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
    name: string;
    email: string;
    picture: string;
}

interface AuthContextType {
    user: User | null;
    login: (credential: string) => void;
    logout: () => void;
    loginAsGuest: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseJwt(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        window.atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
    );
    return JSON.parse(jsonPayload);
}

const STORAGE_KEY = 'vim_arena_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // On mount, check localStorage for saved session
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as User;
                setUser(parsed);
                // Also set the global for Phaser
                (window as any).googlePlayerName = parsed.name.substring(0, 10).toUpperCase();
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
        setIsLoading(false);
    }, []);

    const login = useCallback((credential: string) => {
        const payload = parseJwt(credential);
        const u: User = {
            name: payload.given_name || payload.name || 'Player',
            email: payload.email || '',
            picture: payload.picture || '',
        };
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        (window as any).googlePlayerName = u.name.substring(0, 10).toUpperCase();
    }, []);

    const loginAsGuest = useCallback(() => {
        const u: User = {
            name: 'Guest',
            email: '',
            picture: '',
        };
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        (window as any).googlePlayerName = undefined;
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        (window as any).googlePlayerName = undefined;
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, loginAsGuest, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
}

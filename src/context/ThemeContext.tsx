import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'minimal';

export interface Theme {
    name: ThemeName;
    label: string;
    // CSS var values
    bg:         string;
    bgAlt:      string;
    bgPanel:    string;
    border:     string;
    text:       string;
    textDim:    string;
    textMuted:  string;
    accent:     string;
    accentAlt:  string;
    danger:     string;
    success:    string;
    warning:    string;
    cursor:     string;
    visual:     string;
    // Phaser hex ints (for Game.ts)
    phaserBg:       number;
    phaserBgAlt:    number;
    phaserBgPanel:  number;
    phaserBorder:   number;
    phaserCursor:   number;
    phaserVisual:   number;
    phaserText:     string;
    phaserTextDim:  string;
    phaserAccent:   string;
    phaserDanger:   string;
    phaserSuccess:  string;
    phaserWarning:  string;
    phaserWarningNum: number;
    phaserAccentNum:  number;
    phaserDangerNum:  number;
    phaserSuccessNum: number;
}

export const THEMES: Record<ThemeName, Theme> = {
    minimal: {
        name: 'minimal',
        label: 'Minimal',
        bg:         '#050505',
        bgAlt:      '#0a0a0a',
        bgPanel:    '#111111',
        border:     'rgba(255,255,255,0.08)',
        text:       '#ffffff',
        textDim:    '#a0a0a0',
        textMuted:  '#404040',
        accent:     '#b32d2d',
        accentAlt:  '#992626',
        danger:     '#b32d2d',
        success:    '#e6b800',
        warning:    '#e6b800',
        cursor:     '#ffffff',
        visual:     'rgba(255,255,255,0.1)',
        phaserBg:       0x050505,
        phaserBgAlt:    0x0a0a0a,
        phaserBgPanel:  0x111111,
        phaserBorder:   0x1a1a1a,
        phaserCursor:   0xffffff,
        phaserVisual:   0xffffff,
        phaserText:     '#ffffff',
        phaserTextDim:  '#a0a0a0',
        phaserAccent:   '#b32d2d',
        phaserDanger:   '#b32d2d',
        phaserSuccess:  '#e6b800',
        phaserWarning:  '#e6b800',
        phaserWarningNum: 0xe6b800,
        phaserAccentNum:  0xb32d2d,
        phaserDangerNum:  0xb32d2d,
        phaserSuccessNum: 0xe6b800,
    }
};

interface ThemeContextValue {
    theme: Theme;
    themeName: ThemeName;
    setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: THEMES.minimal,
    themeName: 'minimal',
    setTheme: () => {},
});

function applyThemeToDom(theme: Theme) {
    const root = document.documentElement;
    root.style.setProperty('--bg',          theme.bg);
    root.style.setProperty('--bg-alt',      theme.bgAlt);
    root.style.setProperty('--bg-panel',    theme.bgPanel);
    root.style.setProperty('--border',      theme.border);
    root.style.setProperty('--text',        theme.text);
    root.style.setProperty('--text-dim',    theme.textDim);
    root.style.setProperty('--text-muted',  theme.textMuted);
    root.style.setProperty('--accent',      theme.accent);
    root.style.setProperty('--accent-alt',  theme.accentAlt);
    root.style.setProperty('--danger',      theme.danger);
    root.style.setProperty('--success',     theme.success);
    root.style.setProperty('--warning',     theme.warning);
    root.style.setProperty('--cursor',      theme.cursor);
    root.style.setProperty('--visual',      theme.visual);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeName] = useState<ThemeName>('minimal');
    const theme = THEMES[themeName];

    useEffect(() => {
        applyThemeToDom(theme);
    }, [theme]);

    const setTheme = (_name: ThemeName) => {
        // No-op in single theme mode
    };

    return (
        <ThemeContext.Provider value={{ theme, themeName, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

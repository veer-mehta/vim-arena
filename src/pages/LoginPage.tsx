import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VimLayout } from '../components/VimLayout';
import { AUTO, Game, Scale, Types } from 'phaser';
import { LoginBackground } from '../game/scenes/LoginBackground';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const GoogleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '10px', display: 'inline-block', verticalAlign: 'middle', marginTop: '-2px' }}>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
);

export default function LoginPage() {
    const { user, login, loginAsGuest, isLoading } = useAuth();
    const navigate = useNavigate();
    const btnRef = useRef<HTMLDivElement>(null);
    const [commandBuffer, setCommandBuffer] = useState<string>('');
    const [navHint, setNavHint] = useState('');
    const [vimMode, setVimMode] = useState<'NORMAL' | 'COMMAND'>('NORMAL');
    const [isGoogleHovered, setIsGoogleHovered] = useState(false);
    const [isGuestHovered, setIsGuestHovered] = useState(false);
    const gameRef = useRef<Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, isLoading, navigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { 
                setCommandBuffer(''); 
                setNavHint(''); 
                setVimMode('NORMAL');
                return; 
            }
            if (e.key === 'Enter') {
                const cmd = commandBuffer.trim().toLowerCase();
                if (cmd === ':lb' || cmd === ':leaderboard') navigate('/leaderboard');
                setCommandBuffer(''); 
                setNavHint('');
                setVimMode('NORMAL');
                return;
            }
            if (e.key === 'Backspace') { 
                setCommandBuffer(p => p.slice(0, -1)); 
                if (commandBuffer.length <= 1) setVimMode('NORMAL');
                setNavHint(''); 
                return; 
            }
            if (e.key.length === 1) {
                if (e.key === ':' || commandBuffer.startsWith(':')) {
                    if (e.key === ':') setVimMode('COMMAND');
                    const next = commandBuffer + e.key;
                    setCommandBuffer(next);
                    if (':leaderboard'.startsWith(next) || ':lb'.startsWith(next))
                        setNavHint('LB \u2192 Leaderboard');
                    else
                        setNavHint('');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [commandBuffer, navigate]);

    useEffect(() => {
        if (isLoading || user) return;

        const renderButton = () => {
            if (!btnRef.current || !(window as any).google?.accounts?.id) return;

            (window as any).google.accounts.id.initialize({
                client_id: CLIENT_ID,
                callback: (response: any) => {
                    login(response.credential);
                },
            });

            (window as any).google.accounts.id.renderButton(btnRef.current, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                width: 240,
            });
        };

        if ((window as any).google?.accounts?.id) {
            renderButton();
        } else {
            const interval = setInterval(() => {
                if ((window as any).google?.accounts?.id) {
                    clearInterval(interval);
                    renderButton();
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isLoading, user, login]);

    useEffect(() => {
        if (!containerRef.current || gameRef.current) return;

        const config: Types.Core.GameConfig = {
            type: AUTO,
            width: '100%',
            height: '100%',
            parent: containerRef.current,
            backgroundColor: '#050505',
            pixelArt: true,
            scale: {
                mode: Scale.RESIZE,
                autoCenter: Scale.CENTER_BOTH,
            },
            scene: [LoginBackground],
        };

        gameRef.current = new Game(config);

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    if (isLoading) return null;

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
                <VimLayout
                    gutterLines={40}
                    vimMode={vimMode}
                    filename="auth.html"
                    statusShortcuts=""
                    commandBuffer={commandBuffer}
                    cmdHint={navHint}
                    transparentBg={true}
                >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '64px' }}>
                
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '56px', margin: '0', color: 'var(--text)' }}>VIM ARENA</h1>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px', letterSpacing: '2px' }}>A TOWER DEFENSE GAME</div>
                </div>

                <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', padding: '48px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', borderRadius: '4px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text)', letterSpacing: '2px', marginBottom: '8px' }}>AUTHENTICATION</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '240px' }}>
                        
                        <div 
                            style={{ position: 'relative', width: '100%', height: '44px' }}
                            onMouseEnter={() => setIsGoogleHovered(true)}
                            onMouseLeave={() => setIsGoogleHovered(false)}
                        >
                            <button 
                                style={{ 
                                    width: '100%',
                                    height: '100%',
                                    background: isGoogleHovered ? 'rgba(255,255,255,0.05)' : 'transparent', 
                                    border: `1px solid ${isGoogleHovered ? 'var(--text)' : 'var(--border)'}`,
                                    color: 'var(--text)', 
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer', 
                                    fontFamily: 'monospace', 
                                    letterSpacing: '2px', 
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.2s ease',
                                    outline: 'none'
                                }}
                            >
                                <GoogleIcon />
                                Sign in with Google
                            </button>
                            <div 
                                ref={btnRef} 
                                style={{ 
                                    position: 'absolute', 
                                    top: 0, 
                                    left: 0, 
                                    width: '100%', 
                                    height: '100%', 
                                    opacity: 0, 
                                    zIndex: 1, 
                                    cursor: 'pointer' 
                                }} 
                            />
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                        </div>

                        <button 
                            onClick={() => loginAsGuest()}
                            onMouseEnter={() => setIsGuestHovered(true)}
                            onMouseLeave={() => setIsGuestHovered(false)}
                            style={{ 
                                width: '100%',
                                height: '44px',
                                background: isGuestHovered ? 'rgba(255,255,255,0.05)' : 'transparent', 
                                border: `1px solid ${isGuestHovered ? 'var(--text)' : 'var(--border)'}`,
                                color: 'var(--text)', 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer', 
                                fontFamily: 'monospace', 
                                letterSpacing: '2px', 
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                            }}
                        >
                            Play as Guest
                        </button>
                    </div>
                </div>

            </div>
        </VimLayout>
            </div>
        </div>
    );
}

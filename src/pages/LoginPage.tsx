import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VimLayout } from '../components/VimLayout';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginPage() {
    const { user, login, loginAsGuest, isLoading } = useAuth();
    const navigate = useNavigate();
    const btnRef = useRef<HTMLDivElement>(null);
    const [commandBuffer, setCommandBuffer] = useState<string>('');
    const [navHint, setNavHint] = useState('');

    useEffect(() => {
        if (!isLoading && user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, isLoading, navigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setCommandBuffer(''); setNavHint(''); return; }
            if (e.key === 'Enter') {
                const cmd = commandBuffer.trim().toLowerCase();
                if (cmd === ':lb' || cmd === ':leaderboard') navigate('/leaderboard');
                setCommandBuffer(''); setNavHint('');
                return;
            }
            if (e.key === 'Backspace') { setCommandBuffer(p => p.slice(0, -1)); setNavHint(''); return; }
            if (e.key.length === 1) {
                if (e.key === ':' || commandBuffer.startsWith(':')) {
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
                theme: 'filled_black',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
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

    if (isLoading) return null;

    return (
        <VimLayout
            gutterLines={40}
            vimMode="INSERT"
            filename="auth.vim"
            statusShortcuts="ACCESS REQUIRED"
            commandBuffer={commandBuffer}
            cmdHint={navHint}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '64px' }}>
                
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '56px', margin: '0', color: 'var(--text)' }}>VIM ARENA</h1>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px', letterSpacing: '2px' }}>ULTRA-PRECISION TOWER DEFENSE</div>
                </div>

                <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', padding: '48px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', borderRadius: '4px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text)', letterSpacing: '2px', marginBottom: '8px' }}>AUTHENTICATION</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>PLEASE SIGN IN TO CONTINUE</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '240px' }}>
                        <div ref={btnRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OR</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                        </div>

                        <button 
                            onClick={() => loginAsGuest()}
                            style={{ 
                                background: 'transparent', 
                                border: '1px solid var(--border)',
                                color: 'var(--text)', 
                                padding: '14px', 
                                cursor: 'pointer', 
                                fontFamily: 'monospace', 
                                letterSpacing: '2px', 
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.borderColor = 'var(--text)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                        >
                            GUEST ACCESS
                        </button>
                    </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '1px' }}>
                    TERMINAL COMPETENCY IS MANDATORY FOR SURVIVAL.
                </div>
            </div>
        </VimLayout>
    );
}

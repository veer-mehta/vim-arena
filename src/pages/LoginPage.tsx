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
                        setNavHint(':lb → Leaderboard');
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
            filename="login.html [RO]"
            statusShortcuts="[Auth Required]"
            commandBuffer={commandBuffer}
            cmdHint={navHint}
        >
            <div className="logo" style={{ fontSize: '48px', marginTop: '40px' }}>VIM ARENA</div>
            <div className="vim-comment" style={{ marginBottom: '32px' }}>
                Sign In To Play, or play as Guest
            </div>
            
            <div ref={btnRef} style={{ margin: '20px 0' }}></div>

            <button 
                className="guest-button"
                onClick={() => loginAsGuest()}
                style={{ background: 'transparent', border: '1px solid #569cd6', color: '#569cd6', padding: '10px 20px', cursor: 'pointer', fontFamily: 'monospace' }}
            >
                [Play as Guest]
            </button>
        </VimLayout>
    );
}

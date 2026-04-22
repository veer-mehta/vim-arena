import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginPage() {
    const { user, login, isLoading } = useAuth();
    const navigate = useNavigate();
    const btnRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, isLoading, navigate]);

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
        <div className="page">
            <div className="vim-editor">
                <div className="vim-main">
                    <div className="vim-gutter">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} style={{ height: '24px' }}>{i + 1}</div>
                        ))}
                    </div>
                    <div className="vim-body">
                        <div className="logo" style={{ fontSize: '48px', marginTop: '40px' }}>VIM ARENA</div>
                        <div className="vim-comment" style={{ marginBottom: '64px' }}>
                            Sign In To Play
                        </div>
                        
                        <div ref={btnRef} style={{ margin: '40px 0' }}></div>
                    </div>
                </div>

                <div className="vim-statusline">
                    <div>
                        <span className="vim-statusline-primary" style={{ background: '#569cd6' }}>INSERT</span>
                        <span>Login.vim</span>
                    </div>
                    <div>
                        <span>[Auth Required]</span>
                    </div>
                </div>

                <div className="vim-commandline">
                    <span>:</span>
                    <div className="vim-cursor"></div>
                </div>
            </div>
        </div>
    );
}

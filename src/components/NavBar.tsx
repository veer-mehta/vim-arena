import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function NavBar({ activePage }: { activePage?: 'dashboard' | 'leaderboard' }) {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { theme } = useTheme();

    const handleLogout = () => {
        logout();
        navigate('/', { replace: true });
    };

    const commands = activePage === 'dashboard' ? [
        { key: ':play', desc: 'Enter Arena', color: 'var(--yellow)',     onClick: () => navigate('/play') },
        { key: ':lb',   desc: 'Leaderboard', color: 'var(--text)',       onClick: () => navigate('/leaderboard') },
        { key: ':q!',   desc: 'Logout',       color: 'var(--text-muted)', onClick: handleLogout },
    ] : [
        { key: ':play', desc: 'Enter Arena', color: 'var(--yellow)',     onClick: () => navigate('/play') },
        { key: ':db',   desc: 'Dashboard',   color: 'var(--text)',       onClick: () => navigate('/dashboard') },
        { key: ':q!',   desc: 'Logout',       color: 'var(--text-muted)', onClick: handleLogout },
    ];

    return (
        <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--bg)',
            padding: '16px 40px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '16px', alignSelf: 'stretch',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
        }}>
            {/* Logo */}
            <div
                onClick={() => navigate('/dashboard')}
                style={{
                    fontFamily: '"Press Start 2P", monospace', fontSize: '14px',
                    color: 'var(--text)', letterSpacing: '4px', cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--yellow)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
            >
                VIM ARENA
            </div>

            {/* Right side: commands */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {commands.map(({ key, desc, color, onClick }) => (
                    <div key={key}
                        onClick={onClick}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '6px 16px', cursor: 'pointer',
                            border: '1px solid transparent',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                        }}
                    >
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: color, letterSpacing: '1px', fontFamily: '"Press Start 2P", monospace' }}>{key}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{desc}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

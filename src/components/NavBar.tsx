import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBar({ activePage }: { activePage?: 'dashboard' | 'leaderboard' }) {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/', { replace: true });
    };

    const commands = activePage === 'dashboard' ? [
        { key: ':play', desc: 'Enter Arena', color: '#a3be8c', onClick: () => navigate('/play') },
        { key: ':lb', desc: 'Leaderboard', color: '#88c0d0', onClick: () => navigate('/leaderboard') },
        { key: ':q!', desc: 'Exit/Logout', color: '#bf616a', onClick: handleLogout },
    ] : [
        { key: ':play', desc: 'Enter Arena', color: '#a3be8c', onClick: () => navigate('/play') },
        { key: ':db', desc: 'Dashboard', color: '#88c0d0', onClick: () => navigate('/dashboard') },
        { key: ':q!', desc: 'Exit/Logout', color: '#bf616a', onClick: handleLogout },
    ];

    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#16181d', padding: '12px 40px', borderBottom: '1px solid #1e2030', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignSelf: 'stretch' }}>
            <div
                onClick={() => navigate('/dashboard')}
                style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '18px', color: '#eceff4', letterSpacing: '4px', textShadow: '0 0 12px rgba(136,192,208,0.2)', cursor: 'pointer' }}
            >
                VIM ARENA
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginRight: '8px' }}>
                    // navigate
                </div>
                {commands.map(({ key, desc, color, onClick }) => (
                    <div key={key}
                        onClick={onClick}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #1e2030', background: '#12141a', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; (e.currentTarget as HTMLDivElement).style.background = '#161a22'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2030'; (e.currentTarget as HTMLDivElement).style.background = '#12141a'; }}
                    >
                        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color }}>{key}</span>
                        <span style={{ color: '#4c566a', fontSize: '12px' }}>{"\u2014"}</span>
                        <span style={{ fontSize: '12px', color: '#d8dee9' }}>{desc}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

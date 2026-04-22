import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PersonalStats {
    gamesPlayed: number;
    bestScore: number;
}

export default function DashboardPage() {
    const { user, logout, isLoading } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<PersonalStats>({ gamesPlayed: 0, bestScore: 0 });
    const [commandBuffer, setCommandBuffer] = useState('');

    useEffect(() => {
        if (!isLoading && !user) {
            navigate('/', { replace: true });
        }
    }, [user, isLoading, navigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setCommandBuffer('');
                return;
            }

            if (e.key === 'Enter') {
                const cmd = commandBuffer.trim().toLowerCase();
                if (cmd === ':play') navigate('/play');
                else if (cmd === ':leaderboard' || cmd === ':lb') navigate('/leaderboard');
                else if (cmd === ':q!' || cmd === ':q') handleLogout();
                setCommandBuffer('');
                return;
            }

            if (e.key === 'Backspace') {
                setCommandBuffer(prev => prev.slice(0, -1));
                return;
            }

            if (e.key.length === 1) {
                // Only start command if it's ':' or we are already typing one
                if (e.key === ':' || commandBuffer.startsWith(':')) {
                    setCommandBuffer(prev => prev + e.key);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [commandBuffer, navigate]);

    useEffect(() => {
        if (!user) return;
        // Fetch personal stats
        fetch(`${import.meta.env.VITE_API_URL}/scores?player=${encodeURIComponent(user.name.substring(0, 10).toUpperCase())}`)
            .then(res => res.json())
            .then((data: any[]) => {
                setStats({
                    gamesPlayed: data.length,
                    bestScore: data.length > 0 ? Math.max(...data.map(d => d.score)) : 0,
                });
            })
            .catch(() => { /* silently fail */ });
    }, [user]);

    if (isLoading || !user) return null;

    const handleLogout = () => {
        logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="page">
            <div className="vim-editor">
                <div className="vim-main">
                    <div className="vim-gutter">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} style={{ height: '24px' }}>{i + 1}</div>
                        ))}
                    </div>
                    <div className="vim-body" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ maxWidth: '900px', width: '100%' }}>
                            <div className="vim-comment" style={{ fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>
                                /* Welcome to the arena */
                            </div>
                            <div className="logo" style={{ fontSize: '48px', textAlign: 'center', marginBottom: '40px', color: '#88c0d0' }}>
                                HELLO, {user.name.toUpperCase()}
                            </div>

                            <div style={{ display: 'flex', gap: '80px', marginTop: '20px', justifyContent: 'center' }}>
                                {/* Left Column: Stats & How to Play */}
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                    <div className="vim-comment" style={{ marginBottom: '10px' }}># SESSION_STATS</div>
                                    <div className="stats-row" style={{ justifyContent: 'flex-start', gap: '30px' }}>
                                        <div className="stat-box" style={{ border: 'none', padding: '0', alignItems: 'flex-start' }}>
                                            <div className="stat-value" style={{ fontSize: '32px' }}>{stats.gamesPlayed}</div>
                                            <div className="stat-label">Games</div>
                                        </div>
                                        <div className="stat-box" style={{ border: 'none', padding: '0', alignItems: 'flex-start' }}>
                                            <div className="stat-value" style={{ fontSize: '32px', color: '#ebcb8b' }}>{stats.bestScore}</div>
                                            <div className="stat-label">Best Score</div>
                                        </div>
                                    </div>

                                    <div className="vim-comment" style={{ marginTop: '40px', marginBottom: '10px' }}># HOW_TO_PLAY</div>
                                    <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#d8dee9' }}>
                                        You are inside a functional Vim buffer. 
                                        Incoming enemies will attempt to delete your code (towers). 
                                        Build defenses by typing or pasting ASCII patterns.
                                        Survival depends on your movement speed and strategic placement.
                                    </div>
                                </div>

                                {/* Right Column: Controls */}
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                    <div className="vim-comment" style={{ marginBottom: '10px' }}># CONTROLS</div>
                                    <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                                        <div style={{ display: 'flex', marginBottom: '12px' }}>
                                            <span style={{ color: '#88c0d0', width: '120px' }}>h j k l</span>
                                            <span>Move Cursor</span>
                                        </div>
                                        <div style={{ display: 'flex', marginBottom: '12px' }}>
                                            <span style={{ color: '#88c0d0', width: '120px' }}>i / a</span>
                                            <span>Write / Build Text</span>
                                        </div>
                                        <div style={{ display: 'flex', marginBottom: '12px' }}>
                                            <span style={{ color: '#88c0d0', width: '120px' }}>v / y</span>
                                            <span>Select / Clone Text</span>
                                        </div>
                                        <div style={{ display: 'flex', marginBottom: '12px' }}>
                                            <span style={{ color: '#88c0d0', width: '120px' }}>p</span>
                                            <span>Paste Text</span>
                                        </div>
                                        <div style={{ display: 'flex', marginTop: '24px', marginBottom: '12px' }}>
                                            <span style={{ color: '#ebcb8b', width: '120px' }}>:play</span>
                                            <span>Enter Arena</span>
                                        </div>
                                        <div style={{ display: 'flex', marginBottom: '12px' }}>
                                            <span style={{ color: '#ebcb8b', width: '120px' }}>:lb</span>
                                            <span>Leaderboard</span>
                                        </div>
                                        <div style={{ display: 'flex', marginBottom: '12px' }}>
                                            <span style={{ color: '#ebcb8b', width: '120px' }}>:q!</span>
                                            <span>Exit Game</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="vim-statusline">
                    <div>
                        <span className="vim-statusline-primary">NORMAL</span>
                        <span>Dashboard.vim [RO]</span>
                    </div>
                    <div>
                        <span>utf-8 | 100% | 1,1</span>
                    </div>
                </div>

                <div className="vim-commandline">
                    <span>{commandBuffer || ':'}</span>
                    {commandBuffer && <div className="vim-cursor"></div>}
                </div>
            </div>
        </div>
    );
}

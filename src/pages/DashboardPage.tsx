import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NavBar } from '../components/NavBar';
import { VimLayout } from '../components/VimLayout';

interface PersonalStats {
    gamesPlayed: number;
    bestScore: number;
}

function useCountUp(target: number, duration = 800) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (target === 0) { setValue(0); return; }
        const steps = 24;
        const step = target / steps;
        let current = 0;
        const id = setInterval(() => {
            current = Math.min(current + step, target);
            setValue(Math.floor(current));
            if (current >= target) clearInterval(id);
        }, duration / steps);
        return () => clearInterval(id);
    }, [target, duration]);
    return value;
}

export default function DashboardPage() {
    const { user, logout, isLoading } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<PersonalStats>({ gamesPlayed: 0, bestScore: 0 });
    const [commandBuffer, setCommandBuffer] = useState('');

    const cmdRef = useRef(commandBuffer);
    cmdRef.current = commandBuffer;
    const bodyRef = useRef<HTMLDivElement>(null);
    const pendingG = useRef(false);
    const [vimMode, setVimMode] = useState<'NORMAL' | 'COMMAND'>('NORMAL');

    const gamesDisplay  = useCountUp(stats.gamesPlayed);
    const scoreDisplay  = useCountUp(stats.bestScore);

    const isGuest = user?.name === 'Guest';
    const handleLogout = () => { logout(); navigate('/', { replace: true }); };

    useEffect(() => {
        if (!isLoading && !user) navigate('/', { replace: true });
    }, [user, isLoading, navigate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const inCmd = cmdRef.current.startsWith(':');

            if (e.key === 'Escape') {
                setCommandBuffer('');
                setVimMode('NORMAL');
                pendingG.current = false;
                return;
            }
            if (e.key === 'Enter') {
                const cmd = cmdRef.current.trim().toLowerCase();
                if (cmd === ':play') navigate('/play');
                else if (cmd === ':leaderboard' || cmd === ':lb') navigate('/leaderboard');
                else if (cmd === ':q!' || cmd === ':q') handleLogout();
                setCommandBuffer('');
                setVimMode('NORMAL');
                return;
            }
            if (e.key === 'Backspace') {
                if (inCmd) setCommandBuffer(prev => prev.slice(0, -1));
                return;
            }

            if (e.key === ':' && !inCmd) {
                setCommandBuffer(':');
                setVimMode('COMMAND');
                pendingG.current = false;
                return;
            }
            if (inCmd && e.key.length === 1) {
                setCommandBuffer(prev => prev + e.key);
                return;
            }

            const el = bodyRef.current;
            if (!el) return;

            const LINE   = 28;
            const HALF   = Math.floor(el.clientHeight / 2);
            const FULL   = el.clientHeight - LINE;

            if (e.key === 'j') {
                e.preventDefault();
                el.scrollBy({ top: LINE, behavior: 'smooth' });
                pendingG.current = false;
            } else if (e.key === 'k') {
                e.preventDefault();
                el.scrollBy({ top: -LINE, behavior: 'smooth' });
                pendingG.current = false;
            } else if (e.key === 'G') {
                e.preventDefault();
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                pendingG.current = false;
            } else if (e.key === 'g') {
                e.preventDefault();
                if (pendingG.current) {
                    el.scrollTo({ top: 0, behavior: 'smooth' });
                    pendingG.current = false;
                } else {
                    pendingG.current = true;
                    setTimeout(() => { pendingG.current = false; }, 800);
                }
            } else if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                el.scrollBy({ top: HALF, behavior: 'smooth' });
                pendingG.current = false;
            } else if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                el.scrollBy({ top: -HALF, behavior: 'smooth' });
                pendingG.current = false;
            } else if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                el.scrollBy({ top: FULL, behavior: 'smooth' });
                pendingG.current = false;
            } else if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                el.scrollBy({ top: -FULL, behavior: 'smooth' });
                pendingG.current = false;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    useEffect(() => {
        if (!user || !user.name) return;
        const name = user.name === 'Guest' ? 'GUEST' : user.name.substring(0, 10).toUpperCase();
        fetch(`${import.meta.env.VITE_API_URL}/scores?player=${encodeURIComponent(name)}`)
            .then(r => r.json())
            .then((data: any[]) => setStats({
                gamesPlayed: data.length,
                bestScore: data.length > 0 ? Math.max(...data.map((d: any) => d.score)) : 0,
            }))
            .catch(() => {});
    }, [user]);

    if (isLoading || !user) return null;

    let cmdHint = '';
    if (commandBuffer.startsWith(':p')) cmdHint = 'lay \u2192 Enter Arena';
    else if (commandBuffer.startsWith(':l')) cmdHint = 'b \u2192 Leaderboard';
    else if (commandBuffer.startsWith(':q')) cmdHint = '! \u2192 Exit/Logout';

    return (
        <VimLayout
            gutterLines={40}
            vimMode={vimMode}
            commandBuffer={commandBuffer}
            cmdHint={cmdHint}
            filename="dashboard.html [RO]"
            statusShortcuts="j/k · G/gg · :play · :lb"
            bodyRef={bodyRef}
        >
            <NavBar activePage="dashboard" />

            <div style={{ maxWidth: '1000px', width: '100%', padding: '60px 40px' }}>
                
                {/* Header */}
                <div style={{ marginBottom: '64px' }}>
                    <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '28px', color: 'var(--text)', marginBottom: '8px' }}>
                        {isGuest ? 'GUEST' : user.name.toUpperCase()}
                    </h1>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '1px' }}>WELCOME TO THE ARENA</div>
                </div>

                {/* Core Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '80px' }}>
                    <div style={{ padding: '32px', background: 'var(--bg-alt)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px', letterSpacing: '2px' }}>SESSIONS</div>
                        <div style={{ fontSize: '42px', fontWeight: 'bold', fontFamily: '"Press Start 2P", monospace' }}>{gamesDisplay}</div>
                    </div>
                    <div style={{ padding: '32px', background: 'var(--bg-alt)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '8px', letterSpacing: '2px' }}>BEST PERFORMANCE</div>
                        <div style={{ fontSize: '42px', fontWeight: 'bold', fontFamily: '"Press Start 2P", monospace', color: 'var(--yellow)' }}>{scoreDisplay}</div>
                    </div>
                </div>

                {/* How to Play Section */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '64px' }}>
                    <h2 style={{ fontSize: '18px', letterSpacing: '4px', color: 'var(--text)', marginBottom: '48px', fontFamily: '"Press Start 2P", monospace' }}>HOW TO PLAY</h2>

                    <div style={{ marginBottom: '64px' }}>
                        <h3 style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px', marginBottom: '24px' }}>NAVIGATION</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'var(--border)' }}>
                            {[
                                { k: 'h j k l', d: 'Standard Vim movement' },
                                { k: 'i / a', d: 'Enter INSERT mode to build' },
                                { k: 'ESC', d: 'Return to NORMAL mode' },
                                { k: 'v / y', d: 'Select and Copy towers' },
                                { k: '[N]p', d: 'Paste tower from slot N' },
                                { k: 'x / dd', d: 'Remove content' },
                            ].map(item => (
                                <div key={item.k} style={{ background: 'var(--bg)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <code style={{ color: 'var(--yellow)', fontSize: '10px', fontFamily: '"Press Start 2P", monospace' }}>{item.k}</code>
                                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.d}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '64px' }}>
                        <h3 style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px', marginBottom: '24px' }}>UNITS</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
                            {[
                                { n: 'SNIPER', p: '  |  \n  •  \n / \\ ', s: 'Long range single target' },
                                { n: 'RAPID', p: ' / \\ \n  •  \n \\ / ', s: 'Fast fire, short range' },
                                { n: 'WALL', p: '[===]', s: 'High health blocker' },
                                { n: 'PULSE', p: '  *  \n * * \n* O *\n * * \n  *  ', s: 'Area of effect splash' },
                            ].map(t => (
                                <div key={t.n} style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: '2px' }}>
                                    <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '16px', fontFamily: '"Press Start 2P", monospace' }}>{t.n}</div>
                                    <pre style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px', lineHeight: '1.0', fontFamily: '"Press Start 2P", monospace' }}>{t.p}</pre>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.s}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px' }}>
                        <div>
                            <h3 style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '2px', marginBottom: '24px' }}>COMMANDS</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { c: ':play', d: 'Enter the Arena' },
                                    { c: ':wq', d: 'Execute Ultimate (20 Energy)' },
                                    { c: ':q!', d: 'Quit to Dashboard' },
                                    { c: ':w NAME', d: 'Submit score to records' },
                                ].map(item => (
                                    <div key={item.c} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                        <code style={{ color: 'var(--yellow)', fontSize: '10px', fontFamily: '"Press Start 2P", monospace' }}>{item.c}</code>
                                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.d}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </VimLayout>
    );
}

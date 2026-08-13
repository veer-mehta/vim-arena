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
                else if (cmd === ':tutorial') navigate('/tutorial');
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
    if (commandBuffer.startsWith(':p')) cmdHint = 'play → Enter Arena';
    else if (commandBuffer.startsWith(':t')) cmdHint = 'tutorial → How to Play';
    else if (commandBuffer.startsWith(':l')) cmdHint = 'lb → Leaderboard';
    else if (commandBuffer.startsWith(':q')) cmdHint = 'q! > Quit/Logout';

    return (
        <VimLayout
            gutterLines={40}
            vimMode={vimMode}
            commandBuffer={commandBuffer}
            cmdHint={cmdHint}
            filename="dashboard.html [RO]"
            statusShortcuts="j/k · G/gg · :play · :lb"
            bodyRef={bodyRef}
            gutterLineHeight={28}
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

                    {/* Step 1: The Goal */}
                    <div style={{ marginBottom: '48px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px 32px' }}>
                        <h3 style={{ fontSize: '11px', color: 'var(--yellow)', letterSpacing: '2px', marginBottom: '16px', fontFamily: '"Press Start 2P", monospace' }}>1. THE GOAL</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.8' }}>
                            Enemies spawn from the edges and march toward your towers.
                            Use <span style={{ color: 'var(--text)' }}>Vim commands</span> to navigate the grid, build towers, and defend.
                            If all your towers are destroyed, the game is over.
                        </p>
                    </div>

                    {/* Step 2: Build Your Defenses */}
                    <div style={{ marginBottom: '48px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px 32px' }}>
                        <h3 style={{ fontSize: '11px', color: 'var(--yellow)', letterSpacing: '2px', marginBottom: '24px', fontFamily: '"Press Start 2P", monospace' }}>2. BUILD YOUR DEFENSES</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {[
                                { key: 'hjkl', desc: 'Move your cursor around the grid' },
                                { key: 'i', desc: 'Enter Insert mode to start building' },
                                { key: 's / r / p / b', desc: 'Place a tower (Sniper, Rapid, Pulse, Bomb)' },
                                { key: 'ESC', desc: 'Return to Normal mode' },
                                { key: 'v → y → p', desc: 'Select a region, copy it, paste it elsewhere' },
                                { key: ':ult', desc: 'Fire your Ultimate ability (costs 20 energy)' },
                                { key: ':wq', desc: 'Save your score and quit the arena' },
                            ].map((step, i) => (
                                <div key={step.key} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '20px',
                                    padding: '12px 0',
                                    borderBottom: i < 6 ? '1px solid var(--border)' : 'none',
                                }}>
                                    <code style={{
                                        color: 'var(--yellow)',
                                        fontSize: '13px',
                                        fontFamily: '\'JetBrains Mono\', \'Fira Code\', monospace',
                                        fontWeight: 'bold',
                                        minWidth: '160px',
                                        flexShrink: 0,
                                    }}>{step.key}</code>
                                    <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontFamily: '\'JetBrains Mono\', monospace' }}>{step.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 3: Your Towers */}
                    <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px 32px' }}>
                        <h3 style={{ fontSize: '11px', color: 'var(--yellow)', letterSpacing: '2px', marginBottom: '24px', fontFamily: '"Press Start 2P", monospace' }}>3. YOUR TOWERS</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                            {[
                                { n: 'SNIPER', reg: '"sp', p: '  |  \n  •  \n / \\ ', s: 'Long range, single target', dmg: 1, rng: 400, spd: '1.0/s', hp: 3, cost: '9E' },
                                { n: 'RAPID', reg: '"rp', p: ' / \\ \n  •  \n \\ / ', s: 'Fast fire, short range', dmg: 1, rng: 120, spd: '4.0/s', hp: 3, cost: '9E' },
                                { n: 'PULSE', reg: '"pp', p: '  *  \n * * \n* O *\n * * \n  *  ', s: 'Area of effect splash', dmg: 1, rng: 250, spd: '2.5/s', hp: 4, cost: '25E' },
                                { n: 'BOMB', reg: '"bp', p: ' (o) \n  •  \n [B] ', s: 'Slow fire, group damage', dmg: 2, rng: 220, spd: '0.5/s', hp: 4, cost: '9E' },
                            ].map(t => (
                                <div key={t.n} style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text)', fontFamily: '"Press Start 2P", monospace', fontWeight: 'bold' }}>{t.n}</div>
                                    <pre style={{ fontSize: '13px', color: 'var(--yellow)', lineHeight: '1.2', fontFamily: '\'JetBrains Mono\', \'Fira Code\', monospace', fontWeight: 'bold', margin: 0 }}>{t.p}</pre>
                                    <code style={{ fontSize: '12px', color: 'var(--yellow)', fontFamily: '\'JetBrains Mono\', \'Fira Code\', monospace', fontWeight: 'bold', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '3px', border: '1px solid var(--border)' }}>{t.reg}</code>
                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: '\'JetBrains Mono\', monospace' }}>{t.s}</div>
                                    
                                    {/* Tower Stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', borderTop: '1px dashed var(--border)', paddingTop: '10px', marginTop: '4px', fontSize: '11px', fontFamily: '\'JetBrains Mono\', \'Fira Code\', monospace', fontWeight: 'bold' }}>
                                        <div style={{ color: 'var(--text-dim)', textAlign: 'left' }}>DMG: <span style={{ color: '#ffffff' }}>{t.dmg}</span></div>
                                        <div style={{ color: 'var(--text-dim)', textAlign: 'right' }}>RNG: <span style={{ color: '#ffffff' }}>{t.rng}</span></div>
                                        <div style={{ color: 'var(--text-dim)', textAlign: 'left' }}>SPD: <span style={{ color: '#ffffff' }}>{t.spd}</span></div>
                                        <div style={{ color: 'var(--text-dim)', textAlign: 'right' }}>HP: <span style={{ color: '#ffffff' }}>{t.hp}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </VimLayout>
    );
}

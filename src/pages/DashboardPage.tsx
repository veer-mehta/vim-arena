import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PersonalStats {
    gamesPlayed: number;
    bestScore: number;
}

interface LeaderEntry {
    playerName: string;
    score: number;
}

import { NavBar } from '../components/NavBar';
import { VimLayout } from '../components/VimLayout';

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
    const [topScores, setTopScores] = useState<LeaderEntry[]>([]);

    const cmdRef = useRef(commandBuffer);
    cmdRef.current = commandBuffer;
    const bodyRef = useRef<HTMLDivElement>(null);
    const pendingG = useRef(false);          // tracks 'g' for gg
    const [vimMode, setVimMode] = useState<'NORMAL' | 'COMMAND'>('NORMAL');

    const gamesDisplay  = useCountUp(stats.gamesPlayed);
    const scoreDisplay  = useCountUp(stats.bestScore);

    // â”€â”€ Keyboard handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            // â”€â”€ Command mode entry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            // â”€â”€ Vim motions (NORMAL mode only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const el = bodyRef.current;
            if (!el) return;

            const LINE   = 28;                     // pixels per line
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
                    // gg â€” jump to top
                    el.scrollTo({ top: 0, behavior: 'smooth' });
                    pendingG.current = false;
                } else {
                    pendingG.current = true;
                    // reset if no second g within 800 ms
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

    // â”€â”€ Fetch stats + leaderboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        if (!user) return;
        const name = user.name === 'Guest' ? 'GUEST' : user.name.substring(0, 10).toUpperCase();
        fetch(`${import.meta.env.VITE_API_URL}/scores?player=${encodeURIComponent(name)}`)
            .then(r => r.json())
            .then((data: any[]) => setStats({
                gamesPlayed: data.length,
                bestScore: data.length > 0 ? Math.max(...data.map((d: any) => d.score)) : 0,
            }))
            .catch(() => {});

        fetch(`${import.meta.env.VITE_API_URL}/scores`)
            .then(r => r.json())
            .then((data: LeaderEntry[]) => setTopScores(data.slice(0, 5)))
            .catch(() => {});
    }, [user]);



    if (isLoading || !user) return null;

    const handleLogout = () => { logout(); navigate('/', { replace: true }); };

    // Derive command hint
    let cmdHint = '';
    if (commandBuffer.startsWith(':p')) cmdHint = 'lay \u2192 Enter Arena';
    else if (commandBuffer.startsWith(':l')) cmdHint = 'b \u2192 Leaderboard';
    else if (commandBuffer.startsWith(':q')) cmdHint = '! \u2192 Exit/Logout';

    const isGuest = user.name === 'Guest';

    return (
        <VimLayout
            gutterLines={40}
            vimMode={vimMode}
            commandBuffer={commandBuffer}
            cmdHint={cmdHint}
            filename="dashboard.html [RO]"
            statusShortcuts="j/k · G/gg · Ctrl+d/u · :play · :lb"
            bodyRef={bodyRef}
        >

                        <NavBar activePage="dashboard" />

                        {/* Main grid — 2 cols */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gridTemplateRows: 'auto',
                            gap: '0',
                            flexShrink: 0,
                        }}>

                            {/* Top-left: Current session */}
                            <div style={{
                                padding: '36px 40px',
                                borderRight: '1px solid #1e2030',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '28px',
                            }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
                                        // current session
                                    </div>
                                    <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '22px', color: '#eceff4', letterSpacing: '2px', textShadow: '0 0 24px rgba(136,192,208,0.25)' }}>
                                        {isGuest ? 'GUEST' : user.name.toUpperCase()}
                                    </div>
                                    {isGuest && (
                                        <div style={{ fontSize: '11px', color: '#ebcb8b', marginTop: '6px' }}>
                                            ⚠ playing as guest — scores will not persist
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '40px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '28px', color: '#88c0d0' }}>{gamesDisplay}</div>
                                        <div style={{ fontSize: '10px', color: '#4c566a', letterSpacing: '2px', textTransform: 'uppercase' }}>Games Played</div>
                                    </div>
                                    <div style={{ width: '1px', background: '#1e2030' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '28px', color: '#ebcb8b' }}>{scoreDisplay}</div>
                                        <div style={{ fontSize: '10px', color: '#4c566a', letterSpacing: '2px', textTransform: 'uppercase' }}>Best Score</div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#6b7fa0', marginBottom: '6px' }}>rank progress</div>
                                    <div style={{ height: '4px', background: '#1e2030', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.min(100, (stats.bestScore / 50) * 100)}%`, background: 'linear-gradient(90deg, #88c0d0, #5e81ac)', borderRadius: '2px', transition: 'width 0.8s ease' }} />
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#6b7fa0', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>0</span><span>50 kills → elite</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right col: Top scores */}
                            <div style={{
                                padding: '36px 40px',
                                borderLeft: '1px solid #1e2030',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                gridColumn: '2',
                            }}>
                                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>// top scores</span>
                                    <span style={{ cursor: 'pointer', color: '#4c566a', fontSize: '10px' }} onClick={() => navigate('/leaderboard')}>view all →</span>
                                </div>
                                {topScores.length === 0 ? (
                                    <div style={{ color: '#6b7fa0', fontSize: '12px', fontStyle: 'italic' }}>no scores yet — be the first</div>
                                ) : topScores.map((entry, i) => {
                                    const rankColors = ['#ebcb8b', '#b48ead', '#88c0d0', '#4c566a', '#4c566a'];
                                    const medals = ['★', '◆', '◇', '·', '·'];
                                    const isMe = entry.playerName === (isGuest ? 'GUEST' : user.name.substring(0, 10).toUpperCase());
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '3px', background: isMe ? 'rgba(136,192,208,0.06)' : 'transparent', border: isMe ? '1px solid rgba(136,192,208,0.15)' : '1px solid transparent', fontFamily: 'monospace', fontSize: '13px', transition: 'background 0.15s' }}>
                                            <span style={{ color: rankColors[i], minWidth: '14px' }}>{medals[i]}</span>
                                            <span style={{ color: '#d8dee9', flex: 1, fontWeight: isMe ? 'bold' : 'normal' }}>
                                                {entry.playerName}
                                                {isMe && <span style={{ color: '#88c0d0', fontSize: '10px', marginLeft: '6px' }}>(you)</span>}
                                            </span>
                                            <span style={{ color: i === 0 ? '#bf616a' : '#a3be8c', fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}>{entry.score}</span>
                                        </div>
                                    );
                                })}
                            </div>

                        </div>


                        {/* ── How to Play Guide ── */}
                        <div style={{ borderTop: '1px solid #1e2030', padding: '40px 40px 56px', display: 'flex', flexDirection: 'column', gap: '36px' }}>

                            {/* Section title */}
                            <div>
                                <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#eceff4', letterSpacing: '2px', marginBottom: '8px' }}>
                                    HOW TO PLAY
                                </div>
                            </div>

                            {/* Vim movement & modes */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
                                    // vim movement &amp; modes
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                    {[
                                        { keys: 'h  j  k  l',  desc: 'Move cursor left / down / up / right',     color: '#88c0d0' },
                                        { keys: 'i  or  a',    desc: 'Enter INSERT mode \u2014 start typing text',     color: '#a3be8c' },
                                        { keys: 'ESC',         desc: 'Return to NORMAL mode',                     color: '#d8dee9' },
                                        { keys: 'v',           desc: 'Enter VISUAL mode \u2014 select a region',       color: '#ebcb8b' },
                                        { keys: 'y',           desc: 'Yank (copy) the selected text in visual',   color: '#ebcb8b' },
                                        { keys: 'p  or  Np',   desc: 'Paste clipboard entry (N = slot 1\u20139)',      color: '#b48ead' },
                                        { keys: 'x',           desc: 'Delete character under cursor',             color: '#bf616a' },
                                        { keys: 'dd',          desc: 'Delete entire line under cursor',           color: '#bf616a' },
                                    ].map(({ keys, desc, color }) => (
                                        <div key={keys} style={{
                                            display: 'flex', gap: '12px', alignItems: 'flex-start',
                                            padding: '10px 14px', background: '#12141a',
                                            border: '1px solid #1e2030', borderRadius: '4px',
                                        }}>
                                            <code style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color, minWidth: '72px', lineHeight: '1.6', flexShrink: 0 }}>
                                                {keys}
                                            </code>
                                            <span style={{ fontSize: '12px', color: '#d8dee9', lineHeight: '1.6' }}>{desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* In-game commands */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
                                    // in-game commands
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                    {[
                                        { keys: ':wq',  desc: 'ULTIMATE \u2014 wipes all enemies on screen (requires 20 energy)',  color: '#bf616a' },
                                        { keys: ':db',  desc: 'Quit to Dashboard',                                              color: '#88c0d0' },
                                        { keys: ':lb',  desc: 'Open Leaderboard',                                               color: '#88c0d0' },
                                        { keys: ':w NAME', desc: 'After game over \u2014 save your score under NAME',               color: '#a3be8c' },
                                        { keys: ':q',   desc: 'After game over \u2014 quit without saving',                          color: '#4c566a' },
                                    ].map(({ keys, desc, color }) => (
                                        <div key={keys} style={{
                                            display: 'flex', gap: '12px', alignItems: 'flex-start',
                                            padding: '10px 14px', background: '#12141a',
                                            border: '1px solid #1e2030', borderRadius: '4px',
                                        }}>
                                            <code style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color, minWidth: '72px', lineHeight: '1.6', flexShrink: 0 }}>
                                                {keys}
                                            </code>
                                            <span style={{ fontSize: '12px', color: '#d8dee9', lineHeight: '1.6' }}>{desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tower types */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
                                    // tower types \u2014 type the pattern to build
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                                    {[
                                        {
                                            name: 'Sniper Tower',
                                            pattern: ['  |  ', '  \u2022  ', ' / \\ '],
                                            color: '#88c0d0',
                                            stats: 'HP 3 \u00B7 Range 400px \u00B7 1 shot/s \u00B7 Long range single target',
                                        },
                                        {
                                            name: 'Rapid Tower',
                                            pattern: [' / \\ ', '  \u2022  ', ' \\ / '],
                                            color: '#ebcb8b',
                                            stats: 'HP 3 \u00B7 Range 120px \u00B7 4 shots/s \u00B7 Fast fire, short range',
                                        },
                                        {
                                            name: 'Wall Tower',
                                            pattern: ['[===]'],
                                            color: '#4c566a',
                                            stats: 'HP 20 \u00B7 No damage \u00B7 Blocks enemies, absorbs hits',
                                        },
                                        {
                                            name: 'Pulse Tower',
                                            pattern: ['  *  ', ' * * ', '* O *', ' * * ', '  *  '],
                                            color: '#d08770',
                                            stats: 'HP 4 \u00B7 Range 250px \u00B7 2.5 shots/s \u00B7 AoE splash damage',
                                        },
                                    ].map(({ name, pattern, color, stats }) => (
                                        <div key={name} style={{
                                            padding: '16px', background: '#12141a',
                                            border: `1px solid #1e2030`, borderRadius: '4px',
                                            borderLeft: `3px solid ${color}`,
                                        }}>
                                            <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color, marginBottom: '10px' }}>
                                                {name}
                                            </div>
                                            <pre style={{
                                                fontFamily: '"Press Start 2P", monospace',
                                                fontSize: '11px', color: '#eceff4',
                                                background: '#0d0f14', padding: '10px 14px',
                                                borderRadius: '3px', marginBottom: '10px',
                                                lineHeight: '1.8', letterSpacing: '2px',
                                                whiteSpace: 'pre',
                                            }}>
                                                {pattern.join('\n')}
                                            </pre>
                                            <div style={{ fontSize: '11px', color: '#4c566a', lineHeight: '1.6' }}>{stats}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Copy & paste mechanic */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
                                    // copy &amp; paste mechanic
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
                                    {[
                                        { step: '1', text: 'Get 10 kills \u2014 clipboard slot unlocks', color: '#a3be8c' },
                                        { step: '2', text: 'In VISUAL mode, select a tower pattern with hjkl, then press y to yank it', color: '#a3be8c' },
                                        { step: '3', text: 'Get more kills to charge the slot (shown in clipboard panel)', color: '#ebcb8b' },
                                        { step: '4', text: 'Press p (or 2p for slot 2) to paste the tower at your cursor', color: '#b48ead' },
                                        { step: '5', text: 'Multiple clipboard slots available \u2014 each costs kills to use', color: '#b48ead' },
                                    ].map(({ step, text, color }) => (
                                        <div key={step} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '10px 14px', background: '#12141a', border: '1px solid #1e2030', borderRadius: '4px' }}>
                                            <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px', color, minWidth: '16px', paddingTop: '2px' }}>{step}</span>
                                            <span style={{ fontSize: '12px', color: '#d8dee9', lineHeight: '1.7' }}>{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Game over & scoring */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6b7fa0', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
                                    // game over &amp; scoring
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
                                    {[
                                        { icon: '\u25B8', text: 'The game ends when all combat towers (Sniper, Rapid, Pulse) are destroyed', c: '#bf616a' },
                                        { icon: '\u25B8', text: `Wall towers don't count \u2014 use them to protect your combat towers`, c: '#4c566a' },
                                        { icon: '\u25B8', text: 'Your score = total enemy kills during the session', c: '#a3be8c' },
                                        { icon: '\u25B8', text: 'At game over, type :w YOURNAME to submit to the leaderboard', c: '#88c0d0' },
                                        { icon: '\u25B8', text: 'Type :q to exit without saving your score', c: '#4c566a' },
                                    ].map(({ icon, text, c }, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 14px', background: '#12141a', border: '1px solid #1e2030', borderRadius: '4px' }}>
                                            <span style={{ color: c, flexShrink: 0, paddingTop: '2px' }}>{icon}</span>
                                            <span style={{ fontSize: '12px', color: '#d8dee9', lineHeight: '1.7' }}>{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                        {/* ── end guide ── */}

        </VimLayout>
    );
}

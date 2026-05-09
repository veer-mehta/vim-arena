import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NavBar } from '../components/NavBar';
import { VimLayout } from '../components/VimLayout';

interface ScoreEntry {
    _id: string;
    playerName: string;
    score: number;
    date: string;
}

function timeAgo(dateStr: string): string {
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins  = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days  = Math.floor(diff / 86400000);
        if (mins < 2)   return 'just now';
        if (mins < 60)  return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    } catch { return ''; }
}

function highlight(text: string, query: string) {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <span style={{ background: 'var(--visual)', color: 'var(--yellow)', borderRadius: '1px', padding: '0 2px' }}>
                {text.slice(idx, idx + query.length)}
            </span>
            {text.slice(idx + query.length)}
        </>
    );
}

const RANK_MARKERS = ['★', '◆', '◇'];

export default function LeaderboardPage() {
    const navigate       = useNavigate();
    const { user, logout } = useAuth();
    const [scores, setScores]     = useState<ScoreEntry[]>([]);
    const [loading, setLoading]   = useState(true);
    const [commandBuffer, setCommandBuffer] = useState('');
    const [vimMode, setVimMode] = useState<'NORMAL' | 'COMMAND' | 'SEARCH'>('NORMAL');

    const cmdRef = useRef(commandBuffer);
    cmdRef.current = commandBuffer;

    const isSearch    = commandBuffer.startsWith('/');
    const searchQuery = isSearch ? commandBuffer.slice(1) : '';

    const displayedScores = useMemo(() => {
        if (!searchQuery) return scores;
        return scores.filter(s =>
            s.playerName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [scores, searchQuery]);

    const cmdHint = useMemo(() => {
        if (isSearch) return `FIND: "${searchQuery}" [${displayedScores.length}]`;
        if (commandBuffer.startsWith(':p')) return 'PLAY \u2192 START';
        if (commandBuffer.startsWith(':d') || commandBuffer.startsWith(':q')) return 'BACK \u2192 DASHBOARD';
        return '';
    }, [commandBuffer, isSearch, searchQuery, displayedScores.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const cur = cmdRef.current;
            const curIsSearch = cur.startsWith('/');

            if (e.key === 'Escape') { 
                setCommandBuffer(''); 
                setVimMode('NORMAL');
                return; 
            }

            if (e.key === 'Enter') {
                if (curIsSearch) return;
                const cmd = cur.trim().toLowerCase();
                if (cmd === ':play') navigate('/play');
                else if (cmd === ':db' || cmd === ':dashboard' || cmd === ':q') navigate('/dashboard');
                setCommandBuffer('');
                setVimMode('NORMAL');
                return;
            }

            if (e.key === 'Backspace') {
                setCommandBuffer(p => p.slice(0, -1));
                if (cur.length <= 1) setVimMode('NORMAL');
                return;
            }

            if (e.key.length === 1) {
                if (e.key === '/') e.preventDefault();
                if (cur === '' && (e.key === '/' || e.key === ':')) {
                    setCommandBuffer(e.key);
                    setVimMode(e.key === '/' ? 'SEARCH' : 'COMMAND');
                } else if (cur.length > 0) {
                    setCommandBuffer(p => p + e.key);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/scores`)
            .then(r => r.json())
            .then((data: ScoreEntry[]) => { setScores(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const myName = user
        ? (user.name === 'Guest' ? 'GUEST' : user.name.substring(0, 10).toUpperCase())
        : '';

    const rankOf = (entry: ScoreEntry) => scores.indexOf(entry);

    return (
        <VimLayout
            gutterLines={Math.max(40, displayedScores.length + 6)}
            vimMode={vimMode}
            commandBuffer={commandBuffer}
            cmdHint={cmdHint}
            filename="leaderboard.vim [RO]"
            statusShortcuts={`${displayedScores.length} records`}
            gutterLineHeight={28}
            bodyAlignItems="stretch"
        >
            <NavBar activePage="leaderboard" />
            
            <div style={{ padding: '60px 40px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
                
                {/* Header Section */}
                <div style={{ marginBottom: '48px' }}>
                    <h1 style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '24px', color: 'var(--text)', letterSpacing: '4px', marginBottom: '12px' }}>
                        RANKINGS
                    </h1>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            <span>&lt;name&gt; SEARCH</span>
                            <span>:play START GAME</span>
                            <span>:db BACK TO DASHBOARD</span>
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div style={{ border: '1px solid var(--border)', background: 'var(--bg-alt)', borderRadius: '2px' }}>
                    {loading ? (
                        <div style={{ padding: '40px', color: 'var(--text-dim)', fontSize: '12px' }}>LOADING RECORDS...</div>
                    ) : displayedScores.length === 0 ? (
                        <div style={{ padding: '40px', color: 'var(--text-dim)', fontSize: '12px' }}>NO DATA AVAILABLE</div>
                    ) : (
                        <div>
                            {/* Headers */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '80px 1fr 120px 120px',
                                gap: '16px',
                                padding: '20px 32px',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '10px',
                                letterSpacing: '2px',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase'
                            }}>
                                <span>RANK</span>
                                <span>OPERATOR</span>
                                <span style={{ textAlign: 'right' }}>KILLS</span>
                                <span style={{ textAlign: 'right' }}>DATE</span>
                            </div>

                            {/* Rows */}
                            <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                                {displayedScores.map((entry) => {
                                    const i = rankOf(entry);
                                    const isMe = entry.playerName === myName;
                                    const isTop = i < 3;

                                    return (
                                        <div
                                            key={entry._id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '80px 1fr 120px 120px',
                                                gap: '16px',
                                                alignItems: 'center',
                                                padding: '16px 32px',
                                                borderBottom: '1px solid var(--border)',
                                                background: isMe ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <span style={{ 
                                                fontSize: isTop ? '14px' : '12px', 
                                                color: isTop ? 'var(--yellow)' : 'var(--text-muted)',
                                                fontFamily: 'monospace'
                                            }}>
                                                {RANK_MARKERS[i] ?? (i + 1).toString().padStart(2, '0')}
                                            </span>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '14px',
                                                    color: isMe ? 'var(--text)' : 'var(--text-dim)',
                                                }}>
                                                    {highlight(entry.playerName, searchQuery)}
                                                </span>
                                                {isMe && (
                                                    <span style={{ 
                                                        fontSize: '9px', 
                                                        color: 'var(--yellow)', 
                                                        border: '1px solid var(--yellow)', 
                                                        padding: '1px 4px',
                                                        borderRadius: '1px'
                                                    }}>YOU</span>
                                                )}
                                            </div>

                                            <span style={{
                                                fontFamily: '"Press Start 2P", monospace',
                                                fontSize: '11px',
                                                color: isTop ? 'var(--yellow)' : 'var(--text)',
                                                textAlign: 'right',
                                            }}>
                                                {entry.score}
                                            </span>

                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'monospace' }}>
                                                {timeAgo(entry.date)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </VimLayout>
    );
}

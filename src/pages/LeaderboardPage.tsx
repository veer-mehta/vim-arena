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
            <span style={{ background: '#ebcb8b33', color: '#ebcb8b', borderRadius: '2px', padding: '0 2px' }}>
                {text.slice(idx, idx + query.length)}
            </span>
            {text.slice(idx + query.length)}
        </>
    );
}

const MEDALS = ['🥇', '🥈', '🥉'];



export default function LeaderboardPage() {
    const navigate       = useNavigate();
    const { user, logout } = useAuth();
    const handleLogout = () => { logout(); navigate('/', { replace: true }); };
    const [scores, setScores]     = useState<ScoreEntry[]>([]);
    const [loading, setLoading]   = useState(true);
    const [commandBuffer, setCommandBuffer] = useState('');

    // Keep a ref so the single stable listener always reads the latest value
    const cmdRef = useRef(commandBuffer);
    cmdRef.current = commandBuffer;

    // Derived state — are we in search mode?
    const isSearch    = commandBuffer.startsWith('/');
    const searchQuery = isSearch ? commandBuffer.slice(1) : '';

    // Filter scores by search query (against playerName)
    const displayedScores = useMemo(() => {
        if (!searchQuery) return scores;
        return scores.filter(s =>
            s.playerName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [scores, searchQuery]);

    // Figure out status hint for the command bar
    const cmdHint = useMemo(() => {
        if (isSearch) return `searching "${searchQuery}" · ${displayedScores.length} result${displayedScores.length !== 1 ? 's' : ''}`;
        if (commandBuffer.startsWith(':p')) return ':play → Enter Arena';
        if (commandBuffer.startsWith(':d') || commandBuffer.startsWith(':q')) return ':db / :q → Dashboard';
        return '';
    }, [commandBuffer, isSearch, searchQuery, displayedScores.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const cur = cmdRef.current;
            const curIsSearch = cur.startsWith('/');

            if (e.key === 'Escape') { setCommandBuffer(''); return; }

            if (e.key === 'Enter') {
                if (curIsSearch) return; // keep filter active on Enter
                const cmd = cur.trim().toLowerCase();
                if (cmd === ':play') navigate('/play');
                else if (cmd === ':db' || cmd === ':dashboard' || cmd === ':q') navigate('/dashboard');
                setCommandBuffer('');
                return;
            }

            if (e.key === 'Backspace') {
                e.preventDefault();
                setCommandBuffer(p => p.slice(0, -1));
                return;
            }

            if (e.key.length === 1) {
                if (e.key === '/') e.preventDefault(); // block browser Quick Find
                if (cur === '' && (e.key === '/' || e.key === ':')) {
                    setCommandBuffer(e.key);
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

    // Global rank of a score entry (position in original full list)
    const rankOf = (entry: ScoreEntry) => scores.indexOf(entry);

    return (
        <VimLayout
            gutterLines={Math.max(40, displayedScores.length + 6)}
            vimMode={isSearch ? 'SEARCH' : 'NORMAL'}
            commandBuffer={commandBuffer}
            cmdHint={cmdHint}
            filename="leaderboard.vim [RO]"
            statusShortcuts={`${displayedScores.length}/${scores.length} entries`}
            gutterLineHeight={28}
            bodyAlignItems="stretch"
        >
                        <NavBar activePage="leaderboard" />
                        {/* Header */}
                        <div style={{ padding: '32px 40px 0' }}>
                            <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '20px', color: '#eceff4', letterSpacing: '3px', marginBottom: '8px' }}>
                                LEADERBOARD
                            </div>
                            <div style={{ fontSize: '13px', color: '#4c566a', marginBottom: '8px' }}>
                                Top players sorted by highest kill count
                            </div>

                            {/* Command reference strip */}
                            <div style={{ display: 'flex', gap: '24px', fontSize: '11px', color: '#3b4252', marginBottom: '24px', fontFamily: 'monospace' }}>
                                <span><span style={{ color: '#ebcb8b' }}>/name</span>  search player</span>
                                <span><span style={{ color: '#88c0d0' }}>:play</span>  start game</span>
                                <span><span style={{ color: '#4c566a' }}>:db</span>    dashboard</span>
                                <span><span style={{ color: '#4c566a' }}>Esc</span>    clear</span>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ padding: '0 40px 60px', flex: 1 }}>
                            {loading ? (
                                <div style={{ color: '#4c566a', fontSize: '13px', animation: 'pulse 1.5s ease infinite' }}>
                                    Loading scores...
                                </div>
                            ) : displayedScores.length === 0 ? (
                                <div style={{ color: '#3b4252', fontSize: '13px', fontStyle: 'italic' }}>
                                    {searchQuery
                                        ? `No players matching "${searchQuery}"`
                                        : 'No scores yet. Be the first to play!'}
                                </div>
                            ) : (
                                <>
                                    {/* Column headers */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '56px 1fr 90px 90px',
                                        gap: '0 16px',
                                        padding: '0 12px 8px',
                                        borderBottom: '1px solid #1e2030',
                                        fontSize: '10px',
                                        letterSpacing: '2px',
                                        color: '#3b4252',
                                        textTransform: 'uppercase',
                                    }}>
                                        <span>Rank</span>
                                        <span>Player</span>
                                        <span style={{ textAlign: 'right' }}>Kills</span>
                                        <span style={{ textAlign: 'right' }}>When</span>
                                    </div>

                                    {/* Rows */}
                                    {displayedScores.map((entry) => {
                                        const i     = rankOf(entry); // global rank
                                        const isMe  = entry.playerName === myName;
                                        const isTop = i < 3;

                                        return (
                                            <div
                                                key={entry._id}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '56px 1fr 90px 90px',
                                                    gap: '0 16px',
                                                    alignItems: 'center',
                                                    padding: '12px',
                                                    borderBottom: '1px solid #13151a',
                                                    background: isMe ? 'rgba(136,192,208,0.05)' : 'transparent',
                                                    borderLeft: isMe ? '2px solid #88c0d0' : '2px solid transparent',
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = isMe ? 'rgba(136,192,208,0.05)' : 'transparent')}
                                            >
                                                {/* Rank */}
                                                <span style={{ fontSize: i < 3 ? '16px' : '13px', textAlign: 'center', color: '#3b4252', fontFamily: 'monospace' }}>
                                                    {MEDALS[i] ?? `${i + 1}`}
                                                </span>

                                                {/* Player */}
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '14px',
                                                    color: isTop ? '#eceff4' : '#d8dee9',
                                                    fontWeight: isMe || isTop ? 'bold' : 'normal',
                                                }}>
                                                    {highlight(entry.playerName, searchQuery)}
                                                    {isMe && (
                                                        <span style={{ fontSize: '10px', color: '#88c0d0', marginLeft: '8px', fontWeight: 'normal' }}>you</span>
                                                    )}
                                                </span>

                                                {/* Score */}
                                                <span style={{
                                                    fontFamily: '"Press Start 2P", monospace',
                                                    fontSize: '11px',
                                                    color: i === 0 ? '#ebcb8b' : i < 3 ? '#a3be8c' : '#4c566a',
                                                    textAlign: 'right',
                                                }}>
                                                    {entry.score}
                                                </span>

                                                {/* Time ago */}
                                                <span style={{ fontSize: '11px', color: '#3b4252', textAlign: 'right', fontFamily: 'monospace' }}>
                                                    {timeAgo(entry.date)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>


        </VimLayout>
    );
}

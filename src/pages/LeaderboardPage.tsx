import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ScoreEntry {
    _id: string;
    playerName: string;
    score: number;
    date: string;
}

export default function LeaderboardPage() {
    const navigate = useNavigate();
    const [scores, setScores] = useState<ScoreEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [commandBuffer, setCommandBuffer] = useState('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setCommandBuffer('');
                return;
            }

            if (e.key === 'Enter') {
                const cmd = commandBuffer.trim().toLowerCase();
                if (cmd === ':q' || cmd === ':dashboard' || cmd === ':db') {
                    navigate('/dashboard');
                }
                setCommandBuffer('');
                return;
            }

            if (e.key === 'Backspace') {
                setCommandBuffer(prev => prev.slice(0, -1));
                return;
            }

            if (e.key.length === 1) {
                if (e.key === ':' || commandBuffer.startsWith(':')) {
                    setCommandBuffer(prev => prev + e.key);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [commandBuffer, navigate]);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/scores`)
            .then(res => res.json())
            .then((data: ScoreEntry[]) => {
                setScores(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

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
                        <div className="lb-title" style={{ fontSize: '32px', marginTop: '20px' }}>LEADERBOARD</div>
                        <div className="vim-comment" style={{ marginBottom: '48px', width: '100%', textAlign: 'left' }}>
                            Global rankings - Top scores<br/>
                            Type :q or :db to go back to dashboard
                        </div>

                        {loading ? (
                            <div className="lb-loading">Fetching scores...</div>
                        ) : scores.length === 0 ? (
                            <div className="lb-empty">No scores yet. Be the first to play!</div>
                        ) : (
                            <table className="lb-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scores.map((entry, i) => (
                                        <tr key={entry._id}>
                                            <td>{i + 1}</td>
                                            <td>
                                                <span className={i < 3 ? 'vim-keyword' : 'vim-string'}>
                                                    {entry.playerName}
                                                </span>
                                            </td>
                                            <td className="vim-number">{entry.score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="vim-statusline">
                    <div>
                        <span className="vim-statusline-primary" style={{ background: '#ffcc00' }}>RANKINGS</span>
                        <span>Leaderboard.vim</span>
                    </div>
                    <div>
                        <span>utf-8 | Top {scores.length}</span>
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

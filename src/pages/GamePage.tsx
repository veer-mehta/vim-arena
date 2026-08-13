import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AUTO, Game, Scale, Types } from 'phaser';
import { Game as MainGame } from '../game/scenes/Game';

export default function GamePage({ mode }: { mode?: string }) {
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();
    const gameRef = useRef<Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && !user) {
            navigate('/', { replace: true });
            return;
        }
    }, [user, isLoading, navigate]);

    useEffect(() => {
        if (isLoading || !user || !containerRef.current) return;

        // Listen for game-over event from Phaser
        const handleGameOver = () => {
            // Destroy the Phaser game and go back to dashboard
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
            navigate('/dashboard');
        };

        (window as any).__vimArenaGameOver = handleGameOver;
        (window as any).__vimArenaQuit = handleGameOver;
        
        (window as any).__vimArenaLeaderboard = () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
            navigate('/leaderboard');
        };

        const config: Types.Core.GameConfig = {
            type: AUTO,
            width: '100%',
            height: '100%',
            parent: containerRef.current,
            backgroundColor: '#111111',
            scale: {
                mode: Scale.RESIZE,
                autoCenter: Scale.CENTER_BOTH,
            },
            render: {
                pixelArt: false,
                roundPixels: true,
                antialias: true
            },
            callbacks: {
                preBoot: (game) => {
                    if (mode) {
                        game.registry.set('mode', mode);
                    }
                }
            },
            scene: [MainGame],
        };

        gameRef.current = new Game(config);

        return () => {
            (window as any).__vimArenaGameOver = undefined;
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, [isLoading, user, navigate, mode]);

    if (isLoading || !user) return null;

    return <div ref={containerRef} id="game-container" />;
}

import StartGame from './game/main';

declare global {
    interface Window {
        startGame: () => void;
        googlePlayerName: string;
    }
}

window.startGame = () => {
    StartGame('game-container');
};
# Vim Arena

Vim Arena is tower defense game, where you navigate, build, and defend using Vim Motions and modes.

[Live Game](https://vim-arena-five.vercel.app/)

---

## Concept

In **Vim Arena**, the editor's grid is physical. Every character represents a wall, a unit component, or empty space. Your efficiency as a defender is directly tied to your fluency with terminal commands.

- **Speed is Survival**: Faster navigation translates to faster response times.
- **Precision is Power**: Mastery of operators allows for complex battlefield manipulation.
- **Dynamic Buffer**: The map evolves as you type, delete, and yank.

---

## Controls

### NORMAL MODE
| KEY | ACTION |
|:---|:---|
| `h j k l` | Move cursor Left, Down, Up, or Right |
| `w b e` | Jump to start/end of words |
| `0 $` | Jump to beginning or end of line |
| `v` | Enter Visual Mode to select patterns |
| `y` / `yy` | Yank (copy) current selection or line |
| `p` | Paste from clipboard slot (1-9) |
| `x` / `dd` | Delete current cell or line |
| `i` / `a` | Enter Insert Mode |

### INSERT MODE
| KEY | ACTION |
|:---|:---|
| `Esc` | Return to Normal Mode |
| `Char` | Place a 1-HP wall at cursor |
| `BS` | Remove character/structure |

---

## Game Architecture

Vim Arena utilizes a hybrid architecture: **React 19** for modular UI overlays and **Phaser 3** for high-performance grid rendering, driven by a custom-built **Vim Engine**.

```text
src/
├── game/            # Core Engine & ECS Systems
│   ├── systems/     # Combat, AI, Economy, Walls
│   ├── vim/         # Bespoke Vim Command Parser
├── pages/           # Minimalist UI (Dashboard, Leaderboard)
├── context/         # Shared State Architecture
└── main.tsx         # System Entry
```

---

## Installation

### 1. ENVIRONMENT
Set up `.env` in root:
```env
VITE_GOOGLE_CLIENT_ID=your_id
VITE_API_URL=http://localhost:3000
```

### 2. DEPLOY_SERVER
```bash
cd server && npm install && npm start
```

### 3. DEPLOY_CLIENT
```bash
npm install && npm run dev
```


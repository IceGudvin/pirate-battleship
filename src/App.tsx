import React, { useState, useCallback, useRef } from 'react'
import { Arena }    from './three/Arena'
import { MiniMap }  from './components/MiniMap'
import { Hud }      from './components/Hud'
import { Menu }     from './screens/Menu'
import { GameOver } from './screens/GameOver'
import { newGameState, playerAttack, aiAttackStep } from './game/logic'
import type { GameState, LogEntry } from './game/types'
import styles from './App.module.css'

type Screen = 'menu' | 'playing' | 'gameover'

const App: React.FC = () => {
  const [screen, setScreen]   = useState<Screen>('menu')
  const [state,  setState]    = useState<GameState>(() => newGameState())
  const [log,    setLog]      = useState<LogEntry[]>([])
  const aiRef                 = useRef(false)

  const addLog = useCallback((e: LogEntry) => {
    setLog(prev => [e, ...prev].slice(0, 80))
  }, [])

  /* ── start new game ── */
  const handleStart = useCallback(() => {
    setState(newGameState())
    setLog([])
    aiRef.current = false
    setScreen('playing')
  }, [])

  /* ── back to menu ── */
  const handleMenu = useCallback(() => {
    aiRef.current = false
    setScreen('menu')
  }, [])

  /* ── cell click ── */
  const handleClick = useCallback((x: number, y: number) => {
    if (!state.playerTurn || state.gameOver || aiRef.current) return
    const cell = state.aiBoard[y][x]
    if (cell.hit || cell.miss) return

    const { nextState, logEntry } = playerAttack(state, x, y)
    if (!logEntry) return
    setState(nextState)
    addLog(logEntry)

    if (nextState.gameOver) {
      setTimeout(() => setScreen('gameover'), 1200)
      return
    }

    if (!nextState.playerTurn) {
      aiRef.current = true
      const loop = (s: GameState) => {
        const { nextState: ns, logEntry: al } = aiAttackStep(s)
        setState(ns)
        if (al) addLog(al)
        aiRef.current = false
        if (ns.gameOver) {
          setTimeout(() => setScreen('gameover'), 1200)
          return
        }
        if (!ns.playerTurn) {
          aiRef.current = true
          setTimeout(() => loop(ns), 820)
        }
      }
      setTimeout(() => loop(nextState), 900)
    }
  }, [state, addLog])

  return (
    <div className={styles.app}>

      {/* ── MENU overlay ── */}
      {screen === 'menu' && (
        <Menu onStart={handleStart} />
      )}

      {/* ── GAME OVER overlay ── */}
      {screen === 'gameover' && (
        <GameOver
          won={state.phase === 'player_won'}
          onRestart={handleStart}
          onMenu={handleMenu}
        />
      )}

      {/* ── GAME UI (always mounted to keep 3D scene alive) ── */}
      <header className={styles.header}
        style={{ opacity: screen === 'menu' ? 0 : 1,
                 pointerEvents: screen === 'menu' ? 'none' : 'all',
                 transition: 'opacity 400ms' }}>
        <div className={styles.logo}>
          <svg width="26" height="26" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="32" r="18" stroke="#facc15" strokeWidth="2.5" fill="rgba(250,204,21,0.08)"/>
            <circle cx="33" cy="30" r="4.5" fill="#facc15"/>
            <circle cx="47" cy="30" r="4.5" fill="#facc15"/>
            <path d="M34 42h12M38 42v5M42 42v5" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div className={styles.title}>PIRATE BATTLELINE</div>
            <div className={styles.sub}>React · Three.js · GLSL</div>
          </div>
        </div>

        <div className={styles.turnBadge}>
          <span className={`${styles.turnDot} ${
            state.playerTurn && !state.gameOver ? styles.dotGreen : styles.dotRed
          }`} />
          <span className={styles.turnText}>
            {state.playerTurn
              ? 'Твой ход — цель: флот призрака'
              : 'Противник думает…'}
          </span>
        </div>

        <button className={styles.btnNew} onClick={handleMenu}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Меню
        </button>
      </header>

      <div className={styles.content}
        style={{ opacity: screen === 'menu' ? 0 : 1,
                 transition: 'opacity 400ms',
                 pointerEvents: screen === 'playing' ? 'all' : 'none' }}>
        <div className={styles.arena}>
          <Arena
            playerBoard={state.playerBoard}
            playerShips={state.playerShips}
            aiBoard={state.aiBoard}
            aiShips={state.aiShips}
            playerTurn={state.playerTurn}
            gameOver={state.gameOver}
            onCellClick={handleClick}
          />
          <div className={styles.axisTop}>
            {Array.from({length:10},(_,i)=>(
              <div key={i} className={styles.axisCell}>{i+1}</div>
            ))}
          </div>
          <div className={styles.axisLeft}>
            {'ABCDEFGHIJ'.split('').map((l,i)=>(
              <div key={i} className={styles.axisCell}>{l}</div>
            ))}
          </div>
        </div>
        <aside className={styles.hud}>
          <Hud state={state} log={log} />
        </aside>
      </div>

      {screen !== 'menu' && (
        <MiniMap
          playerBoard={state.playerBoard}
          playerShips={state.playerShips}
          aiBoard={state.aiBoard}
          aiShips={state.aiShips}
          playerTurn={state.playerTurn}
        />
      )}
    </div>
  )
}

export default App

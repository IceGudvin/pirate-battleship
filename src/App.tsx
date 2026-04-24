import React, { useState, useCallback, useRef } from 'react'
import { Arena }    from './three/Arena'
import { MiniMap }  from './components/MiniMap'
import { Hud }      from './components/Hud'
import { newGameState, playerAttack, aiAttackStep } from './game/logic'
import type { GameState, LogEntry } from './game/types'
import styles from './App.module.css'

const App: React.FC = () => {
  const [state, setState]   = useState<GameState>(() => newGameState())
  const [log,   setLog]     = useState<LogEntry[]>([])
  const aiRef               = useRef(false)

  const addLog = useCallback((e: LogEntry) => {
    setLog(prev => [e, ...prev].slice(0, 80))
  }, [])

  const handleClick = useCallback((x: number, y: number) => {
    if (!state.playerTurn || state.gameOver || aiRef.current) return
    const cell = state.aiBoard[y][x]
    if (cell.hit || cell.miss) return

    const { nextState, logEntry } = playerAttack(state, x, y)
    if (!logEntry) return
    setState(nextState)
    addLog(logEntry)

    if (!nextState.playerTurn && !nextState.gameOver) {
      aiRef.current = true
      const loop = (s: GameState) => {
        const { nextState: ns, logEntry: al } = aiAttackStep(s)
        setState(ns)
        if (al) addLog(al)
        aiRef.current = false
        if (!ns.playerTurn && !ns.gameOver) {
          aiRef.current = true
          setTimeout(() => loop(ns), 820)
        }
      }
      setTimeout(() => loop(nextState), 900)
    }
  }, [state, addLog])

  const handleNew = useCallback(() => {
    setState(newGameState())
    setLog([])
    aiRef.current = false
  }, [])

  return (
    <div className={styles.app}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="13" r="9" stroke="#facc15" strokeWidth="1.5" fill="rgba(250,204,21,0.1)"/>
            <circle cx="10.5" cy="12" r="2" fill="#facc15"/>
            <circle cx="17.5" cy="12" r="2" fill="#facc15"/>
            <path d="M11 17h6M13 17v2M15 17v2" stroke="#facc15" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M6 21l4-3M22 21l-4-3" stroke="#facc15" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div>
            <div className={styles.title}>PIRATE BATTLELINE</div>
            <div className={styles.sub}>React · Three.js · GLSL Shaders</div>
          </div>
        </div>

        <div className={styles.turnBadge}>
          <span className={`${styles.turnDot}
            ${state.playerTurn && !state.gameOver ? styles.dotGreen : styles.dotRed}`} />
          <span className={styles.turnText}>
            {state.gameOver
              ? (state.phase === 'player_won' ? '🏴‍☠️ Победа!' : '💀 Поражение')
              : state.playerTurn
                ? 'Твой ход — цель: флот призрака'
                : 'Противник думает…'
            }
          </span>
        </div>

        <button className={styles.btnNew} onClick={handleNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
          Новая битва
        </button>
      </header>

      {/* CONTENT */}
      <div className={styles.content}>
        {/* 3D ARENA */}
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

          {/* AXIS LABELS overlay */}
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

          {/* Game over overlay */}
          {state.gameOver && (
            <div className={styles.gameOver}>
              <div className={styles.gameOverBox}>
                <div className={styles.gameOverIcon}>
                  {state.phase==='player_won' ? '🏴‍☠️' : '💀'}
                </div>
                <div className={styles.gameOverTitle}>
                  {state.phase==='player_won' ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
                </div>
                <div className={styles.gameOverSub}>
                  {state.phase==='player_won'
                    ? 'Вражеский флот уничтожен!'
                    : 'Твой флот пошёл ко дну…'}
                </div>
                <button className={styles.btnNew} onClick={handleNew}
                  style={{marginTop:20}}>Играть снова</button>
              </div>
            </div>
          )}
        </div>

        {/* HUD SIDEBAR */}
        <aside className={styles.hud}>
          <Hud state={state} log={log} />
        </aside>
      </div>

      {/* MINIMAP */}
      <MiniMap
        playerBoard={state.playerBoard}
        playerShips={state.playerShips}
        aiBoard={state.aiBoard}
        aiShips={state.aiShips}
        playerTurn={state.playerTurn}
      />
    </div>
  )
}

export default App

import React, { useState, useCallback, useRef } from 'react'
import { PlayerBoard } from './components/PlayerBoard'
import { EnemyScene } from './three/EnemyScene'
import { Hud } from './components/Hud'
import { newGameState, playerAttack, aiAttackStep } from './game/logic'
import type { GameState, LogEntry } from './game/types'
import styles from './App.module.css'

const App: React.FC = () => {
  const [state, setState] = useState<GameState>(() => newGameState())
  const [log, setLog] = useState<LogEntry[]>([])
  const aiThinkingRef = useRef(false)

  const addLog = useCallback((entry: LogEntry) => {
    setLog(prev => [entry, ...prev].slice(0, 80))
  }, [])

  const handleEnemyCellClick = useCallback((x: number, y: number) => {
    if (!state.playerTurn || state.gameOver || aiThinkingRef.current) return
    const cell = state.aiBoard[y][x]
    if (cell.hit || cell.miss) return

    const { nextState, logEntry } = playerAttack(state, x, y)
    if (!logEntry) return
    setState(nextState)
    addLog(logEntry)

    if (!nextState.playerTurn && !nextState.gameOver) {
      aiThinkingRef.current = true
      const aiLoop = (s: GameState) => {
        const { nextState: afterAi, logEntry: aiLog } = aiAttackStep(s)
        setState(afterAi)
        if (aiLog) addLog(aiLog)
        aiThinkingRef.current = false
        if (!afterAi.playerTurn && !afterAi.gameOver) {
          aiThinkingRef.current = true
          setTimeout(() => aiLoop(afterAi), 750)
        }
      }
      setTimeout(() => aiLoop(nextState), 800)
    }
  }, [state, addLog])

  const handleNewGame = useCallback(() => {
    setState(newGameState())
    setLog([])
    aiThinkingRef.current = false
  }, [])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Pirate skull">
            <circle cx="14" cy="13" r="10" fill="#facc15" opacity="0.15"/>
            <circle cx="14" cy="13" r="9" stroke="#facc15" strokeWidth="1.5" fill="none"/>
            <circle cx="10.5" cy="12" r="2.2" fill="#facc15"/>
            <circle cx="17.5" cy="12" r="2.2" fill="#facc15"/>
            <path d="M11 17h6M13 17v2M15 17v2" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 20l4-3M22 20l-4-3" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div className={styles.title}>PIRATE BATTLELINE</div>
            <div className={styles.sub}>React · Three.js · WebGL Shaders</div>
          </div>
        </div>
        <button className={styles.btnNewGame} onClick={handleNewGame}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
          Новая битва
        </button>
      </header>

      <main className={styles.main}>
        {/* LEFT — player board */}
        <section className={styles.playerCol}>
          <div className={styles.colHeader}>
            <span className={styles.colDot} style={{background:'#22c55e'}} />
            МОЙ ФЛОТ
          </div>
          <PlayerBoard board={state.playerBoard} />
        </section>

        {/* CENTER — 3D enemy ocean */}
        <section className={styles.enemyCol}>
          <div className={styles.colHeader}>
            <span className={styles.colDot} style={{background: state.playerTurn && !state.gameOver ? '#facc15':'#ef4444'}} />
            ФЛОТ ПРИЗРАКА
            {state.playerTurn && !state.gameOver &&
              <span className={styles.fireHint}>· наведи и кликай</span>}
            {!state.playerTurn && !state.gameOver &&
              <span className={styles.fireHint} style={{color:'#f87171'}}>· ждём хода противника…</span>}
          </div>
          <div className={styles.sceneWrap}>
            <EnemyScene
              board={state.aiBoard}
              disabled={!state.playerTurn || state.gameOver}
              onCellClick={handleEnemyCellClick}
            />
            {state.gameOver && (
              <div className={styles.gameOverOverlay}>
                <div className={styles.gameOverBox}>
                  <div className={styles.gameOverIcon}>
                    {state.phase === 'player_won' ? '🏴‍☠️' : '💀'}
                  </div>
                  <div className={styles.gameOverTitle}>
                    {state.phase === 'player_won' ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
                  </div>
                  <div className={styles.gameOverSub}>
                    {state.phase === 'player_won'
                      ? 'Вражеский флот уничтожен!'
                      : 'Твой флот пошёл ко дну...'}
                  </div>
                  <button className={styles.btnNewGame} onClick={handleNewGame}
                    style={{marginTop:16}}>
                    Играть снова
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — HUD */}
        <aside className={styles.hudCol}>
          <Hud state={state} log={log} />
        </aside>
      </main>
    </div>
  )
}

export default App

import React, { useState, useCallback, useRef } from 'react'
import { PlayerBoard } from './components/PlayerBoard'
import { EnemyGrid } from './components/EnemyGrid'
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
    setLog(prev => [entry, ...prev].slice(0, 60))
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
          setTimeout(() => aiLoop(afterAi), 700)
        }
      }
      setTimeout(() => aiLoop(nextState), 750)
    }
  }, [state, addLog])

  const handleNewGame = useCallback(() => {
    setState(newGameState())
    setLog([])
    aiThinkingRef.current = false
  }, [])

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.skull}>☠</span>
          <div>
            <div className={styles.title}>PIRATE BATTLELINE</div>
            <div className={styles.sub}>Пиратский морской бой · React + Three.js + WebGL</div>
          </div>
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.btnGhost} onClick={handleNewGame}>⚓ Новая битва</button>
        </div>
      </header>

      {/* Main layout: [player board] [3D enemy scene] [hud] */}
      <main className={styles.main}>

        {/* LEFT — player 2D board */}
        <section className={styles.playerCol}>
          <div className={styles.colLabel}>⚓ Мой флот</div>
          <PlayerBoard board={state.playerBoard} />
        </section>

        {/* CENTER — enemy 3D scene + 2D clickable grid overlay */}
        <section className={styles.enemyCol}>
          <div className={styles.colLabel}>💀 Флот призрака <span className={styles.colHint}>(кликай по полю)</span></div>
          <div className={styles.sceneWrap}>
            <EnemyScene
              aiShips={state.aiShips}
              aiBoard={state.aiBoard}
            />
            <div className={styles.gridOverlay}>
              <EnemyGrid
                board={state.aiBoard}
                onCellClick={handleEnemyCellClick}
                disabled={!state.playerTurn || state.gameOver}
              />
            </div>
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

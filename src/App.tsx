import React, { useState, useCallback, useRef } from 'react'
import { Board } from './components/Board'
import { Hud } from './components/Hud'
import { SeaScene } from './three/SeaScene'
import { newGameState, playerAttack, aiAttackStep } from './game/logic'
import type { GameState, LogEntry } from './game/types'
import styles from './App.module.css'

const App: React.FC = () => {
  const [state, setState] = useState<GameState>(() => newGameState())
  const [log, setLog] = useState<LogEntry[]>([])
  const aiThinkingRef = useRef(false)

  const addLog = useCallback((entry: LogEntry) => {
    setLog(prev => [entry, ...prev].slice(0, 50))
  }, [])

  const handleAiCellClick = useCallback((x: number, y: number) => {
    if (!state.playerTurn || state.gameOver || aiThinkingRef.current) return

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
          setTimeout(() => aiLoop(afterAi), 650)
        }
      }
      setTimeout(() => aiLoop(nextState), 700)
    }
  }, [state, addLog])

  const handleNewGame = useCallback(() => {
    setState(newGameState())
    setLog([])
    aiThinkingRef.current = false
  }, [])

  const handleRandomize = useCallback(() => {
    setState(newGameState())
    setLog([{ type: 'info', text: '⚓ Флот расставлен автоматически. Пора в бой!' }])
    aiThinkingRef.current = false
  }, [])

  return (
    <div className={styles.app}>
      <div className={styles.waveOverlay} />

      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.coin} />
          <div>
            <h1 className={styles.title}>PIRATE BATTLELINE</h1>
            <p className={styles.subtitle}>Пиратский морской бой · React + Three.js + WebGL</p>
          </div>
        </div>
        <div className={styles.controls}>
          <button className={styles.btnGhost} onClick={handleRandomize}>
            ⚓ Авто-расстановка
          </button>
          <button className={styles.btnPrimary} onClick={handleNewGame}>
            ☠ Новая битва
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.sceneryCol}>
          <div className={styles.seaContainer}>
            <SeaScene
              playerShips={state.playerShips}
              aiShips={state.aiShips}
              playerBoard={state.playerBoard}
              aiBoard={state.aiBoard}
            />
          </div>
          <div className={styles.boards}>
            <Board
              label="Флот капитана"
              badge="player"
              board={state.playerBoard}
              revealShips
            />
            <Board
              label="Флот призрака"
              badge="ai"
              board={state.aiBoard}
              revealShips={false}
              onCellClick={handleAiCellClick}
              disabled={!state.playerTurn || state.gameOver}
            />
          </div>
        </section>

        <aside className={styles.hudCol}>
          <Hud state={state} log={log} />
        </aside>
      </main>
    </div>
  )
}

export default App

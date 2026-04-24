import React from 'react'
import type { GameState, LogEntry } from '../game/types'
import styles from './Hud.module.css'

interface Props { state: GameState; log: LogEntry[] }

export const Hud: React.FC<Props> = ({ state, log }) => {
  const { phase, playerTurn, aiShips, playerShips } = state
  const playerSunk = playerShips.filter(s => s.hits >= s.size).length
  const aiSunk     = aiShips.filter(s => s.hits >= s.size).length

  const statusText = () => {
    if (phase === 'player_won') return '🏴‍☠️ Вражеский флот уничтожен! Победа!'
    if (phase === 'ai_won')     return '💀 Твой флот на дне. Пираты победили!'
    return playerTurn
      ? 'Выбирай клетку на поле врага и открывай огонь.'
      : 'Противник думает...'
  }

  const pillLabel = () => {
    if (phase === 'player_won') return '🏆 Победа'
    if (phase === 'ai_won')     return '💀 Поражение'
    return playerTurn ? '⚡ Твой ход' : '🤖 Ход AI'
  }

  return (
    <div className={styles.hud}>
      <div className={styles.turnBlock}>
        <span className={`${styles.pill} ${!playerTurn || phase==='ai_won' ? styles.danger : ''} ${phase==='player_won' ? styles.win : ''}`}>
          {pillLabel()}
        </span>
        <p className={styles.statusText}>{statusText()}</p>
      </div>

      <div className={styles.scoreGrid}>
        <div className={styles.scoreCard}>
          <div className={styles.scoreNum}>{aiSunk}<span className={styles.scoreOf}>/{aiShips.length}</span></div>
          <div className={styles.scoreLabel}>Тобой потоплено</div>
        </div>
        <div className={styles.scoreDivider} />
        <div className={`${styles.scoreCard} ${styles.danger}`}>
          <div className={styles.scoreNum}>{playerSunk}<span className={styles.scoreOf}>/{playerShips.length}</span></div>
          <div className={styles.scoreLabel}>Потоплено у тебя</div>
        </div>
      </div>

      <div className={styles.fleetSection}>
        <div className={styles.fleetLabel}>Флот противника</div>
        <div className={styles.fleet}>
          {aiShips.map(ship => (
            <div key={ship.id}
              className={`${styles.shipIcon} ${ship.hits>0&&ship.hits<ship.size?styles.damaged:''} ${ship.hits>=ship.size?styles.sunk:''}`}
              title={`${ship.size} кл. ${ship.hits>=ship.size?'— потоплен':ship.hits>0?`— ${ship.hits}/${ship.size} попаданий`:''}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.logWrap}>
        <div className={styles.logLabel}>📜 Журнал битвы</div>
        <div className={styles.log}>
          {log.length===0 && <div className={styles.logEmpty}>Битва ещё не началась...</div>}
          {log.map((e,i) => (
            <div key={i} className={`${styles.logLine} ${styles[e.type]}`}>{e.text}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import type { GameState, LogEntry } from '../game/types'
import styles from './Hud.module.css'

interface HudProps {
  state: GameState
  log: LogEntry[]
}

export const Hud: React.FC<HudProps> = ({ state, log }) => {
  const { phase, playerTurn, aiShips, playerShips } = state

  const statusText = () => {
    if (phase === 'player_won') return '🏴‍☠️ Вражеский флот уничтожен. Победа, капитан!'
    if (phase === 'ai_won') return '💀 Твой флот ушёл на дно. Пираты победили!'
    return playerTurn
      ? 'Выбирай клетку на вражеском поле и открывай огонь.'
      : 'Противник думает...'
  }

  const pillLabel = () => {
    if (phase === 'player_won') return '🏆 Победа'
    if (phase === 'ai_won') return '💀 Поражение'
    return playerTurn ? 'Ход игрока' : 'Ход AI'
  }

  const pillDanger = !playerTurn || phase === 'ai_won'

  const playerSunk = playerShips.filter(s => s.hits >= s.size).length
  const aiSunk = aiShips.filter(s => s.hits >= s.size).length

  return (
    <div className={styles.hud}>
      <div className={styles.status}>
        <span className={`${styles.pill} ${pillDanger ? styles.danger : ''}`}>
          {pillLabel()}
        </span>
        <p className={styles.statusText}>{statusText()}</p>
      </div>

      <div className={styles.score}>
        <div className={styles.scoreItem}>
          <span className={styles.scoreLabel}>Тобой потоплено</span>
          <span className={styles.scoreValue}>{aiSunk} / {aiShips.length}</span>
        </div>
        <div className={styles.scoreDivider} />
        <div className={styles.scoreItem}>
          <span className={styles.scoreLabel}>Потоплено у тебя</span>
          <span className={`${styles.scoreValue} ${styles.danger}`}>{playerSunk} / {playerShips.length}</span>
        </div>
      </div>

      <div className={styles.shipsStrip}>
        <p className={styles.stripLabel}>Флот противника</p>
        <div className={styles.ships}>
          {aiShips.map(ship => (
            <div
              key={ship.id}
              className={`${styles.shipIcon} ${ship.hits >= ship.size ? styles.shipSunk : ''}`}
              title={`Корабль ${ship.size} клетки${ship.hits >= ship.size ? ' — потоплен' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.log}>
        {log.map((entry, i) => (
          <div key={i} className={`${styles.logLine} ${styles[entry.type]}`}>
            {entry.text}
          </div>
        ))}
        {log.length === 0 && (
          <div className={styles.logEmpty}>Здесь будет лог битвы...</div>
        )}
      </div>
    </div>
  )
}

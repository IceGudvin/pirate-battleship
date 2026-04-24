import React from 'react'
import type { Board, Ship } from '../game/types'
import styles from './MiniMap.module.css'

interface MiniBoardProps {
  board: Board
  ships: Ship[]
  showShips: boolean
  label: string
  isActive: boolean
}

const MiniBoard: React.FC<MiniBoardProps> = ({ board, ships, showShips, label, isActive }) => {
  const shipSet = new Set<string>()
  ships.forEach(s => {
    for (let i = 0; i < s.size; i++) {
      const x = s.horizontal ? s.x + i : s.x
      const y = s.horizontal ? s.y : s.y + i
      shipSet.add(`${x}-${y}`)
    }
  })

  return (
    <div className={`${styles.miniBoard} ${isActive ? styles.active : ''}`}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.grid}>
        {board.map((row, y) =>
          row.map((cell, x) => {
            const hasShip = showShips && shipSet.has(`${x}-${y}`)
            let cls = styles.cell
            if (hasShip) cls += ' ' + styles.ship
            if (cell.hit)  cls += ' ' + styles.hit
            if (cell.miss) cls += ' ' + styles.miss
            return <div key={`${x}-${y}`} className={cls} />
          })
        )}
      </div>
    </div>
  )
}

interface MiniMapProps {
  playerBoard: Board; playerShips: Ship[]
  aiBoard: Board; aiShips: Ship[]
  playerTurn: boolean
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerBoard, playerShips, aiBoard, aiShips, playerTurn
}) => (
  <div className={styles.wrap}>
    <MiniBoard
      board={playerBoard} ships={playerShips}
      showShips={true}
      label="МОЙ ФЛОТ"
      isActive={!playerTurn}
    />
    <div className={styles.divider}>
      <div className={styles.dividerLine} />
      <div className={styles.dividerIcon}>⚓</div>
      <div className={styles.dividerLine} />
    </div>
    <MiniBoard
      board={aiBoard} ships={aiShips}
      showShips={false}
      label="ПРОТИВНИК"
      isActive={playerTurn}
    />
  </div>
)

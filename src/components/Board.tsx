import React from 'react'
import type { Board as BoardType } from '../game/types'
import styles from './Board.module.css'

interface BoardProps {
  label: string
  badge: 'player' | 'ai'
  board: BoardType
  revealShips: boolean
  onCellClick?: (x: number, y: number) => void
  disabled?: boolean
}

export const Board: React.FC<BoardProps> = ({
  label,
  badge,
  board,
  revealShips,
  onCellClick,
  disabled = false,
}) => {
  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={`${styles.badge} ${styles[badge]}`}>
          {badge === 'player' ? 'Игрок' : 'Противник'}
        </span>
      </div>
      <div className={styles.sea}>
        <div className={styles.grid}>
          {board.map((row, y) =>
            row.map((cell, x) => {
              const isShip = revealShips && cell.shipId !== null
              const cls = [
                styles.cell,
                cell.hit ? styles.hit : '',
                cell.miss ? styles.miss : '',
                isShip ? styles.ship : '',
                disabled || cell.hit || cell.miss ? styles.locked : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div
                  key={`${x}-${y}`}
                  className={cls}
                  onClick={() => !disabled && onCellClick?.(x, y)}
                >
                  {cell.hit && <span className={styles.explosion} />}
                  {cell.miss && <span className={styles.splash} />}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

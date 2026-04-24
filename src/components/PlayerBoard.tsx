import React from 'react'
import type { Board } from '../game/types'
import styles from './PlayerBoard.module.css'

interface Props {
  board: Board
}

export const PlayerBoard: React.FC<Props> = ({ board }) => {
  return (
    <div className={styles.wrapper}>
      {/* Column labels */}
      <div className={styles.colLabels}>
        <div className={styles.cornerCell} />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={styles.axisLabel}>{i + 1}</div>
        ))}
      </div>
      <div className={styles.gridRow}>
        <div className={styles.rowLabels}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={styles.axisLabel}>{String.fromCharCode(65 + i)}</div>
          ))}
        </div>
        <div className={styles.grid}>
          {board.map((row, y) =>
            row.map((cell, x) => {
              let cls = styles.cell
              if (cell.shipId !== null) cls += ' ' + styles.ship
              if (cell.hit) cls += ' ' + styles.hit
              if (cell.miss) cls += ' ' + styles.miss
              return (
                <div key={`${x}-${y}`} className={cls}>
                  {cell.hit && <span className={styles.fireIcon}>🔥</span>}
                  {cell.miss && <span className={styles.splashDot} />}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

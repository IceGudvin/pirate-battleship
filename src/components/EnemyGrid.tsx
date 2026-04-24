import React from 'react'
import type { Board } from '../game/types'
import styles from './EnemyGrid.module.css'

interface Props {
  board: Board
  onCellClick: (x: number, y: number) => void
  disabled: boolean
}

export const EnemyGrid: React.FC<Props> = ({ board, onCellClick, disabled }) => {
  return (
    <div className={styles.wrapper}>
      {/* Column labels */}
      <div className={styles.colLabels}>
        <div className={styles.corner} />
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
              const isLocked = cell.hit || cell.miss
              let cls = styles.cell
              if (cell.hit) cls += ' ' + styles.hit
              else if (cell.miss) cls += ' ' + styles.miss
              else if (!disabled) cls += ' ' + styles.hoverable
              if (isLocked || disabled) cls += ' ' + styles.locked

              return (
                <div
                  key={`${x}-${y}`}
                  className={cls}
                  onClick={() => !disabled && !isLocked && onCellClick(x, y)}
                >
                  {cell.hit && <span className={styles.explosion} />}
                  {cell.miss && <span className={styles.splash} />}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import type { Board } from '../game/types'
import styles from './PlayerBoard.module.css'

interface Props { board: Board }

export const PlayerBoard: React.FC<Props> = ({ board }) => {
  const LETTERS = 'ABCDEFGHIJ'
  return (
    <div className={styles.wrapper}>
      <div className={styles.inner}>
        <div className={styles.colLabels}>
          <div className={styles.corner} />
          {Array.from({length:10},(_,i)=>(
            <div key={i} className={styles.axisLabel}>{i+1}</div>
          ))}
        </div>
        <div className={styles.gridRow}>
          <div className={styles.rowLabels}>
            {Array.from({length:10},(_,i)=>(
              <div key={i} className={styles.axisLabel}>{LETTERS[i]}</div>
            ))}
          </div>
          <div className={styles.grid}>
            {board.map((row,y) => row.map((cell,x) => {
              let cls = styles.cell
              if (cell.shipId!==null) cls += ' '+styles.ship
              if (cell.hit)  cls += ' '+styles.hit
              if (cell.miss) cls += ' '+styles.miss
              return (
                <div key={`${x}-${y}`} className={cls}>
                  {cell.hit  && <span className={styles.hitDot}/>}
                  {cell.miss && <span className={styles.missDot}/>}
                </div>
              )
            }))}
          </div>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import type { GameState, LogEntry } from '../game/types'
import styles from './Hud.module.css'

interface Props { state: GameState; log: LogEntry[] }

export const Hud: React.FC<Props> = ({ state, log }) => {
  const { phase, playerTurn, aiShips, playerShips, gameOver } = state
  const aiSunk     = aiShips.filter(s => s.hits >= s.size).length
  const playerSunk = playerShips.filter(s => s.hits >= s.size).length

  return (
    <div className={styles.hud}>
      {/* Score */}
      <div className={styles.scoreBlock}>
        <div className={styles.scoreItem}>
          <span className={styles.scoreNum} style={{color:'#4ade80'}}>{aiSunk}</span>
          <span className={styles.scoreSep}>/{aiShips.length}</span>
          <div className={styles.scoreLabel}>потоплено тобой</div>
        </div>
        <div className={styles.scoreDivider}/>
        <div className={styles.scoreItem}>
          <span className={styles.scoreNum} style={{color:'#f87171'}}>{playerSunk}</span>
          <span className={styles.scoreSep}>/{playerShips.length}</span>
          <div className={styles.scoreLabel}>потоплено у тебя</div>
        </div>
      </div>

      {/* Enemy fleet */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Флот противника</div>
        <div className={styles.fleet}>
          {aiShips.map(ship => {
            const sunk = ship.hits >= ship.size
            const dmg  = ship.hits > 0 && !sunk
            return (
              <div key={ship.id} className={`${styles.shipRow} ${sunk?styles.sunk:dmg?styles.dmg:''}`}>
                {Array.from({length:ship.size},(_,i)=>(
                  <span key={i} className={`${styles.shipSeg} ${i<ship.hits?styles.segHit:''}`}/>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Log */}
      <div className={styles.section} style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
        <div className={styles.sectionTitle}>Журнал боя</div>
        <div className={styles.log}>
          {log.length===0 && <div className={styles.logEmpty}>Битва ещё не началась…</div>}
          {log.map((e,i)=>(
            <div key={i} className={`${styles.logLine} ${styles[e.type]}`}>
              <span className={styles.logIcon}>
                {e.type==='hit'?'🔥':e.type==='sunk'?'💥':e.type==='miss'?'💧':'→'}
              </span>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

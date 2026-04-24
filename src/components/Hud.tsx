import React from 'react'
import type { GameState, LogEntry } from '../game/types'
import styles from './Hud.module.css'

interface Props { state: GameState; log: LogEntry[] }

export const Hud: React.FC<Props> = ({ state, log }) => {
  const { phase, playerTurn, aiShips, playerShips, gameOver } = state
  const playerSunk = playerShips.filter(s => s.hits >= s.size).length
  const aiSunk     = aiShips.filter(s => s.hits >= s.size).length
  const aiHits     = aiShips.reduce((a,s) => a + s.hits, 0)
  const LETTERS    = 'ABCDEFGHIJ'

  return (
    <div className={styles.hud}>

      {/* Status pill */}
      <div className={styles.statusRow}>
        <span className={[
          styles.pill,
          gameOver && phase==='player_won' ? styles.win    :
          gameOver && phase==='ai_won'     ? styles.lose   :
          playerTurn                        ? styles.active :
          styles.waiting
        ].join(' ')}>
          {gameOver && phase==='player_won' ? '🏆 Победа'
          :gameOver && phase==='ai_won'     ? '💀 Поражение'
          :playerTurn                        ? '⚡ Твой ход'
          : '🤖 Ход AI'}
        </span>
      </div>

      {/* Score */}
      <div className={styles.scoreBar}>
        <div className={styles.scoreItem}>
          <span className={styles.scoreNum} style={{color:'#4ade80'}}>
            {aiSunk}
          </span>
          <span className={styles.scoreDen}>/{aiShips.length}</span>
          <div className={styles.scoreLabel}>потоплено тобой</div>
        </div>
        <div className={styles.scoreSep}/>
        <div className={styles.scoreItem}>
          <span className={styles.scoreNum} style={{color:'#f87171'}}>
            {playerSunk}
          </span>
          <span className={styles.scoreDen}>/{playerShips.length}</span>
          <div className={styles.scoreLabel}>потоплено у тебя</div>
        </div>
      </div>

      {/* Enemy fleet status */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Флот противника</div>
        <div className={styles.fleet}>
          {aiShips.map(ship => {
            const sunk = ship.hits >= ship.size
            const dmg  = ship.hits > 0 && !sunk
            return (
              <div
                key={ship.id}
                className={[styles.ship, sunk?styles.sunk:dmg?styles.damaged:styles.intact].join(' ')}
                title={`${ship.size} кл. ${
                  sunk ? '— потоплен' : dmg ? `— ${ship.hits}/${ship.size} попад.` : ''
                }`}
              >
                {Array.from({length:ship.size},(_,i)=>(
                  <span key={i} className={[
                    styles.shipCell,
                    i<ship.hits?styles.shipHit:''
                  ].join(' ')}/>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Battle log */}
      <div className={styles.section} style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
        <div className={styles.sectionTitle}>Журнал битвы</div>
        <div className={styles.log}>
          {log.length===0 && (
            <div className={styles.logEmpty}>Битва ещё не началась…</div>
          )}
          {log.map((e,i)=>(
            <div key={i} className={[styles.logLine, styles[e.type]].join(' ')}>
              <span className={styles.logBullet}>
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

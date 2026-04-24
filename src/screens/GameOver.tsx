import React, { useEffect, useState } from 'react'
import styles from './GameOver.module.css'

interface GameOverProps {
  won: boolean
  onRestart: () => void
  onMenu: () => void
}

export const GameOver: React.FC<GameOverProps> = ({ won, onRestart, onMenu }) => {
  const [visible, setVisible] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50)
    const t2 = setTimeout(() => setShowContent(true), 400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={`${styles.overlay} ${visible ? styles.visible : ''}`}>
      {/* animated bg particles */}
      <div className={styles.particles}>
        {Array.from({ length: won ? 24 : 12 }, (_, i) => (
          <div key={i} className={`${styles.particle} ${won ? styles.gold : styles.dark}`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              width: `${4 + Math.floor(Math.random() * 8)}px`,
              height: `${4 + Math.floor(Math.random() * 8)}px`,
            }}
          />
        ))}
      </div>

      <div className={`${styles.box} ${showContent ? styles.boxVisible : ''}`}>
        {/* icon */}
        <div className={`${styles.icon} ${won ? styles.iconWon : styles.iconLost}`}>
          {won ? '🏴\u200d\u2620\ufe0f' : '💀'}
        </div>

        {/* title */}
        <div className={`${styles.title} ${won ? styles.titleWon : styles.titleLost}`}>
          {won ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'}
        </div>

        {/* subtitle */}
        <div className={styles.subtitle}>
          {won
            ? 'Вражеский флот пошёл ко дну. Ты — настоящий пират!'
            : 'Твой флот уничтожен. Море забрало всё…'}
        </div>

        {/* decorative line */}
        <div className={`${styles.line} ${won ? styles.lineWon : styles.lineLost}`} />

        {/* buttons */}
        <div className={styles.btns}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${won ? styles.btnWon : styles.btnLost}`}
            onClick={onRestart}>
            <span>⚔️</span>
            <span>Играть снова</span>
          </button>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onMenu}>
            <span>🏠</span>
            <span>Главное меню</span>
          </button>
        </div>
      </div>
    </div>
  )
}

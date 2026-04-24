import React, { useRef, useEffect, useState } from 'react'
import styles from './Menu.module.css'

/* ── GLSL animated sea background on 2D canvas ── */
const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`
const FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2  u_res;

float wave(vec2 uv, float spd, float freq, float amp) {
  return sin(uv.x * freq + u_time * spd) * amp
       + sin(uv.x * freq * 0.7 + u_time * spd * 1.3 + 1.2) * amp * 0.6;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.y = 1.0 - uv.y;

  vec3 deep  = vec3(0.004, 0.018, 0.07);
  vec3 mid   = vec3(0.012, 0.055, 0.20);
  vec3 crest = vec3(0.15,  0.40,  0.85);
  vec3 foam  = vec3(0.55,  0.78,  1.00);

  float y = uv.y;
  vec3 col = mix(deep, mid, smoothstep(0.0, 1.0, y));

  // layered waves
  float w1 = wave(uv, 0.55, 7.0,  0.018);
  float w2 = wave(uv, 0.80, 13.0, 0.010);
  float w3 = wave(uv, 1.10, 22.0, 0.006);
  float wsum = w1 + w2 + w3;

  col = mix(col, crest, smoothstep(0.0, 0.04, wsum) * 0.5);
  col = mix(col, foam,  smoothstep(0.03, 0.055, wsum) * 0.7);

  // vignette
  float vx = uv.x * 2.0 - 1.0;
  float vy = uv.y * 2.0 - 1.0;
  float vig = 1.0 - smoothstep(0.55, 1.4, sqrt(vx*vx + vy*vy));
  col *= vig;

  // subtle scanlines
  float scan = sin(gl_FragCoord.y * 3.14159) * 0.5 + 0.5;
  col *= 0.96 + scan * 0.04;

  gl_FragColor = vec4(col, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

const SeaCanvas: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const gl = canvas.getContext('webgl')!

    const prog = gl.createProgram()!
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT))
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes  = gl.getUniformLocation(prog, 'u_res')

    let raf = 0
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const start = performance.now()
    const tick = () => {
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className={styles.seaCanvas} />
}

/* ── Rules card ── */
const RULES = [
  { icon: '🎯', title: 'Атакуй', text: 'Нажимай по клеткам вражеского поля — потопи все корабли противника' },
  { icon: '💥', title: 'Попал — ходишь снова', text: 'При попадании ход остаётся у тебя. При промахе — очередь ИИ' },
  { icon: '🏴‍☠️', title: 'Победа', text: 'Первый, кто уничтожил весь флот противника — капитан!' },
]

interface MenuProps {
  onStart: () => void
}

export const Menu: React.FC<MenuProps> = ({ onStart }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`${styles.wrap} ${visible ? styles.visible : ''}`}>
      <SeaCanvas />

      {/* floating particles */}
      <div className={styles.particles}>
        {Array.from({ length: 18 }, (_, i) => (
          <div key={i} className={styles.particle}
            style={{
              left: `${5 + i * 5.5}%`,
              animationDelay: `${i * 0.38}s`,
              animationDuration: `${4 + (i % 5)}s`,
              width: `${3 + (i % 4)}px`,
              height: `${3 + (i % 4)}px`,
            }}
          />
        ))}
      </div>

      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* skull */}
              <circle cx="40" cy="32" r="18" stroke="#facc15" strokeWidth="2.5" fill="rgba(250,204,21,0.08)"/>
              <circle cx="33" cy="30" r="4.5" fill="#facc15"/>
              <circle cx="47" cy="30" r="4.5" fill="#facc15"/>
              <path d="M34 42h12M38 42v5M42 42v5" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"/>
              {/* crossbones */}
              <line x1="14" y1="60" x2="66" y2="68" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="14" y1="68" x2="66" y2="60" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="14" cy="64" r="4" fill="#facc15"/>
              <circle cx="66" cy="64" r="4" fill="#facc15"/>
              <circle cx="14" cy="60" r="3" fill="#facc15"/>
              <circle cx="66" cy="68" r="3" fill="#facc15"/>
              {/* glow ring */}
              <circle cx="40" cy="32" r="24" stroke="rgba(250,204,21,0.15)" strokeWidth="1"/>
            </svg>
          </div>
          <div className={styles.logoText}>
            <div className={styles.titleMain}>PIRATE</div>
            <div className={styles.titleSub}>BATTLELINE</div>
            <div className={styles.titleTech}>Three.js · GLSL · React</div>
          </div>
        </div>

        {/* CTA */}
        <button className={styles.btnStart} onClick={onStart}>
          <span className={styles.btnIcon}>⚓</span>
          <span>НАЧАТЬ БИТВУ</span>
          <span className={styles.btnArrow}>→</span>
        </button>

        {/* Rules */}
        <div className={styles.rules}>
          {RULES.map((r, i) => (
            <div key={i} className={styles.ruleCard}
              style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
              <div className={styles.ruleIcon}>{r.icon}</div>
              <div>
                <div className={styles.ruleTitle}>{r.title}</div>
                <div className={styles.ruleText}>{r.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

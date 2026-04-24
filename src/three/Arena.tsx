import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Board, Ship } from '../game/types'

/* ─────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────── */
const CELL  = 1.05
const BOARD = 10 * CELL
const OFF   = -BOARD / 2 + CELL / 2

// Two boards side by side on Z axis: player at z=0, enemy at z=BOARD+8
const PLAYER_Z = 0
const ENEMY_Z  = BOARD + 10

// Camera presets
const CAM_PLAYER = new THREE.Vector3(0, 13, PLAYER_Z + 14)
const CAM_ENEMY  = new THREE.Vector3(0, 13, ENEMY_Z  + 14)
const TARGET_PLAYER = new THREE.Vector3(0, 0, PLAYER_Z)
const TARGET_ENEMY  = new THREE.Vector3(0, 0, ENEMY_Z)

/* ─────────────────────────────────────────────────────────────────
   WATER TILE SHADER
───────────────────────────────────────────────────────────────── */
const TILE_VERT = `
uniform float uTime; uniform float uHover; uniform float uHit; uniform float uMiss;
varying vec2 vUv; varying float vElev;
void main(){
  vUv=uv;
  vec3 p=position;
  p.z+=sin(p.x*3.8+uTime*2.0)*0.05+cos(p.y*3.2+uTime*1.6)*0.04;
  p.z+=uHover*(sin(uTime*7.0)*0.025+0.04);
  vElev=p.z;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`
const TILE_FRAG = `
uniform float uTime; uniform float uHover; uniform float uHit; uniform float uMiss;
varying vec2 vUv; varying float vElev;
void main(){
  vec3 deep=vec3(0.01,0.04,0.14);
  vec3 mid =vec3(0.03,0.13,0.40);
  vec3 foam=vec3(0.45,0.72,1.0);
  float d=length(vUv-0.5)*2.0;
  vec3 col=mix(mid,deep,smoothstep(0.0,0.9,d));
  col=mix(col,foam,smoothstep(0.08,0.22,vElev)*0.4);
  // edge grid line
  float ex=smoothstep(0.47,0.5,abs(vUv.x-0.5)*2.0);
  float ey=smoothstep(0.47,0.5,abs(vUv.y-0.5)*2.0);
  float edge=max(ex,ey);
  vec3 eCol=mix(vec3(0.1,0.3,0.8),vec3(0.85,0.75,0.1),uHover);
  col=mix(col,eCol,edge*(0.18+uHover*0.3));
  // hover
  col=mix(col,vec3(0.9,0.85,0.15),uHover*0.18*(1.0-d));
  // hit fire
  float hf=(1.0-d)*uHit;
  col=mix(col,vec3(1.0,0.22,0.04)*((abs(sin(uTime*20.0))*0.35+0.65)),hf*0.95);
  col+=vec3(1.0,0.45,0.0)*smoothstep(0.6,0.2,d)*uHit*0.4*(sin(uTime*25.0)*0.3+0.7);
  // miss ripple
  float rip=abs(sin(d*16.0-uTime*5.0))*(1.0-d)*uMiss;
  col=mix(col,vec3(0.35,0.65,1.0),rip*0.55);
  gl_FragColor=vec4(col,0.93+uHit*0.07);
}
`

interface TileProps {
  gx: number; gy: number
  wx: number; wz: number
  hit: boolean; miss: boolean
  interactive: boolean
  onClickCell?: (x: number, y: number) => void
}

const WaterTile: React.FC<TileProps> = ({ gx, gy, wx, wz, hit, miss, interactive, onClickCell }) => {
  const matRef  = useRef<THREE.ShaderMaterial>(null)
  const t0      = useRef(Math.random() * 100)
  const [hov, setHov] = useState(false)

  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uHover: { value: 0 },
    uHit:   { value: hit  ? 1 : 0 },
    uMiss:  { value: miss ? 1 : 0 },
  }), [])

  useEffect(() => {
    if (!matRef.current) return
    matRef.current.uniforms.uHit.value  = hit  ? 1 : 0
    matRef.current.uniforms.uMiss.value = miss ? 1 : 0
  }, [hit, miss])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value  = clock.getElapsedTime() + t0.current
    const target = (hov && interactive && !hit && !miss) ? 1 : 0
    matRef.current.uniforms.uHover.value += (target - matRef.current.uniforms.uHover.value) * 0.14
  })

  const canClick = interactive && !hit && !miss
  return (
    <mesh
      position={[wx, 0, wz]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerEnter={() => canClick && setHov(true)}
      onPointerLeave={() => setHov(false)}
      onClick={() => canClick && onClickCell?.(gx, gy)}
    >
      <planeGeometry args={[CELL * 0.93, CELL * 0.93, 20, 20]} />
      <shaderMaterial ref={matRef} transparent uniforms={uniforms}
        vertexShader={TILE_VERT} fragmentShader={TILE_FRAG} />
    </mesh>
  )
}

/* ─────────────────────────────────────────────────────────────────
   OCEAN BACKGROUND
───────────────────────────────────────────────────────────────── */
const OCN_VERT = `uniform float uTime; varying vec2 vUv;
void main(){
  vUv=uv; vec3 p=position;
  p.y+=sin(p.x*1.1+uTime*0.8)*0.18+cos(p.z*0.9+uTime*0.65)*0.14;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`
const OCN_FRAG = `varying vec2 vUv; uniform float uTime;
void main(){
  vec3 c=mix(vec3(0.006,0.02,0.08),vec3(0.012,0.055,0.19),vUv.y);
  float f=pow(max(0.0,sin(vUv.x*55.0+uTime)*sin(vUv.y*50.0+uTime*0.9)),14.0);
  c+=f*0.07;
  gl_FragColor=vec4(c,1.0);
}
`
const Ocean: React.FC<{ cz: number }> = ({ cz }) => {
  const ref = useRef<THREE.ShaderMaterial>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.uniforms.uTime.value = clock.getElapsedTime() })
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.3, cz]}>
      <planeGeometry args={[60, 60, 60, 60]} />
      <shaderMaterial ref={ref} uniforms={{ uTime:{ value:0 } }}
        vertexShader={OCN_VERT} fragmentShader={OCN_FRAG} />
    </mesh>
  )
}

/* ─────────────────────────────────────────────────────────────────
   DETAILED PIRATE SHIP
───────────────────────────────────────────────────────────────── */
interface ShipModelProps {
  wx: number; wz: number
  size: number; horizontal: boolean
  visible: boolean; sunk: boolean
  isPlayer: boolean
}

const PirateShip: React.FC<ShipModelProps> = ({ wx, wz, size, horizontal, visible, sunk, isPlayer }) => {
  const grp = useRef<THREE.Group>(null)
  const t0  = useRef(Math.random() * 100)

  useFrame(({ clock }) => {
    if (!grp.current) return
    const e = clock.getElapsedTime() + t0.current
    if (!sunk) {
      grp.current.position.y = Math.sin(e * 0.6) * 0.09
      grp.current.rotation.z = Math.sin(e * 0.45) * 0.025
      grp.current.rotation.x = Math.cos(e * 0.38) * 0.012
    } else {
      grp.current.position.y = Math.max(grp.current.position.y - 0.006, -1.1)
      grp.current.rotation.z = Math.min(grp.current.rotation.z + 0.003, 0.85)
    }
  })

  if (!visible) return null

  const sc   = 0.30 + size * 0.07
  const L    = 1.1 + size * 0.22          // hull length
  const W    = 0.72
  const H    = 0.44
  const hullClr  = sunk ? '#2a0a0a' : isPlayer ? '#1a2e4a' : '#1f1208'
  const deckClr  = sunk ? '#1a0505' : isPlayer ? '#0e1f35' : '#130e05'
  const sailClr  = sunk ? '#2a1a1a' : isPlayer ? '#d4e8ff' : '#f5f0e8'
  const mastClr  = '#7c4a1a'
  const ropeClr  = '#8b6914'
  const ry = horizontal ? 0 : Math.PI / 2

  // mast count based on size
  const masts = size >= 4 ? 3 : size >= 3 ? 2 : 1
  const mastH = 1.4 + size * 0.15

  return (
    <group ref={grp} position={[wx, 0.05, wz]} rotation={[0, ry, 0]} scale={[sc,sc,sc]}>

      {/* ── Main Hull ── */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial color={hullClr} roughness={0.75} metalness={0.15} />
      </mesh>

      {/* Hull planks overlay */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={`plank${i}`} position={[0, -H/2 + 0.045 + i * 0.09, 0]}>
          <boxGeometry args={[L * 0.98, 0.035, W + 0.01]} />
          <meshStandardMaterial color={sunk ? '#1a0808' : isPlayer ? '#152540' : '#180f04'}
            roughness={0.9} metalness={0.05} />
        </mesh>
      ))}

      {/* Bow (pointed front) */}
      <mesh castShadow position={[L/2 + 0.18, 0, 0]}>
        <cylinderGeometry args={[0, W/2, 0.55, 5, 1]} />
        <meshStandardMaterial color={hullClr} roughness={0.75} />
      </mesh>

      {/* Stern raised deck */}
      <mesh castShadow position={[-L/2 + 0.28, H/2 + 0.1, 0]}>
        <boxGeometry args={[0.52, 0.22, W * 0.85]} />
        <meshStandardMaterial color={deckClr} roughness={0.7} />
      </mesh>

      {/* Stern ornament */}
      <mesh position={[-L/2 - 0.05, 0.1, 0]}>
        <boxGeometry args={[0.08, 0.5, W * 0.7]} />
        <meshStandardMaterial color={sunk ? '#2a0a0a' : '#8B4513'} roughness={0.8} />
      </mesh>

      {/* Main deck */}
      <mesh castShadow position={[0, H/2 + 0.02, 0]}>
        <boxGeometry args={[L - 0.1, 0.06, W - 0.1]} />
        <meshStandardMaterial color={deckClr} roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Deck railing posts */}
      {Array.from({ length: Math.floor(L / 0.22) }, (_, i) => {
        const px = -L/2 + 0.15 + i * 0.22
        return (
          <group key={`rail${i}`}>
            <mesh position={[px, H/2 + 0.1, W/2 - 0.04]}>
              <cylinderGeometry args={[0.025, 0.025, 0.16, 4]} />
              <meshStandardMaterial color={mastClr} roughness={0.9} />
            </mesh>
            <mesh position={[px, H/2 + 0.1, -W/2 + 0.04]}>
              <cylinderGeometry args={[0.025, 0.025, 0.16, 4]} />
              <meshStandardMaterial color={mastClr} roughness={0.9} />
            </mesh>
          </group>
        )
      })}

      {/* Railing horizontal bars */}
      <mesh position={[0, H/2 + 0.17, W/2 - 0.04]}>
        <boxGeometry args={[L - 0.15, 0.03, 0.03]} />
        <meshStandardMaterial color={mastClr} roughness={0.9} />
      </mesh>
      <mesh position={[0, H/2 + 0.17, -W/2 + 0.04]}>
        <boxGeometry args={[L - 0.15, 0.03, 0.03]} />
        <meshStandardMaterial color={mastClr} roughness={0.9} />
      </mesh>

      {/* Masts */}
      {Array.from({ length: masts }, (_, mi) => {
        const mstX = masts === 1 ? 0
          : masts === 2 ? [-0.18, 0.35][mi]
          : [-0.38, 0.12, 0.52][mi]
        const mh = mi === 0 ? mastH : mastH * (0.85 - mi * 0.08)
        const sw = 0.55 - mi * 0.08
        const sh = mh * 0.6
        return (
          <group key={`mast${mi}`}>
            {/* Mast pole */}
            <mesh castShadow position={[mstX, H/2 + mh/2 + 0.04, 0]}>
              <cylinderGeometry args={[0.038 - mi*0.005, 0.048 - mi*0.005, mh, 8]} />
              <meshStandardMaterial color={mastClr} roughness={0.85} metalness={0.1} />
            </mesh>

            {/* Crow's nest on main mast */}
            {mi === 0 && (
              <mesh position={[mstX, H/2 + mh * 0.75, 0]}>
                <cylinderGeometry args={[0.12, 0.09, 0.12, 8]} />
                <meshStandardMaterial color={deckClr} roughness={0.8} />
              </mesh>
            )}

            {/* Yardarm (horizontal spar) */}
            <mesh position={[mstX, H/2 + mh * 0.82, 0]}>
              <cylinderGeometry args={[0.018, 0.018, sw * 1.8, 6]} rotation={[0,0,Math.PI/2]} />
              <meshStandardMaterial color={mastClr} roughness={0.9} />
            </mesh>

            {/* Sail (billowed) */}
            <mesh position={[mstX, H/2 + mh * 0.55, 0.025]}>
              <planeGeometry args={[sw * 1.6, sh, 8, 8]} />
              <meshStandardMaterial color={sailClr} side={THREE.DoubleSide}
                roughness={0.85} transparent opacity={sunk ? 0.3 : 0.96} />
            </mesh>

            {/* Sail shadow/depth */}
            <mesh position={[mstX, H/2 + mh * 0.55, -0.01]}>
              <planeGeometry args={[sw * 1.5, sh * 0.92, 4, 4]} />
              <meshStandardMaterial color={isPlayer ? '#c8dcf0' : '#e8dcc8'}
                side={THREE.DoubleSide} roughness={0.9}
                transparent opacity={sunk ? 0.2 : 0.3} />
            </mesh>

            {/* Rigging ropes */}
            <mesh position={[mstX + (L*0.3), H/2 + mh * 0.45, 0.02]}>
              <cylinderGeometry args={[0.008, 0.008,
                Math.sqrt(Math.pow(L*0.3,2) + Math.pow(mh*0.45,2)), 4]}
              />
              <meshStandardMaterial color={ropeClr} roughness={1} />
            </mesh>
          </group>
        )
      })}

      {/* Pirate flag (skull & crossbones colors) */}
      <mesh position={[0, H/2 + mastH + 0.14, 0.01]}>
        <planeGeometry args={[0.28, 0.18]} />
        <meshStandardMaterial color={sunk ? '#1a0000' : '#050510'}
          side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      {/* Flag highlight */}
      <mesh position={[0.05, H/2 + mastH + 0.14, 0.02]}>
        <planeGeometry args={[0.1, 0.07]} />
        <meshStandardMaterial color={sunk ? '#440000' : '#fffff0'}
          side={THREE.DoubleSide} roughness={0.9} transparent opacity={0.7} />
      </mesh>

      {/* Cannons (port side) */}
      {Array.from({ length: Math.min(size, 4) }, (_, i) => (
        <group key={`cannon${i}`}>
          <mesh castShadow position={[
            -L/2 + 0.3 + i * (L / (Math.min(size,4) + 1)),
            0, W/2 + 0.06
          ]}>
            <cylinderGeometry args={[0.05, 0.06, 0.28, 8]}
              ref={el => { if (el) el.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2)) }}
            />
            <meshStandardMaterial color="#2d3748" roughness={0.6} metalness={0.55} />
          </mesh>
          {/* Cannon wheel */}
          <mesh position={[
            -L/2 + 0.3 + i * (L / (Math.min(size,4) + 1)),
            -0.08, W/2 + 0.06
          ]}>
            <torusGeometry args={[0.07, 0.015, 4, 12]} />
            <meshStandardMaterial color="#8B6914" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Lantern at bow */}
      <pointLight
        position={[L/2 + 0.1, H/2 + 0.3, 0]}
        intensity={sunk ? 0 : 0.6}
        color={isPlayer ? '#4a8fff' : '#ffa040'}
        distance={2.5}
        decay={2}
      />

      {/* Fire glow when sunk */}
      {sunk && (
        <pointLight position={[0, 0.5, 0]} intensity={2}
          color="#ff4400" distance={3} decay={2} />
      )}
    </group>
  )
}

/* ─────────────────────────────────────────────────────────────────
   HIT / MISS VFX rings
───────────────────────────────────────────────────────────────── */
const HitRing: React.FC<{ wx: number; wz: number }> = ({ wx, wz }) => {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.z = clock.getElapsedTime() * 2
    ref.current.scale.setScalar(0.8 + Math.sin(clock.getElapsedTime()*5)*0.1)
  })
  return (
    <mesh ref={ref} position={[wx, 0.1, wz]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[0.28, 0.4, 32]} />
      <meshBasicMaterial color="#ff2200" transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>
  )
}
const MissRing: React.FC<{ wx: number; wz: number }> = ({ wx, wz }) => {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 0.55 + Math.sin(clock.getElapsedTime()*2.2)*0.07
    ref.current.scale.setScalar(s)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.4 + Math.sin(clock.getElapsedTime()*1.8)*0.15
  })
  return (
    <mesh ref={ref} position={[wx, 0.07, wz]} rotation={[-Math.PI/2,0,0]}>
      <ringGeometry args={[0.1, 0.2, 20]} />
      <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ─────────────────────────────────────────────────────────────────
   BOARD (player or enemy)
───────────────────────────────────────────────────────────────── */
interface BoardProps {
  board: Board
  ships: Ship[]
  boardZ: number
  isPlayer: boolean
  interactive: boolean
  showShips: boolean      // player=always, enemy=only hit ships
  onClickCell?: (x: number, y: number) => void
}

const Board3D: React.FC<BoardProps> = ({
  board, ships, boardZ, isPlayer, interactive, showShips, onClickCell
}) => {
  const hitShipIds  = new Set<number>()
  const sunkShipIds = new Set<number>()
  board.forEach(row => row.forEach(c => {
    if (c.hit && c.shipId !== null) hitShipIds.add(c.shipId)
  }))
  ships.forEach(s => { if (s.hits >= s.size) sunkShipIds.add(s.id) })

  return (
    <group position={[0, 0, boardZ]}>
      {/* Board tiles */}
      {board.map((row, y) => row.map((cell, x) => {
        const wx = OFF + x * CELL
        const wz = OFF + y * CELL
        return (
          <WaterTile key={`${x}-${y}`}
            gx={x} gy={y} wx={wx} wz={wz}
            hit={cell.hit} miss={cell.miss}
            interactive={interactive}
            onClickCell={onClickCell}
          />
        )
      }))}

      {/* VFX */}
      {board.map((row, y) => row.map((cell, x) => {
        const wx = OFF + x * CELL
        const wz = OFF + y * CELL
        if (cell.hit)  return <HitRing  key={`h${x}-${y}`} wx={wx} wz={wz} />
        if (cell.miss) return <MissRing key={`m${x}-${y}`} wx={wx} wz={wz} />
        return null
      }))}

      {/* Ships */}
      {ships.map(ship => {
        const cx = ship.x + (ship.horizontal ? (ship.size - 1) / 2 : 0)
        const cy = ship.y + (!ship.horizontal ? (ship.size - 1) / 2 : 0)
        const wx = OFF + cx * CELL
        const wz = OFF + cy * CELL
        const vis = showShips ? true : hitShipIds.has(ship.id)
        const sunk = sunkShipIds.has(ship.id)
        return (
          <PirateShip key={ship.id}
            wx={wx} wz={wz}
            size={ship.size} horizontal={ship.horizontal}
            visible={vis} sunk={sunk}
            isPlayer={isPlayer}
          />
        )
      })}

      {/* Board label plane */}
      <mesh position={[0, -0.05, -BOARD/2 - 0.8]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[BOARD, 0.6]} />
        <meshBasicMaterial color={isPlayer ? '#0a2040' : '#200a00'}
          transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

/* ─────────────────────────────────────────────────────────────────
   ANIMATED CAMERA RIG
───────────────────────────────────────────────────────────────── */
const CameraRig: React.FC<{ targetEnemy: boolean }> = ({ targetEnemy }) => {
  const { camera } = useThree()
  const progress = useRef(targetEnemy ? 1 : 0)
  const prevTarget = useRef(targetEnemy)

  useFrame(({ clock }) => {
    const goal = targetEnemy ? 1 : 0
    progress.current += (goal - progress.current) * 0.045

    const t = progress.current
    // lerp camera position
    camera.position.lerpVectors(CAM_PLAYER, CAM_ENEMY, t)
    // lerp look-at target
    const lookAt = new THREE.Vector3().lerpVectors(TARGET_PLAYER, TARGET_ENEMY, t)
    camera.lookAt(lookAt)

    // gentle sway
    const e = clock.getElapsedTime()
    camera.position.x += Math.sin(e * 0.07) * 0.8
    camera.position.y += Math.sin(e * 0.09) * 0.25
  })
  return null
}

/* ─────────────────────────────────────────────────────────────────
   PARTICLES
───────────────────────────────────────────────────────────────── */
const Particles: React.FC = () => {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 250
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i*3]   = (Math.random()-0.5)*40
      pos[i*3+1] = Math.random()*3 + 0.1
      pos[i*3+2] = Math.random()*(ENEMY_Z+BOARD) - 5
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const matRef = useRef<THREE.PointsMaterial>(null)
  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.opacity = 0.15 + Math.sin(clock.getElapsedTime()*0.35)*0.05
  })
  return (
    <points geometry={geom}>
      <pointsMaterial ref={matRef} color="#bfdbfe" size={0.055}
        transparent opacity={0.18} sizeAttenuation />
    </points>
  )
}

/* ─────────────────────────────────────────────────────────────────
   INNER SCENE
───────────────────────────────────────────────────────────────── */
interface InnerProps {
  playerBoard: Board; playerShips: Ship[]
  aiBoard: Board; aiShips: Ship[]
  playerTurn: boolean; gameOver: boolean
  onCellClick: (x: number, y: number) => void
}

const InnerScene: React.FC<InnerProps> = ({
  playerBoard, playerShips, aiBoard, aiShips,
  playerTurn, gameOver, onCellClick
}) => {
  const { gl } = useThree()
  useEffect(() => {
    gl.domElement.style.cursor = (playerTurn && !gameOver) ? 'crosshair' : 'default'
  }, [playerTurn, gameOver, gl])

  return (
    <>
      <color attach="background" args={['#020817']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6,16,8]}  intensity={1.2} color="#d0e8ff" castShadow />
      <directionalLight position={[-4,8,-6]} intensity={0.4} color="#0a2060" />
      <pointLight position={[0,8,ENEMY_Z/2]} intensity={0.3} color="#1e3a8a" />
      <fogExp2 attach="fog" color="#020817" density={0.022} />

      <Ocean cz={PLAYER_Z} />
      <Ocean cz={ENEMY_Z} />
      <Particles />
      <CameraRig targetEnemy={playerTurn && !gameOver} />

      {/* PLAYER BOARD */}
      <Board3D
        board={playerBoard} ships={playerShips}
        boardZ={PLAYER_Z} isPlayer={true}
        interactive={false} showShips={true}
      />

      {/* ENEMY BOARD */}
      <Board3D
        board={aiBoard} ships={aiShips}
        boardZ={ENEMY_Z} isPlayer={false}
        interactive={playerTurn && !gameOver} showShips={false}
        onClickCell={onCellClick}
      />
    </>
  )
}

/* ─────────────────────────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────────────────────────── */
export interface ArenaProps {
  playerBoard: Board; playerShips: Ship[]
  aiBoard: Board; aiShips: Ship[]
  playerTurn: boolean; gameOver: boolean
  onCellClick: (x: number, y: number) => void
}

export const Arena: React.FC<ArenaProps> = (props) => (
  <Canvas
    shadows
    camera={{ position: [...CAM_PLAYER.toArray()], fov: 52, near: 0.1, far: 300 }}
    gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    style={{ width: '100%', height: '100%', display: 'block' }}
  >
    <InnerScene {...props} />
  </Canvas>
)

import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Sky } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import type { Board, Ship } from '../game/types'
import { OceanPlane, HullFoam } from './Water'
import { FireParticles, MissSplash, SinkVFX } from './VFX'
import { PirateShip } from './Ships'

/* ─── CONSTANTS ─── */
const CELL     = 1.1
const BOARD    = 10 * CELL
const OFF      = -BOARD / 2 + CELL / 2
const PLAYER_Z = 0
const ENEMY_Z  = BOARD + 12

/* ─── ANIMATED GRID OVERLAY ─── */
interface GridOverlayProps { boardZ: number; isPlayer: boolean }
const GridOverlay: React.FC<GridOverlayProps> = React.memo(({ boardZ, isPlayer }) => {
  const linesRef = useRef<THREE.LineSegments>(null)

  const { geo, basePositions } = useMemo(() => {
    const pts: number[] = []
    const n = 10
    const half = (n * CELL) / 2
    for (let i = 0; i <= n; i++) {
      const x = -half + i * CELL
      pts.push(x, 0, -half, x, 0, half)
    }
    for (let i = 0; i <= n; i++) {
      const z = -half + i * CELL
      pts.push(-half, 0, z, half, 0, z)
    }
    const base = new Float32Array(pts)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3))
    return { geo: g, basePositions: base }
  }, [])

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color: isPlayer ? '#3a7fff' : '#ffaa22',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }), [isPlayer])

  useFrame(({ clock }) => {
    if (!linesRef.current) return
    const t = clock.getElapsedTime()
    const pos = linesRef.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    for (let i = 0; i < arr.length / 3; i++) {
      const x = basePositions[i * 3]
      const z = basePositions[i * 3 + 2]
      arr[i * 3 + 1] =
        Math.sin(x * 0.90 + t * 0.70) * 0.055 +
        Math.cos(z * 0.80 + t * 0.55) * 0.045 +
        Math.sin((x + z) * 1.50 + t * 1.00) * 0.018 - 0.30
    }
    pos.needsUpdate = true
  })

  return (
    <lineSegments ref={linesRef} geometry={geo} material={mat}
      position={[0, 0, boardZ]} />
  )
})

/* ─── HIT ZONE ─── */
interface HitZoneProps {
  gx: number; gy: number; wx: number; wz: number
  hit: boolean; miss: boolean
  interactive: boolean
  onClickCell?: (x: number, y: number) => void
}
const HitZone: React.FC<HitZoneProps> = React.memo(({ gx, gy, wx, wz, hit, miss, interactive, onClickCell }) => {
  const [hov, setHov] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const canClick = interactive && !hit && !miss

  useFrame(() => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    const target = hov && canClick ? 0.30 : 0
    mat.opacity += (target - mat.opacity) * 0.14
  })

  return (
    <mesh ref={meshRef} position={[wx, 0.04, wz]} rotation={[-Math.PI / 2, 0, 0]}
      onPointerEnter={() => canClick && setHov(true)}
      onPointerLeave={() => setHov(false)}
      onClick={() => canClick && onClickCell?.(gx, gy)}>
      <planeGeometry args={[CELL * 0.92, CELL * 0.92]} />
      <meshBasicMaterial color='#facc15' transparent opacity={0} depthWrite={false} />
    </mesh>
  )
})

/* ─── HIT RING ─── */
const HitRing: React.FC<{ wx: number; wz: number }> = React.memo(({ wx, wz }) => {
  const r1 = useRef<THREE.Mesh>(null)
  const r2 = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (r1.current) { r1.current.rotation.z = t * 2.2; r1.current.scale.setScalar(0.85 + Math.sin(t * 6) * 0.12) }
    if (r2.current) { r2.current.rotation.z = -t * 1.5; r2.current.scale.setScalar(0.7 + Math.sin(t * 4 + 1) * 0.10) }
  })
  return (
    <group position={[wx, 0.12, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={r1}><ringGeometry args={[0.30, 0.44, 32]} /><meshBasicMaterial color="#ff2200" transparent opacity={0.88} side={THREE.DoubleSide} /></mesh>
      <mesh ref={r2}><ringGeometry args={[0.18, 0.28, 24]} /><meshBasicMaterial color="#ff8800" transparent opacity={0.7} side={THREE.DoubleSide} /></mesh>
    </group>
  )
})

/* ─── BOARD ─── */
interface BoardProps {
  board: Board; ships: Ship[]; boardZ: number
  isPlayer: boolean; interactive: boolean
  onClickCell?: (x: number, y: number) => void
}
const Board3D: React.FC<BoardProps> = React.memo(({ board, ships, boardZ, isPlayer, interactive, onClickCell }) => {
  const sunkIds = useMemo(() => {
    const s = new Set<number>()
    ships.forEach(ship => { if (ship.hits >= ship.size) s.add(ship.id) })
    return s
  }, [ships])

  return (
    <group position={[0, 0, boardZ]}>
      <GridOverlay boardZ={0} isPlayer={isPlayer} />

      {board.map((row, y) => row.map((cell, x) => {
        const wx = OFF + x * CELL; const wz = OFF + y * CELL
        return (
          <HitZone key={`hz${x}-${y}`}
            gx={x} gy={y} wx={wx} wz={wz}
            hit={cell.hit} miss={cell.miss}
            interactive={interactive} onClickCell={onClickCell} />
        )
      }))}

      {board.map((row, y) => row.map((cell, x) => {
        const wx = OFF + x * CELL; const wz = OFF + y * CELL
        if (cell.hit) return (
          <group key={`h${x}-${y}`}>
            <HitRing wx={wx} wz={wz} />
            <FireParticles position={[wx, 0.15, wz]} active={true} />
          </group>
        )
        if (cell.miss) return <MissSplash key={`m${x}-${y}`} position={[wx, 0.05, wz]} />
        return null
      }))}

      {ships.map(ship => {
        const cx = ship.x + (ship.horizontal ? (ship.size - 1) / 2 : 0)
        const cy = ship.y + (!ship.horizontal ? (ship.size - 1) / 2 : 0)
        const wx = OFF + cx * CELL; const wz = OFF + cy * CELL
        return (
          <PirateShip key={ship.id}
            wx={wx} wz={wz} size={ship.size} horizontal={ship.horizontal}
            visible={isPlayer || sunkIds.has(ship.id)}
            sunk={sunkIds.has(ship.id)} isPlayer={isPlayer} />
        )
      })}
    </group>
  )
})

/* ─── PARTICLES ─── */
const Particles: React.FC = React.memo(() => {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = 300
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 50
      pos[i * 3 + 1] = Math.random() * 4 + 0.1
      pos[i * 3 + 2] = Math.random() * (ENEMY_Z + BOARD + 6) - 6
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const mat = useRef<THREE.PointsMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.12 + Math.sin(clock.getElapsedTime() * 0.3) * 0.05
  })
  return (
    <points geometry={geom}>
      <pointsMaterial ref={mat} color="#bfdbfe" size={0.06} transparent opacity={0.15} sizeAttenuation />
    </points>
  )
})

/* ─── CAMERA CONTROLLER ─── */
const CameraController: React.FC<{ targetEnemy: boolean }> = ({ targetEnemy }) => {
  const { camera } = useThree()
  const orbitRef   = useRef<any>(null)
  const animating  = useRef(false)
  const animT      = useRef(0)
  const fromPos    = useRef(new THREE.Vector3())
  const toPos      = useRef(new THREE.Vector3())
  const fromTgt    = useRef(new THREE.Vector3())
  const toTgt      = useRef(new THREE.Vector3())
  const prevTurn   = useRef<boolean | null>(null)

  const getPreset = (enemy: boolean) => ({
    pos: new THREE.Vector3(0, 10, (enemy ? ENEMY_Z : PLAYER_Z) + 11),
    tgt: new THREE.Vector3(0, 0, enemy ? ENEMY_Z : PLAYER_Z),
  })

  useEffect(() => {
    const p = getPreset(targetEnemy)
    camera.position.copy(p.pos)
    if (orbitRef.current) { orbitRef.current.target.copy(p.tgt); orbitRef.current.update() }
  }, [])

  useEffect(() => {
    if (prevTurn.current === null) { prevTurn.current = targetEnemy; return }
    if (prevTurn.current === targetEnemy) return
    prevTurn.current = targetEnemy
    const p = getPreset(targetEnemy)
    fromPos.current.copy(camera.position)
    toPos.current.copy(p.pos)
    fromTgt.current.copy(orbitRef.current?.target ?? new THREE.Vector3(0, 0, targetEnemy ? ENEMY_Z : PLAYER_Z))
    toTgt.current.copy(p.tgt)
    animating.current = true
    animT.current = 0
  }, [targetEnemy])

  useFrame((_, delta) => {
    if (!animating.current || !orbitRef.current) return
    animT.current = Math.min(animT.current + delta * 1.1, 1)
    const t = 1 - Math.pow(1 - animT.current, 3)
    camera.position.lerpVectors(fromPos.current, toPos.current, t)
    orbitRef.current.target.lerpVectors(fromTgt.current, toTgt.current, t)
    orbitRef.current.update()
    if (animT.current >= 1) animating.current = false
  })

  return (
    <OrbitControls ref={orbitRef} enableDamping dampingFactor={0.08}
      minDistance={3} maxDistance={35} maxPolarAngle={Math.PI / 2.1}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />
  )
}

/* ─── NIGHT SKY ───
   Настройки Sky дают горизонт под луной — низкое солнце = тёмная ночная атмосфера */
const NightSky: React.FC = React.memo(() => (
  <>
    {/* Drei Sky: горизонт с сине-фиолетовым оттенком, солнце за горизонтом */}
    <Sky
      distance={4500}
      sunPosition={[0, -0.08, -1]}
      inclination={0}
      azimuth={0.25}
      mieCoefficient={0.005}
      mieDirectionalG={0.8}
      rayleigh={0.5}
      turbidity={8}
    />
    {/* Звёзды поверх */}
    <Stars radius={120} depth={60} count={5000} factor={5} saturation={0.3} fade speed={0.4} />
    {/* HDR environment — ночной пресет, даёт PBR-отражения на всех MeshStandard/Physical материалах */}
    <Environment
      preset="night"
      background={false}      // фон задаёт Sky, а не Environment
      environmentIntensity={0.6}
    />
  </>
))

/* ─── INNER SCENE ─── */
interface InnerProps {
  playerBoard: Board; playerShips: Ship[]
  aiBoard: Board; aiShips: Ship[]
  playerTurn: boolean; gameOver: boolean
  onCellClick: (x: number, y: number) => void
}
const InnerScene: React.FC<InnerProps> = ({
  playerBoard, playerShips, aiBoard, aiShips, playerTurn, gameOver, onCellClick
}) => {
  const { gl } = useThree()

  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // physicallyCorrectLights — реалистичное затухание света с расстоянием
    // @ts-ignore — deprecated в r152+, но всё ещё работает до Three 0.170
    gl.physicallyCorrectLights = true

    const onLost = (e: Event) => { e.preventDefault(); console.warn('WebGL context lost') }
    const onRestored = () => console.info('WebGL context restored')
    gl.domElement.addEventListener('webglcontextlost', onLost)
    gl.domElement.addEventListener('webglcontextrestored', onRestored)
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', onLost)
      gl.domElement.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [])

  useEffect(() => {
    gl.domElement.style.cursor = (playerTurn && !gameOver) ? 'crosshair' : 'default'
  }, [playerTurn, gameOver, gl])

  return (
    <>
      <color attach="background" args={['#010812']} />
      <fogExp2 attach="fog" color="#010c20" density={0.022} />

      {/* ─── LIGHTING ───
          Основной свет — Environment (HDR).
          Оставляем минимум искусственных огней только для фонарей кораблей. */}
      <ambientLight intensity={0.06} />

      {/* Луна — дирекционный свет сверху */}
      <directionalLight
        position={[15, 30, 10]}
        intensity={1.8}
        color="#c8d8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0004}
      />

      {/* Цветные акценты для двух полей */}
      <pointLight position={[0, 6, PLAYER_Z]} intensity={8} color="#3a6fff" distance={18} decay={2} />
      <pointLight position={[0, 6, ENEMY_Z]}  intensity={8} color="#ff7733" distance={18} decay={2} />

      <NightSky />

      <OceanPlane centerZ={PLAYER_Z} />
      <OceanPlane centerZ={ENEMY_Z} />

      <Particles />
      <CameraController targetEnemy={playerTurn && !gameOver} />

      <Board3D board={playerBoard} ships={playerShips}
        boardZ={PLAYER_Z} isPlayer={true} interactive={false} />
      <Board3D board={aiBoard} ships={aiShips}
        boardZ={ENEMY_Z} isPlayer={false}
        interactive={playerTurn && !gameOver}
        onClickCell={onCellClick} />

      <EffectComposer multisampling={4}>
        <Bloom
          intensity={1.6}
          luminanceThreshold={0.22}
          luminanceSmoothing={0.85}
          kernelSize={KernelSize.LARGE}
          mipmapBlur
        />
        <Vignette offset={0.40} darkness={0.68} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </>
  )
}

/* ─── EXPORT ─── */
export interface ArenaProps {
  playerBoard: Board; playerShips: Ship[]
  aiBoard: Board; aiShips: Ship[]
  playerTurn: boolean; gameOver: boolean
  onCellClick: (x: number, y: number) => void
}
export const Arena: React.FC<ArenaProps> = (props) => (
  <Canvas
    shadows
    camera={{ position: [0, 10, 11], fov: 56, near: 0.1, far: 500 }}
    gl={{
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 0.9,
    }}
    dpr={[1, 2]}
    style={{ width: '100%', height: '100%', display: 'block' }}
  >
    <InnerScene {...props} />
  </Canvas>
)

import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Board, Ship } from '../game/types'

/* === Water Shader === */
const VERTEX_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float wave1  = sin(pos.x * 2.0  + uTime * 1.6) * 0.12;
    float wave2  = cos(pos.z * 1.8  + uTime * 1.2) * 0.09;
    float ripple = sin((pos.x + pos.z) * 3.5 + uTime * 2.8) * 0.045;
    float foam   = sin(pos.x * 5.0  + uTime * 3.0) * 0.02;
    pos.y += wave1 + wave2 + ripple + foam;

    vElevation = pos.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying float vElevation;

  uniform vec3 uColorDeep;
  uniform vec3 uColorShallow;
  uniform vec3 uColorFoam;
  uniform float uTime;

  void main() {
    float mix1    = smoothstep(-0.12, 0.16, vElevation);
    vec3  color   = mix(uColorDeep, uColorShallow, mix1);
    float foam    = smoothstep(0.12, 0.24, vElevation);
    color         = mix(color, uColorFoam, foam * 0.55);

    float sparkle = pow(max(0.0, sin(vUv.x * 42.0 + uTime) * sin(vUv.y * 38.0 + uTime * 0.7)), 8.0);
    color += sparkle * 0.14;

    gl_FragColor = vec4(color, 0.92);
  }
`

const WaterPlane: React.FC = () => {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[26, 26, 200, 200]} />
      <shaderMaterial
        ref={matRef}
        transparent
        uniforms={{
          uTime:        { value: 0 },
          uColorDeep:   { value: new THREE.Color('#020617') },
          uColorShallow:{ value: new THREE.Color('#1d4ed8') },
          uColorFoam:   { value: new THREE.Color('#bfdbfe') },
        }}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  )
}

/* === Procedural pirate ship model === */
interface ShipMeshProps {
  x: number
  z: number
  sunk: boolean
  horizontal: boolean
  size: number
}

const ShipMesh: React.FC<ShipMeshProps> = ({ x, z, sunk, horizontal, size }) => {
  const groupRef = useRef<THREE.Group>(null)
  const t = useRef(Math.random() * 100)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const elapsed = clock.getElapsedTime()
    if (!sunk) {
      groupRef.current.position.y = Math.sin(elapsed * 0.8 + t.current) * 0.06
      groupRef.current.rotation.z = Math.sin(elapsed * 0.6 + t.current) * 0.025
      groupRef.current.rotation.x = Math.cos(elapsed * 0.5 + t.current) * 0.015
    } else {
      const sinkProgress = Math.min((clock.getElapsedTime() - t.current) * 0.3, 1)
      groupRef.current.position.y = -sinkProgress * 0.5
      groupRef.current.rotation.z = sinkProgress * 0.6
    }
  })

  const scale = 0.35 + size * 0.05
  const hullColor  = sunk ? '#7f1d1d' : '#1e293b'
  const deckColor  = sunk ? '#450a0a' : '#0f172a'
  const sailColor  = '#f5f5f4'
  const ropeColor  = '#d97706'
  const mast1H = size >= 4 ? 1.1 : size >= 3 ? 0.95 : 0.75
  const hasSail2  = size >= 3
  const hasSail3  = size >= 4
  const rotY = horizontal ? 0 : Math.PI / 2

  return (
    <group ref={groupRef} position={[x, 0, z]} rotation={[0, rotY, 0]} scale={[scale, scale, scale]}>
      {/* Hull */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 0.38, 0.85]} />
        <meshStandardMaterial color={hullColor} roughness={0.85} metalness={0.12} />
      </mesh>
      {/* Hull nose */}
      <mesh castShadow position={[1.22, 0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0, 0.43, 0.56, 4, 1]} />
        <meshStandardMaterial color={hullColor} roughness={0.85} />
      </mesh>
      {/* Deck */}
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[2.0, 0.1, 0.72]} />
        <meshStandardMaterial color={deckColor} roughness={0.7} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[-0.7, 0.44, 0]}>
        <boxGeometry args={[0.55, 0.45, 0.62]} />
        <meshStandardMaterial color={deckColor} roughness={0.65} metalness={0.1} />
      </mesh>
      {/* Mast 1 */}
      <mesh castShadow position={[0.2, 0.2 + mast1H / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, mast1H, 6]} />
        <meshStandardMaterial color={ropeColor} roughness={0.9} />
      </mesh>
      {/* Sail 1 */}
      <mesh position={[0.2, 0.2 + mast1H * 0.6, 0.01]}>
        <planeGeometry args={[0.55, mast1H * 0.55]} />
        <meshStandardMaterial color={sailColor} side={THREE.DoubleSide} roughness={0.8} transparent opacity={sunk ? 0.4 : 0.95} />
      </mesh>
      {/* Mast 2 */}
      {hasSail2 && (
        <>
          <mesh castShadow position={[-0.2, 0.2 + (mast1H - 0.1) / 2, 0]}>
            <cylinderGeometry args={[0.035, 0.045, mast1H - 0.1, 6]} />
            <meshStandardMaterial color={ropeColor} roughness={0.9} />
          </mesh>
          <mesh position={[-0.2, 0.2 + (mast1H - 0.1) * 0.55, 0.01]}>
            <planeGeometry args={[0.45, (mast1H - 0.1) * 0.5]} />
            <meshStandardMaterial color={sailColor} side={THREE.DoubleSide} roughness={0.8} transparent opacity={sunk ? 0.3 : 0.9} />
          </mesh>
        </>
      )}
      {/* Mast 3 */}
      {hasSail3 && (
        <>
          <mesh castShadow position={[0.65, 0.2 + (mast1H - 0.2) / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.04, mast1H - 0.2, 6]} />
            <meshStandardMaterial color={ropeColor} roughness={0.9} />
          </mesh>
          <mesh position={[0.65, 0.2 + (mast1H - 0.2) * 0.52, 0.01]}>
            <planeGeometry args={[0.4, (mast1H - 0.2) * 0.46]} />
            <meshStandardMaterial color={sailColor} side={THREE.DoubleSide} roughness={0.8} transparent opacity={sunk ? 0.25 : 0.88} />
          </mesh>
        </>
      )}
      {/* Pirate flag */}
      <mesh position={[0.2, 0.2 + mast1H + 0.08, 0.01]}>
        <planeGeometry args={[0.22, 0.16]} />
        <meshStandardMaterial color={sunk ? '#450a0a' : '#020617'} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      {/* Cannon ports */}
      {[0.3, -0.1, -0.5].slice(0, Math.max(1, size - 1)).map((px, i) => (
        <mesh key={i} castShadow position={[px, 0.07, 0.44]}>
          <cylinderGeometry args={[0.045, 0.04, 0.22, 6]} />
          <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/* === Explosion effect === */
const Explosion: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const startTime = useRef<number>(0)
  const started = useRef(false)

  useFrame(({ clock }) => {
    if (!started.current) {
      startTime.current = clock.getElapsedTime()
      started.current = true
    }
    if (!meshRef.current) return
    const t = (clock.getElapsedTime() - startTime.current)
    const s = Math.min(t * 2.5, 1.2)
    meshRef.current.scale.setScalar(s)
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.opacity = Math.max(0, 1 - t * 1.5)
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.35, 10, 10]} />
      <meshStandardMaterial
        color="#f97316"
        emissive="#fef3c7"
        emissiveIntensity={2.5}
        transparent
        opacity={1}
        roughness={0.5}
      />
    </mesh>
  )
}

/* === Main scene === */
interface SeaSceneProps {
  playerShips: Ship[]
  aiShips: Ship[]
  playerBoard: Board
  aiBoard: Board
}

const CELL = 1.05
const OFFSET = -(10 * CELL) / 2 + CELL / 2

function shipWorldPos(ship: Ship, boardOffsetX: number) {
  const cx = ship.x + (ship.horizontal ? (ship.size - 1) / 2 : 0)
  const cy = ship.y + (!ship.horizontal ? (ship.size - 1) / 2 : 0)
  return {
    wx: OFFSET + cx * CELL + boardOffsetX,
    wz: OFFSET + cy * CELL,
  }
}

const Scene: React.FC<SeaSceneProps> = ({ playerShips, aiShips, playerBoard, aiBoard }) => {
  const playerBoardX = -6.5
  const aiBoardX    =  6.5

  const hitExplosions: { x: number; z: number; key: string }[] = []
  aiBoard.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell.hit) {
        hitExplosions.push({
          x: OFFSET + x * CELL + aiBoardX,
          z: OFFSET + y * CELL,
          key: `ai-${x}-${y}`,
        })
      }
    })
  )
  playerBoard.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell.hit) {
        hitExplosions.push({
          x: OFFSET + x * CELL + playerBoardX,
          z: OFFSET + y * CELL,
          key: `pl-${x}-${y}`,
        })
      }
    })
  )

  return (
    <>
      <color attach="background" args={['#020617']} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 16, 6]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 4, 0]} intensity={0.4} color="#bfdbfe" />

      <WaterPlane />

      {playerShips.map(ship => {
        const { wx, wz } = shipWorldPos(ship, playerBoardX)
        return (
          <ShipMesh
            key={ship.id}
            x={wx}
            z={wz}
            sunk={ship.hits >= ship.size}
            horizontal={ship.horizontal}
            size={ship.size}
          />
        )
      })}

      {aiShips.map(ship => {
        const { wx, wz } = shipWorldPos(ship, aiBoardX)
        return (
          <ShipMesh
            key={ship.id}
            x={wx}
            z={wz}
            sunk={ship.hits >= ship.size}
            horizontal={ship.horizontal}
            size={ship.size}
          />
        )
      })}

      {hitExplosions.map(e => (
        <Explosion key={e.key} position={[e.x, 0.3, e.z]} />
      ))}

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={8}
        maxDistance={28}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2.3}
      />
    </>
  )
}

export const SeaScene: React.FC<SeaSceneProps> = (props) => (
  <Canvas
    shadows
    camera={{ position: [0, 10, 16], fov: 45 }}
    gl={{ antialias: true, alpha: false }}
    style={{ width: '100%', height: '100%', display: 'block' }}
  >
    <Scene {...props} />
  </Canvas>
)

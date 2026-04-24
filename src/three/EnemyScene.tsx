import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Board, Ship } from '../game/types'

/* ── Water shader ───────────────────────────────────────────── */
const VERT = `
uniform float uTime;
varying vec2 vUv;
varying float vElev;
void main(){
  vUv = uv;
  vec3 p = position;
  p.y += sin(p.x*2.1+uTime*1.5)*0.11
        +cos(p.z*1.7+uTime*1.1)*0.08
        +sin((p.x+p.z)*3.2+uTime*2.6)*0.04;
  vElev = p.y;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`

const FRAG = `
uniform float uTime;
varying vec2 vUv;
varying float vElev;
void main(){
  vec3 deep    = vec3(0.008,0.047,0.18);
  vec3 shallow = vec3(0.063,0.22,0.62);
  vec3 foam    = vec3(0.55,0.78,1.0);
  float m1   = smoothstep(-0.1,0.15,vElev);
  vec3 col   = mix(deep,shallow,m1);
  float fm   = smoothstep(0.1,0.22,vElev);
  col        = mix(col,foam,fm*0.5);
  float sp   = pow(max(0.0,sin(vUv.x*44.0+uTime)*sin(vUv.y*40.0+uTime*0.8)),9.0);
  col       += sp*0.13;
  gl_FragColor = vec4(col,0.93);
}
`

const Water: React.FC = () => {
  const ref = useRef<THREE.ShaderMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.getElapsedTime()
  })
  return (
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
      <planeGeometry args={[22,22,180,180]} />
      <shaderMaterial ref={ref} transparent
        uniforms={{ uTime:{ value:0 } }}
        vertexShader={VERT} fragmentShader={FRAG}
      />
    </mesh>
  )
}

/* ── Procedural pirate ship ─────────────────────────────────── */
interface ShipProps {
  wx: number; wz: number
  size: number; horizontal: boolean
  visible: boolean   // false = hidden in fog
  sunk: boolean
}

const PirateShip: React.FC<ShipProps> = ({ wx, wz, size, horizontal, visible, sunk }) => {
  const gRef = useRef<THREE.Group>(null)
  const t0 = useRef(Math.random()*100)

  useFrame(({ clock }) => {
    if (!gRef.current) return
    const e = clock.getElapsedTime()
    if (!sunk) {
      gRef.current.position.y = Math.sin(e*0.75+t0.current)*0.07
      gRef.current.rotation.z = Math.sin(e*0.55+t0.current)*0.03
      gRef.current.rotation.x = Math.cos(e*0.45+t0.current)*0.015
    } else {
      gRef.current.position.y = Math.max(gRef.current.position.y - 0.008, -0.7)
      gRef.current.rotation.z = Math.min(gRef.current.rotation.z + 0.004, 0.7)
    }
  })

  if (!visible) return null

  const sc  = 0.32 + size*0.06
  const mh  = size>=4 ? 1.1 : size>=3 ? 0.9 : 0.72
  const hc  = sunk ? '#5c1a1a' : '#1e293b'
  const dc  = sunk ? '#3a0f0f' : '#0f172a'
  const sc2 = sunk ? '#3b1111' : '#f5f5f4'
  const ry  = horizontal ? 0 : Math.PI/2

  return (
    <group ref={gRef} position={[wx,0,wz]} rotation={[0,ry,0]} scale={[sc,sc,sc]}>
      {/* Hull */}
      <mesh castShadow>
        <boxGeometry args={[2.2,0.38,0.85]} />
        <meshStandardMaterial color={hc} roughness={0.8} metalness={0.15} />
      </mesh>
      {/* Bow */}
      <mesh castShadow position={[1.22,0,0]}>
        <cylinderGeometry args={[0,0.43,0.52,4,1]} />
        <meshStandardMaterial color={hc} roughness={0.8} />
      </mesh>
      {/* Deck */}
      <mesh castShadow position={[0,0.21,0]}>
        <boxGeometry args={[2.0,0.09,0.72]} />
        <meshStandardMaterial color={dc} roughness={0.7} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[-0.68,0.43,0]}>
        <boxGeometry args={[0.52,0.42,0.6]} />
        <meshStandardMaterial color={dc} roughness={0.65} metalness={0.1} />
      </mesh>
      {/* Mast 1 */}
      <mesh castShadow position={[0.18,0.21+mh/2,0]}>
        <cylinderGeometry args={[0.04,0.05,mh,6]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>
      {/* Sail 1 */}
      <mesh position={[0.18,0.21+mh*0.58,0.01]}>
        <planeGeometry args={[0.55,mh*0.55]} />
        <meshStandardMaterial color={sc2} side={THREE.DoubleSide} roughness={0.8}
          transparent opacity={sunk?0.3:0.95} />
      </mesh>
      {size>=3 && (
        <>
          <mesh castShadow position={[-0.2,0.21+(mh-0.15)/2,0]}>
            <cylinderGeometry args={[0.035,0.045,mh-0.15,6]} />
            <meshStandardMaterial color="#b45309" roughness={0.9} />
          </mesh>
          <mesh position={[-0.2,0.21+(mh-0.15)*0.55,0.01]}>
            <planeGeometry args={[0.44,(mh-0.15)*0.5]} />
            <meshStandardMaterial color={sc2} side={THREE.DoubleSide} roughness={0.8}
              transparent opacity={sunk?0.25:0.9} />
          </mesh>
        </>
      )}
      {size>=4 && (
        <>
          <mesh castShadow position={[0.65,0.21+(mh-0.25)/2,0]}>
            <cylinderGeometry args={[0.03,0.04,mh-0.25,6]} />
            <meshStandardMaterial color="#b45309" roughness={0.9} />
          </mesh>
          <mesh position={[0.65,0.21+(mh-0.25)*0.52,0.01]}>
            <planeGeometry args={[0.4,(mh-0.25)*0.45]} />
            <meshStandardMaterial color={sc2} side={THREE.DoubleSide} roughness={0.8}
              transparent opacity={sunk?0.2:0.88} />
          </mesh>
        </>
      )}
      {/* Pirate flag */}
      <mesh position={[0.18,0.21+mh+0.1,0.01]}>
        <planeGeometry args={[0.22,0.14]} />
        <meshStandardMaterial color={sunk?'#3a0808':'#020617'} side={THREE.DoubleSide} />
      </mesh>
      {/* Skull on flag */}
      {/* Cannons */}
      {Array.from({length:Math.max(1,size-1)},(_,i)=>(
        <mesh key={i} castShadow position={[0.3-i*0.4,0.07,0.44]}>
          <cylinderGeometry args={[0.045,0.04,0.22,6]} />
          <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.5} />
        </mesh>
      ))}
      {/* Hit glow when sunk */}
      {sunk && (
        <pointLight position={[0,0.5,0]} intensity={1.5} color="#f97316" distance={2} decay={2} />
      )}
    </group>
  )
}

/* ── Hit marker in 3D ──────────────────────────────────────── */
const HitMarker: React.FC<{x:number;z:number}> = ({x,z}) => {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.getElapsedTime()*1.5
    const s = 0.85 + Math.sin(clock.getElapsedTime()*3)*0.1
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[x,0.15,z]}>
      <torusGeometry args={[0.3,0.04,8,24]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
    </mesh>
  )
}

const MissMarker: React.FC<{x:number;z:number}> = ({x,z}) => (
  <mesh position={[x,0.08,z]}>
    <cylinderGeometry args={[0.12,0.12,0.04,16]} />
    <meshStandardMaterial color="#3b82f6" emissive="#60a5fa" emissiveIntensity={0.6} transparent opacity={0.8} />
  </mesh>
)

/* ── Scene ────────────────────────────────────────────────── */
interface SceneProps {
  aiShips: Ship[]
  aiBoard: Board
}

const CELL = 1.05
const OFF  = -(10*CELL)/2 + CELL/2

const Scene: React.FC<SceneProps> = ({ aiShips, aiBoard }) => {
  // Collect which shipIds have at least one hit cell
  const hitShipIds = new Set<number>()
  const sunkShipIds = new Set<number>()
  aiBoard.forEach(row => row.forEach(cell => {
    if (cell.hit && cell.shipId !== null) hitShipIds.add(cell.shipId)
  }))
  aiShips.forEach(s => { if (s.hits >= s.size) sunkShipIds.add(s.id) })

  return (
    <>
      <color attach="background" args={['#020817']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[6,14,5]} intensity={1.3} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0,5,0]} intensity={0.4} color="#bfdbfe" />
      <fogExp2 attach="fog" color="#020817" density={0.045} />

      <Water />

      {aiShips.map(ship => {
        const cx = ship.x + (ship.horizontal ? (ship.size-1)/2 : 0)
        const cy = ship.y + (!ship.horizontal ? (ship.size-1)/2 : 0)
        const wx = OFF + cx*CELL
        const wz = OFF + cy*CELL
        const visible = hitShipIds.has(ship.id)
        const sunk = sunkShipIds.has(ship.id)
        return (
          <PirateShip key={ship.id}
            wx={wx} wz={wz}
            size={ship.size} horizontal={ship.horizontal}
            visible={visible} sunk={sunk}
          />
        )
      })}

      {/* 3D markers on board */}
      {aiBoard.map((row,y) => row.map((cell,x) => {
        const wx = OFF + x*CELL
        const wz = OFF + y*CELL
        if (cell.hit)  return <HitMarker  key={`h${x}-${y}`} x={wx} z={wz} />
        if (cell.miss) return <MissMarker key={`m${x}-${y}`} x={wx} z={wz} />
        return null
      }))}
    </>
  )
}

/* ── Export ───────────────────────────────────────────────── */
export const EnemyScene: React.FC<SceneProps> = (props) => (
  <Canvas
    shadows
    camera={{ position:[0,9,12], fov:48 }}
    gl={{ antialias:true, alpha:false }}
    style={{ width:'100%', height:'100%', display:'block' }}
  >
    <Scene {...props} />
  </Canvas>
)

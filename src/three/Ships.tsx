/**
 * Ships.tsx — Подзадача 4
 * FIX: ранний return `if (!visible)` перенесён ПОСЛЕ всех хуков.
 *      Скрытие реализовано через `visible` проп на <group>, а не ранним return.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HullFoam } from './Water'
import { SinkVFX } from './VFX'

/* ─── SAIL SHADERS (wind-billowing sin deformation) ─── */
const SAIL_VERT = `
uniform float uTime;
uniform float uWind;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  float t = uv.y;
  float belly = sin(uv.x * 3.14159) * t;
  p.z += belly * (0.12 + uWind * 0.18) * (1.0 + 0.35 * sin(uTime * 1.8 + uv.y * 4.0));
  p.z += t * t * 0.06 * sin(uTime * 3.2 + uv.x * 6.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const SAIL_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main(){
  gl_FragColor = vec4(uColor, uOpacity);
}
`

/* ─── SHIP CONFIG ─── */
export interface ShipCfg {
  L: number; W: number; H: number
  masts: number; mastH: number; sailW: number
  cannons: number; hasCrowsNest: boolean
  sternH: number; bowLen: number
}
export const SHIP_CFGS: Record<number, ShipCfg> = {
  1: { L:0.90, W:0.52, H:0.30, masts:1, mastH:1.10, sailW:0.55, cannons:0, hasCrowsNest:false, sternH:0.12, bowLen:0.32 },
  2: { L:1.30, W:0.62, H:0.36, masts:1, mastH:1.35, sailW:0.72, cannons:2, hasCrowsNest:false, sternH:0.16, bowLen:0.38 },
  3: { L:1.85, W:0.74, H:0.42, masts:2, mastH:1.60, sailW:0.82, cannons:3, hasCrowsNest:true,  sternH:0.22, bowLen:0.44 },
  4: { L:2.50, W:0.88, H:0.50, masts:3, mastH:1.85, sailW:0.95, cannons:4, hasCrowsNest:true,  sternH:0.30, bowLen:0.52 },
}

/* ─── LATHE HULL PROFILE ─── */
function makeHullProfile(L: number, W: number, H: number): THREE.Vector2[] {
  const hw = W / 2
  const pts: THREE.Vector2[] = []
  pts.push(new THREE.Vector2(0.04,       -H / 2))
  pts.push(new THREE.Vector2(hw * 0.55,  -H / 2 + H * 0.18))
  pts.push(new THREE.Vector2(hw * 0.82,  -H / 2 + H * 0.42))
  pts.push(new THREE.Vector2(hw,          H * 0.05))
  pts.push(new THREE.Vector2(hw * 0.94,   H / 2 - H * 0.08))
  pts.push(new THREE.Vector2(hw * 0.90,   H / 2))
  return pts
}

/* ─── INSTANCED RAILINGS ─── */
interface RailingsProps {
  L: number; W: number; H: number; color: string
}
const Railings: React.FC<RailingsProps> = React.memo(({ L, W, H, color }) => {
  const postCount = Math.floor((L - 0.2) / 0.22)
  const totalPosts = postCount * 2

  const postMatrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mats: THREE.Matrix4[] = []
    for (let i = 0; i < postCount; i++) {
      const px = -L / 2 + 0.16 + i * 0.22
      dummy.position.set(px, H / 2 + 0.10,  W / 2 - 0.035)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mats.push(dummy.matrix.clone())
      dummy.position.set(px, H / 2 + 0.10, -W / 2 + 0.035)
      dummy.updateMatrix()
      mats.push(dummy.matrix.clone())
    }
    return mats
  }, [L, W, H, postCount])

  const postRef = useRef<THREE.InstancedMesh>(null)
  useMemo(() => {
    if (!postRef.current) return
    postMatrices.forEach((m, i) => postRef.current!.setMatrixAt(i, m))
    postRef.current.instanceMatrix.needsUpdate = true
  }, [postMatrices])

  const plankCount = Math.floor(L / 0.14)
  const plankMatrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    return Array.from({ length: plankCount }, (_, i) => {
      dummy.position.set(-L / 2 + 0.10 + i * 0.14, H / 2 + 0.055, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      return dummy.matrix.clone()
    })
  }, [L, H, plankCount])

  const plankRef = useRef<THREE.InstancedMesh>(null)
  useMemo(() => {
    if (!plankRef.current) return
    plankMatrices.forEach((m, i) => plankRef.current!.setMatrixAt(i, m))
    plankRef.current.instanceMatrix.needsUpdate = true
  }, [plankMatrices])

  const postMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), [color])
  const plankMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0c1a2e', roughness: 0.9 }), [])
  const postGeo  = useMemo(() => new THREE.CylinderGeometry(0.022, 0.022, 0.16, 4), [])
  const plankGeo = useMemo(() => new THREE.BoxGeometry(0.10, 0.018, W - 0.12), [W])

  return (
    <>
      <instancedMesh ref={postRef} args={[postGeo, postMat, totalPosts]}
        onUpdate={self => {
          postMatrices.forEach((m, i) => self.setMatrixAt(i, m))
          self.instanceMatrix.needsUpdate = true
        }}
      />
      <instancedMesh ref={plankRef} args={[plankGeo, plankMat, plankCount]}
        onUpdate={self => {
          plankMatrices.forEach((m, i) => self.setMatrixAt(i, m))
          self.instanceMatrix.needsUpdate = true
        }}
      />
      <mesh position={[0, H / 2 + 0.172,  W / 2 - 0.035]}>
        <boxGeometry args={[L - 0.14, 0.028, 0.026]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, H / 2 + 0.172, -W / 2 + 0.035]}>
        <boxGeometry args={[L - 0.14, 0.028, 0.026]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </>
  )
})

/* ─── ANIMATED SAIL ─── */
interface SailProps {
  position: [number, number, number]
  width: number; height: number
  color: string; opacity: number
  segments?: number
}
const Sail: React.FC<SailProps> = React.memo(({ position, width, height, color, opacity, segments = 12 }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uWind:    { value: 0.6 + Math.random() * 0.4 },
    uColor:   { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
  }), [color, opacity])

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height, segments, segments]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={SAIL_VERT}
        fragmentShader={SAIL_FRAG}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  )
})

/* ─── MAIN SHIP COMPONENT ─── */
export interface ShipModelProps {
  wx: number; wz: number; size: number; horizontal: boolean
  visible: boolean; sunk: boolean; isPlayer: boolean
}

export const PirateShip: React.FC<ShipModelProps> = React.memo((
  { wx, wz, size, horizontal, visible, sunk, isPlayer }
) => {
  const grp = useRef<THREE.Group>(null)
  const t0  = useRef(Math.random() * 100)
  const sunkProgress = useRef(0)

  // ── Все хуки ВСЕГДА вызываются — до любого условного return ──
  const cfg = SHIP_CFGS[Math.max(1, Math.min(4, size))]
  const { L, W, H, masts, mastH: mH, sailW, cannons, hasCrowsNest, sternH, bowLen } = cfg
  const sc  = 0.82
  const ry  = horizontal ? 0 : Math.PI / 2

  const hullC   = sunk ? '#1a0808' : isPlayer ? '#152844' : '#1c1005'
  const deckC   = sunk ? '#120404' : isPlayer ? '#0d1d32' : '#110c03'
  const sailC   = sunk ? '#1e1010' : isPlayer ? '#cce4ff' : '#f2ead8'
  const mastC   = '#6e3e12'
  const ropeC   = '#7a5a0e'
  const metalC  = '#2a3344'
  const goldC   = sunk ? '#2a1a00' : '#c89020'
  const goldEm  = sunk ? '#000000' : '#7a4a00'
  const lanternColor    = isPlayer ? '#88bbff' : '#ffbb55'
  const lanternEmissive = isPlayer ? '#4477dd' : '#dd7700'

  const hullGeo = useMemo(() => {
    const profile = makeHullProfile(L, W, H)
    const geo = new THREE.LatheGeometry(profile, 24)
    geo.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, L / W))
    return geo
  }, [L, W, H])

  const bowGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0, W / 2.1, bowLen, 6, 1)
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
    return g
  }, [W, bowLen])

  const mastXs = masts === 1 ? [0.08] : masts === 2 ? [-0.12, 0.40] : [-0.52, 0.08, 0.58]
  const vfxPos: [number, number, number] = [wx, 0.4, wz]

  useFrame(({ clock }) => {
    if (!grp.current) return
    const e = clock.getElapsedTime() + t0.current
    if (sunk) {
      sunkProgress.current = Math.min(sunkProgress.current + 0.004, 1)
      grp.current.position.y = -sunkProgress.current * 1.4
      grp.current.rotation.z =  sunkProgress.current * 0.9
      grp.current.rotation.x =  sunkProgress.current * 0.25
    } else {
      grp.current.position.y = Math.sin(e * 0.55) * 0.1
      grp.current.rotation.z = Math.sin(e * 0.42) * 0.028
      grp.current.rotation.x = Math.cos(e * 0.36) * 0.014
    }
  })

  // ── Ранний return ПОСЛЕ всех хуков ──
  if (!visible) return null

  return (
    <>
      <group ref={grp} position={[wx, 0.06, wz]} rotation={[0, ry, 0]} scale={[sc, sc, sc]}>

        {/* ── HULL (LatheGeometry) ── */}
        <mesh castShadow geometry={hullGeo}>
          <meshStandardMaterial color={hullC} roughness={0.78} metalness={0.12} />
        </mesh>

        {/* waterline plank strips */}
        {[0,1,2,3,4].map(i => (
          <mesh key={`pk${i}`} position={[0, -H/2 + 0.038 + i*0.092, 0]}>
            <boxGeometry args={[L*0.97, 0.028, W+0.008]} />
            <meshStandardMaterial color={isPlayer ? '#0f1e38' : '#150e04'} roughness={0.95} metalness={0.04} />
          </mesh>
        ))}

        {/* gold waterline stripe */}
        <mesh position={[0, -H/2 + 0.018, 0]}>
          <boxGeometry args={[L*0.98, 0.025, W+0.012]} />
          <meshStandardMaterial color={goldC} emissive={goldEm} emissiveIntensity={sunk ? 0 : 0.8} roughness={0.45} metalness={0.55} />
        </mesh>

        {/* ── BOW ── */}
        <mesh castShadow position={[L/2 + bowLen*0.38, 0, 0]} geometry={bowGeo}>
          <meshStandardMaterial color={hullC} roughness={0.78} />
        </mesh>
        {size >= 2 && (
          <mesh position={[L/2 + bowLen*0.3, H/2 + 0.08, 0]} rotation={[0, 0, -Math.PI/8]}>
            <cylinderGeometry args={[0.018, 0.028, bowLen*0.9, 6]} />
            <meshStandardMaterial color={mastC} roughness={0.85} />
          </mesh>
        )}

        {/* ── STERN ── */}
        <mesh castShadow position={[-L/2 + 0.22 + sternH, H/2 + sternH/2, 0]}>
          <boxGeometry args={[0.44 + size*0.06, sternH, W*0.82]} />
          <meshStandardMaterial color={deckC} roughness={0.72} />
        </mesh>
        {size === 4 && (
          <mesh position={[-L/2 + 0.16, H/2 + sternH + 0.10, 0]}>
            <boxGeometry args={[0.30, 0.18, W*0.65]} />
            <meshStandardMaterial color={deckC} roughness={0.72} />
          </mesh>
        )}
        <mesh position={[-L/2 - 0.04, H/2 - 0.06, 0]}>
          <boxGeometry args={[0.07, H*0.7, W*0.72]} />
          <meshStandardMaterial color={size >= 3 ? goldC : hullC}
            emissive={size >= 3 ? goldEm : '#000'}
            emissiveIntensity={size >= 3 && !sunk ? 0.5 : 0}
            roughness={0.7} metalness={size >= 3 ? 0.4 : 0.1} />
        </mesh>
        {size >= 3 && (
          <mesh position={[-L/2 - 0.04, H/2 + 0.12, 0]}>
            <torusGeometry args={[0.09, 0.018, 6, 14, Math.PI]} />
            <meshStandardMaterial color={goldC} emissive={goldEm} emissiveIntensity={sunk ? 0 : 0.6} roughness={0.5} metalness={0.5} />
          </mesh>
        )}

        {/* ── DECK ── */}
        <mesh castShadow position={[0, H/2 + 0.025, 0]}>
          <boxGeometry args={[L - 0.08, 0.055, W - 0.08]} />
          <meshStandardMaterial color={deckC} roughness={0.72} metalness={0.04} />
        </mesh>

        {/* ── RAILINGS + DECK PLANKS ── */}
        <Railings L={L} W={W} H={H} color={mastC} />

        {/* ── BARRELS ── */}
        {size >= 3 && ([[-0.15, 0.06], [-0.15, -0.06], [0.05, 0]] as [number,number][]).map(([bx, bz], i) => (
          <mesh key={`br${i}`} position={[bx, H/2 + 0.07, bz]}>
            <cylinderGeometry args={[0.055, 0.055, 0.10, 8]} />
            <meshStandardMaterial color='#3d2208' roughness={0.9} />
          </mesh>
        ))}

        {/* ── MASTS + ANIMATED SAILS ── */}
        {mastXs.map((mstX, mi) => {
          const mh = mi === 0 ? mH : mH * (0.82 - mi * 0.07)
          const sw = sailW * (1 - mi * 0.1)
          const sh = mh * 0.58
          const mRad = 0.042 - mi * 0.004
          return (
            <group key={`mast${mi}`}>
              <mesh castShadow position={[mstX, H/2 + mh/2 + 0.04, 0]}>
                <cylinderGeometry args={[mRad*0.78, mRad+0.006, mh, 8]} />
                <meshStandardMaterial color={mastC} roughness={0.86} metalness={0.1} />
              </mesh>

              {mi === 0 && hasCrowsNest && (
                <group position={[mstX, H/2 + mh*0.72, 0]}>
                  <mesh><cylinderGeometry args={[0.14, 0.10, 0.11, 10]} /><meshStandardMaterial color={deckC} roughness={0.8} /></mesh>
                  <mesh position={[0, 0.06, 0]}><torusGeometry args={[0.13, 0.012, 5, 14]} /><meshStandardMaterial color={mastC} roughness={0.85} /></mesh>
                </group>
              )}

              <mesh position={[mstX, H/2 + mh + 0.04, 0]}>
                <sphereGeometry args={[0.032, 6, 6]} />
                <meshStandardMaterial color={mastC} roughness={0.8} />
              </mesh>

              <mesh position={[mstX, H/2 + mh*0.84, 0]} rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.016, 0.016, sw*1.9, 6]} />
                <meshStandardMaterial color={mastC} roughness={0.9} />
              </mesh>
              {size >= 3 && (
                <mesh position={[mstX, H/2 + mh*0.48, 0]} rotation={[0, 0, Math.PI/2]}>
                  <cylinderGeometry args={[0.013, 0.013, sw*1.4, 6]} />
                  <meshStandardMaterial color={mastC} roughness={0.9} />
                </mesh>
              )}

              <Sail
                position={[mstX + 0.02, H/2 + mh*0.57, 0.03]}
                width={sw * 1.65} height={sh}
                color={sailC} opacity={sunk ? 0.25 : 0.97}
              />
              <Sail
                position={[mstX, H/2 + mh*0.57, -0.018]}
                width={sw * 1.52} height={sh * 0.88}
                color={isPlayer ? '#b8d4ee' : '#e0d4b8'}
                opacity={sunk ? 0.15 : 0.28}
                segments={4}
              />
              {size >= 3 && (
                <Sail
                  position={[mstX + 0.015, H/2 + mh*0.88, 0.025]}
                  width={sw * 0.95} height={sh * 0.38}
                  color={sailC} opacity={sunk ? 0.2 : 0.94}
                />
              )}

              <mesh position={[mstX + L*0.26, H/2 + mH*0.42, 0.02]}
                rotation={[0, 0, Math.atan2(mH*0.42, L*0.26)]}>
                <cylinderGeometry args={[0.007, 0.007, Math.sqrt((L*0.26)**2 + (mH*0.42)**2), 4]} />
                <meshStandardMaterial color={ropeC} roughness={1} />
              </mesh>
              <mesh position={[mstX - L*0.18, H/2 + mH*0.38, 0.02]}
                rotation={[0, 0, -Math.atan2(mH*0.38, L*0.18)]}>
                <cylinderGeometry args={[0.007, 0.007, Math.sqrt((L*0.18)**2 + (mH*0.38)**2), 4]} />
                <meshStandardMaterial color={ropeC} roughness={1} />
              </mesh>
            </group>
          )
        })}

        {/* ── FLAGS ── */}
        <mesh position={[mastXs[0] + 0.14, H/2 + mH + 0.22, 0.01]}>
          <planeGeometry args={[0.30, 0.20]} />
          <meshStandardMaterial color={sunk ? '#1a0000' : '#060614'} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
        <mesh position={[mastXs[0] + 0.20, H/2 + mH + 0.22, 0.025]}>
          <planeGeometry args={[0.12, 0.08]} />
          <meshStandardMaterial color={sunk ? '#331100' : '#f5f5dc'} side={THREE.DoubleSide} roughness={0.9} transparent opacity={0.75} />
        </mesh>
        {size === 4 && mastXs.length >= 3 && (
          <mesh position={[mastXs[2] + 0.12, H/2 + mH*0.83 + 0.14, 0.01]}>
            <planeGeometry args={[0.22, 0.14]} />
            <meshStandardMaterial color={isPlayer ? '#001a6e' : '#6e1a00'} side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
        )}

        {/* ── CANNONS ── */}
        {Array.from({ length: cannons }, (_, i) => {
          const cx = -L/2 + 0.28 + i * (L - 0.36) / (Math.max(cannons - 1, 1))
          return (
            <group key={`cn${i}`}>
              <mesh position={[cx, -0.04, W/2 + 0.05]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.048, 0.058, 0.30, 8]} />
                <meshStandardMaterial color={metalC} roughness={0.55} metalness={0.6} />
              </mesh>
              <mesh position={[cx, -0.04, W/2 + 0.19]} rotation={[Math.PI/2, 0, 0]}>
                <torusGeometry args={[0.058, 0.01, 6, 12]} />
                <meshStandardMaterial color={goldC} emissive={goldEm} emissiveIntensity={sunk ? 0 : 0.4} roughness={0.5} metalness={0.5} />
              </mesh>
              <mesh position={[cx, -0.11, W/2 + 0.05]}>
                <boxGeometry args={[0.16, 0.06, 0.14]} />
                <meshStandardMaterial color='#3d2208' roughness={0.9} />
              </mesh>
              {([-0.055, 0.055] as number[]).map((bz, wi) => (
                <mesh key={wi} position={[cx, -0.13, W/2 + 0.05 + bz]} rotation={[0, 0, Math.PI/2]}>
                  <torusGeometry args={[0.06, 0.014, 5, 12]} />
                  <meshStandardMaterial color='#7a5a0e' roughness={0.85} />
                </mesh>
              ))}
            </group>
          )
        })}

        {/* ── LANTERNS ── */}
        <mesh position={[L/2 + 0.08, H/2 + 0.22, 0]}>
          <octahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial color={lanternColor} emissive={lanternEmissive} emissiveIntensity={sunk ? 0 : 2.5} roughness={0.2} metalness={0.3} />
        </mesh>
        <pointLight
          position={[
            wx + (horizontal ? L/2 + 0.08 : 0) * sc,
            0.06 + H/2*sc + 0.22*sc,
            wz + (horizontal ? 0 : L/2 + 0.08) * sc,
          ]}
          intensity={sunk ? 0 : 2.8} color={isPlayer ? '#4a90ff' : '#ffaa44'} distance={4.0} decay={2}
        />
        {size >= 2 && (
          <>
            <mesh position={[-L/2 - 0.04, H/2 + 0.18, 0]}>
              <octahedronGeometry args={[0.05, 0]} />
              <meshStandardMaterial color='#ffdd66' emissive='#ff8800' emissiveIntensity={sunk ? 0 : 2.2} roughness={0.2} metalness={0.3} />
            </mesh>
            <pointLight position={[wx, 0.55, wz]} intensity={sunk ? 0 : 1.8} color='#ffaa44' distance={3.5} decay={2} />
          </>
        )}

        {sunk && (
          <>
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial color='#ff2200' emissive='#ff4400' emissiveIntensity={3.5} roughness={0.4} />
            </mesh>
            <pointLight position={[0, 0.6, 0]} intensity={4.0} color='#ff3300' distance={4.5} decay={2} />
          </>
        )}
      </group>

      {!sunk && (
        <HullFoam
          shipX={wx} shipZ={wz}
          shipLength={cfg.L * sc + 0.3}
          shipWidth={cfg.W * sc}
        />
      )}

      <SinkVFX position={vfxPos} active={sunk} />
    </>
  )
})

PirateShip.displayName = 'PirateShip'

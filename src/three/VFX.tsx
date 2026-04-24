/**
 * VFX.tsx
 * Hit fire particles | Miss water splash | Sink bubbles + smoke
 */
import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ═══════════════════════════════════════════════════
   HIT FIRE PARTICLES  — 40 instanced sparks
═══════════════════════════════════════════════════ */
const PARTICLE_COUNT = 40

interface FireParticlesProps {
  position: [number, number, number]
  active: boolean
}

export const FireParticles: React.FC<FireParticlesProps> = ({ position, active }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // per-particle state: px,py,pz, vx,vy,vz, life, maxLife
  const state = useMemo(() => {
    const s = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        px: 0, py: 0, pz: 0,
        vx: (Math.random() - 0.5) * 2.2,
        vy: Math.random() * 3.5 + 1.8,
        vz: (Math.random() - 0.5) * 2.2,
        life: Math.random(),          // stagger start
        maxLife: 0.6 + Math.random() * 0.6,
      })
    }
    return s
  }, [])

  const dummy   = useMemo(() => new THREE.Object3D(), [])
  const colorBuf= useMemo(() => new Float32Array(PARTICLE_COUNT * 3), [])
  const geometry= useMemo(() => new THREE.TetrahedronGeometry(0.065, 0), [])
  const material= useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: new THREE.Color('#ff4400'),
    emissiveIntensity: 2.0,
    roughness: 0.5,
    transparent: true,
  }), [])

  // seed instance colors once
  useEffect(() => {
    if (!meshRef.current) return
    const colors = [0xff2200, 0xff6600, 0xffaa00, 0xffdd44, 0xffffff]
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const c = new THREE.Color(colors[Math.floor(Math.random() * colors.length)])
      colorBuf[i * 3]     = c.r
      colorBuf[i * 3 + 1] = c.g
      colorBuf[i * 3 + 2] = c.b
    }
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorBuf, 3))
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current || !active) return
    const dt = Math.min(delta, 0.05)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = state[i]
      p.life -= dt

      // respawn
      if (p.life <= 0) {
        p.px = (Math.random() - 0.5) * 0.25
        p.py = 0.1
        p.pz = (Math.random() - 0.5) * 0.25
        p.vx = (Math.random() - 0.5) * 2.2
        p.vy = Math.random() * 3.5 + 1.8
        p.vz = (Math.random() - 0.5) * 2.2
        p.maxLife = 0.6 + Math.random() * 0.6
        p.life = p.maxLife
      }

      // physics: gravity drag
      p.vx *= 0.97
      p.vz *= 0.97
      p.vy -= 4.2 * dt
      p.px += p.vx * dt
      p.py += p.vy * dt
      p.pz += p.vz * dt
      if (p.py < 0) { p.py = 0; p.vy *= -0.28 }

      const t = 1 - Math.max(0, p.life / p.maxLife)
      const scale = (1 - t * t) * 0.9 + 0.1

      dummy.position.set(p.px, p.py, p.pz)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    // fade opacity
    material.opacity = active ? 1 : 0
  })

  if (!active) return null

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[geometry, material, PARTICLE_COUNT]} castShadow>
        <primitive object={geometry} />
        <primitive object={material} />
      </instancedMesh>
    </group>
  )
}

/* ═══════════════════════════════════════════════════
   MISS WATER SPLASH  — expanding ring + column
═══════════════════════════════════════════════════ */
interface SplashRingProps {
  position: [number, number, number]
}

export const SplashRing: React.FC<SplashRingProps> = ({ position }) => {
  const ringRef    = useRef<THREE.Mesh>(null)
  const ring2Ref   = useRef<THREE.Mesh>(null)
  const colRef     = useRef<THREE.Mesh>(null)
  const startTime  = useRef(-1)
  const DURATION   = 1.4 // seconds

  useFrame(({ clock }) => {
    if (startTime.current < 0) startTime.current = clock.getElapsedTime()
    const t = (clock.getElapsedTime() - startTime.current) / DURATION
    if (t > 1) return

    const ease = 1 - Math.pow(1 - t, 2)

    // outer ring expands 0 → 1.8
    if (ringRef.current) {
      const s = ease * 1.8
      ringRef.current.scale.set(s, s, 1)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.75
    }
    // inner ring lags
    if (ring2Ref.current) {
      const s = ease * 0.95
      ring2Ref.current.scale.set(s, s, 1)
      ;(ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55
    }
    // column shoots up then fades
    if (colRef.current) {
      const ht = Math.sin(t * Math.PI) * 1.6
      colRef.current.scale.set(1, ht + 0.01, 1)
      ;(colRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.60
    }
  })

  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.30, 0.52, 40]} />
        <meshBasicMaterial color="#a8d4f5" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Inner ring */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.10, 0.26, 32]} />
        <meshBasicMaterial color="#d0eeff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Water column */}
      <mesh ref={colRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.10, 0.18, 1.0, 12, 1, true]} />
        <meshBasicMaterial color="#c8e8ff" transparent opacity={0.60} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ═══════════════════════════════════════════════════
   SINK VFX  — rising bubbles + billowing smoke
═══════════════════════════════════════════════════ */
const BUBBLE_COUNT = 22
const SMOKE_COUNT  = 14

interface SinkVFXProps {
  position: [number, number, number]
  active: boolean
}

export const SinkVFX: React.FC<SinkVFXProps> = ({ position, active }) => {
  const bubbleMeshRef = useRef<THREE.InstancedMesh>(null)
  const smokeMeshRef  = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const bubbles = useMemo(() => Array.from({ length: BUBBLE_COUNT }, () => ({
    x:  (Math.random() - 0.5) * 0.7,
    y:  Math.random() * 0.4,
    z:  (Math.random() - 0.5) * 0.7,
    vy: 0.5 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    scale: 0.04 + Math.random() * 0.06,
    life:  Math.random(),
  })), [])

  const smokes = useMemo(() => Array.from({ length: SMOKE_COUNT }, () => ({
    x:  (Math.random() - 0.5) * 0.5,
    y:  0.3 + Math.random() * 0.4,
    z:  (Math.random() - 0.5) * 0.5,
    vy: 0.4 + Math.random() * 0.8,
    vx: (Math.random() - 0.5) * 0.3,
    vz: (Math.random() - 0.5) * 0.3,
    scale: 0.10 + Math.random() * 0.14,
    life: Math.random(),
  })), [])

  const bubbleGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const bubbleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#88ccff',
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
    metalness: 0.3,
    depthWrite: false,
  }), [])

  const smokeGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const smokeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#555566',
    transparent: true,
    opacity: 0.38,
    roughness: 1.0,
    depthWrite: false,
  }), [])

  useFrame(({ clock }, delta) => {
    if (!active) return
    const dt  = Math.min(delta, 0.05)
    const now = clock.getElapsedTime()

    /* BUBBLES */
    if (bubbleMeshRef.current) {
      for (let i = 0; i < BUBBLE_COUNT; i++) {
        const b = bubbles[i]
        b.y  += b.vy * dt
        b.x  += Math.sin(now * 2.4 + b.phase) * 0.005
        b.life -= dt * 0.7
        if (b.life <= 0 || b.y > 3.0) {
          b.x = (Math.random() - 0.5) * 0.7
          b.y = 0.0
          b.z = (Math.random() - 0.5) * 0.7
          b.life = 0.8 + Math.random() * 0.5
          b.vy = 0.5 + Math.random() * 1.2
        }
        const s = b.scale * Math.min(b.life * 3, 1)
        dummy.position.set(b.x, b.y, b.z)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        bubbleMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
      bubbleMeshRef.current.instanceMatrix.needsUpdate = true
    }

    /* SMOKE */
    if (smokeMeshRef.current) {
      for (let i = 0; i < SMOKE_COUNT; i++) {
        const s = smokes[i]
        s.y   += s.vy * dt
        s.x   += s.vx * dt
        s.z   += s.vz * dt
        s.scale *= (1 + dt * 0.55)   // billows out
        s.life  -= dt * 0.4
        if (s.life <= 0 || s.y > 4.5) {
          s.x = (Math.random() - 0.5) * 0.5
          s.y = 0.3
          s.z = (Math.random() - 0.5) * 0.5
          s.vy = 0.4 + Math.random() * 0.8
          s.vx = (Math.random() - 0.5) * 0.3
          s.vz = (Math.random() - 0.5) * 0.3
          s.scale = 0.10 + Math.random() * 0.14
          s.life  = 0.9 + Math.random() * 0.6
        }
        dummy.position.set(s.x, s.y, s.z)
        dummy.scale.setScalar(s.scale * Math.min(s.life * 2.5, 1))
        dummy.updateMatrix()
        smokeMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
      smokeMeshRef.current.instanceMatrix.needsUpdate = true
    }
  })

  if (!active) return null

  return (
    <group position={position}>
      <instancedMesh ref={bubbleMeshRef} args={[bubbleGeo, bubbleMat, BUBBLE_COUNT]}>
        <primitive object={bubbleGeo} />
        <primitive object={bubbleMat} />
      </instancedMesh>
      <instancedMesh ref={smokeMeshRef} args={[smokeGeo, smokeMat, SMOKE_COUNT]}>
        <primitive object={smokeGeo} />
        <primitive object={smokeMat} />
      </instancedMesh>
    </group>
  )
}

/* ═══════════════════════════════════════════════════
   ONE-SHOT SPLASH (created on miss, auto-destroys via parent key)
═══════════════════════════════════════════════════ */
export { SplashRing as MissSplash }

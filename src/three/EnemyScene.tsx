import React, { useRef, useMemo, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Board } from '../game/types'

/* ── Animated water tile ───────────────────────────────────────── */
const TILE_VERT = `
uniform float uTime;
uniform float uHover;
uniform float uHit;
uniform float uMiss;
uniform float uReveal;
varying vec2 vUv;
varying float vElev;
void main(){
  vUv = uv;
  vec3 p = position;
  float wave = sin(p.x*4.0+uTime*2.2)*0.04
             + cos(p.y*3.5+uTime*1.7)*0.03
             + sin((p.x+p.y)*5.0+uTime*3.0)*0.015;
  p.z += wave;
  p.z += uHover * (sin(uTime*6.0)*0.02+0.03);
  p.z += uReveal * sin(uTime*4.0+p.x*2.0)*0.06;
  vElev = p.z;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`
const TILE_FRAG = `
uniform float uTime;
uniform float uHover;
uniform float uHit;
uniform float uMiss;
uniform float uReveal;
varying vec2 vUv;
varying float vElev;
void main(){
  vec3 deep    = vec3(0.01,0.04,0.14);
  vec3 mid     = vec3(0.03,0.12,0.38);
  vec3 shallow = vec3(0.06,0.22,0.6);
  vec3 foam    = vec3(0.45,0.72,1.0);

  float dist = length(vUv - 0.5) * 2.0;
  float m = smoothstep(0.0, 0.8, dist);
  vec3 base = mix(mid, deep, m);
  float fm = smoothstep(0.05,0.2,vElev);
  base = mix(base, foam, fm*0.35);

  // hover glow
  vec3 hoverCol = vec3(0.8,0.85,0.25);
  float hRing = smoothstep(0.38,0.42,dist) * (1.0-smoothstep(0.42,0.5,dist));
  base = mix(base, hoverCol, uHover * (0.25 + hRing*0.6));

  // hit explosion
  vec3 hitCol = vec3(1.0,0.25,0.05);
  float hBurst = (1.0-dist) * uHit;
  float hFlicker = abs(sin(uTime*18.0))*0.3+0.7;
  base = mix(base, hitCol*hFlicker, hBurst*0.9);
  float ember = smoothstep(0.55,0.35,dist)*uHit*0.5*(sin(uTime*22.0)*0.4+0.6);
  base += vec3(1.0,0.4,0.0)*ember;

  // miss ripple
  float ripple = abs(sin(dist*14.0 - uTime*4.0)) * (1.0-dist) * uMiss;
  base = mix(base, vec3(0.4,0.7,1.0), ripple*0.55);

  // grid edge glow
  float edgeX = smoothstep(0.5,0.42,abs(vUv.x-0.5)*2.0);
  float edgeY = smoothstep(0.5,0.42,abs(vUv.y-0.5)*2.0);
  float edge = 1.0 - min(edgeX,edgeY);
  vec3 edgeCol = mix(vec3(0.1,0.3,0.8), hoverCol, uHover);
  base += edgeCol * edge * (0.12 + uHover*0.25);

  float alpha = 0.92 + uHit*0.08;
  gl_FragColor = vec4(base, alpha);
}
`

interface TileProps {
  x: number; y: number
  wx: number; wz: number
  hit: boolean; miss: boolean
  disabled: boolean
  onClickCell: (x: number, y: number) => void
}

const WaterTile: React.FC<TileProps> = ({ x, y, wx, wz, hit, miss, disabled, onClickCell }) => {
  const matRef   = useRef<THREE.ShaderMaterial>(null)
  const meshRef  = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const t0 = useRef(Math.random() * 100)

  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uHover:  { value: 0 },
    uHit:    { value: hit   ? 1 : 0 },
    uMiss:   { value: miss  ? 1 : 0 },
    uReveal: { value: 0 },
  }), [])

  // Sync hit/miss to uniforms when they change
  React.useEffect(() => {
    if (!matRef.current) return
    matRef.current.uniforms.uHit.value  = hit  ? 1 : 0
    matRef.current.uniforms.uMiss.value = miss ? 1 : 0
  }, [hit, miss])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value  = clock.getElapsedTime() + t0.current
    const target = (hovered && !hit && !miss && !disabled) ? 1 : 0
    matRef.current.uniforms.uHover.value +=
      (target - matRef.current.uniforms.uHover.value) * 0.15
  })

  const canInteract = !hit && !miss && !disabled

  return (
    <mesh
      ref={meshRef}
      position={[wx, 0, wz]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerEnter={() => { if (canInteract) setHovered(true) }}
      onPointerLeave={() => setHovered(false)}
      onClick={() => { if (canInteract) onClickCell(x, y) }}
    >
      <planeGeometry args={[0.9, 0.9, 24, 24]} />
      <shaderMaterial
        ref={matRef}
        transparent
        uniforms={uniforms}
        vertexShader={TILE_VERT}
        fragmentShader={TILE_FRAG}
      />
    </mesh>
  )
}

/* ── Axis labels in 3D ─────────────────────────────────────────── */
const AxisLabels: React.FC<{ off: number; cell: number }> = ({ off, cell }) => {
  const LETTERS = 'ABCDEFGHIJ'
  const items: JSX.Element[] = []
  for (let i = 0; i < 10; i++) {
    const pos = off + i * cell
    // Column numbers (front edge)
    items.push(
      <mesh key={`cn${i}`} position={[pos, 0.01, off + 10 * cell + 0.3]}>
        <planeGeometry args={[0.55, 0.28]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.0} />
      </mesh>
    )
    // Row letters (left edge)
    items.push(
      <mesh key={`rl${i}`} position={[off - 0.7, 0.01, pos]}>
        <planeGeometry args={[0.35, 0.35]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.0} />
      </mesh>
    )
  }
  return <>{items}</>
}

/* ── Ocean floor / base plane ──────────────────────────────────── */
const OCEAN_VERT = `
uniform float uTime;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.y += sin(p.x*1.3+uTime*0.9)*0.12 + cos(p.z*1.1+uTime*0.7)*0.09;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`
const OCEAN_FRAG = `
uniform float uTime;
varying vec2 vUv;
void main(){
  vec3 c = mix(
    vec3(0.008,0.025,0.09),
    vec3(0.015,0.06,0.2),
    smoothstep(0.0,1.0,vUv.y)
  );
  float foam = pow(max(0.0,sin(vUv.x*60.0+uTime*1.5)*sin(vUv.y*55.0+uTime*1.1)),12.0);
  c += foam * 0.08;
  gl_FragColor = vec4(c,1.0);
}
`

const OceanFloor: React.FC = () => {
  const ref = useRef<THREE.ShaderMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.getElapsedTime()
  })
  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.25, 0]}>
      <planeGeometry args={[28, 28, 80, 80]} />
      <shaderMaterial ref={ref} uniforms={{ uTime: { value: 0 } }}
        vertexShader={OCEAN_VERT} fragmentShader={OCEAN_FRAG} />
    </mesh>
  )
}

/* ── Hit VFX ring ──────────────────────────────────────────────── */
const HitRing: React.FC<{ wx: number; wz: number }> = ({ wx, wz }) => {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.z = t * 1.8
    const s = 0.7 + Math.sin(t * 4) * 0.08
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[wx, 0.08, wz]} rotation={[-Math.PI/2, 0, 0]}>
      <ringGeometry args={[0.28, 0.38, 32]} />
      <meshBasicMaterial color="#ff3a1a" transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ── Miss splash ring ──────────────────────────────────────────── */
const MissRing: React.FC<{ wx: number; wz: number }> = ({ wx, wz }) => {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 0.55 + Math.sin(clock.getElapsedTime() * 2.5) * 0.06
    ref.current.scale.setScalar(s)
    ref.current.material.opacity = 0.45 + Math.sin(clock.getElapsedTime() * 2) * 0.15
  })
  return (
    <mesh ref={ref} position={[wx, 0.06, wz]} rotation={[-Math.PI/2, 0, 0]}>
      <ringGeometry args={[0.12, 0.22, 24]} />
      <meshBasicMaterial ref={ref} color="#60a5fa" transparent opacity={0.55} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ── Camera controls (gentle orbit) ───────────────────────────── */
const CameraRig: React.FC = () => {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime()
    camera.position.x = Math.sin(t * 0.06) * 1.2
    camera.position.y = 9.5 + Math.sin(t * 0.08) * 0.4
    camera.position.z = 12 + Math.cos(t * 0.05) * 0.8
    camera.lookAt(0, 0, 0.5)
  })
  return null
}

/* ── Fog particles (floating specks) ──────────────────────────── */
const FogParticles: React.FC = () => {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 180
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 22
      pos[i*3+1] = Math.random() * 2.5 + 0.1
      pos[i*3+2] = (Math.random() - 0.5) * 22
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const matRef = useRef<THREE.PointsMaterial>(null)
  useFrame(({ clock }) => {
    if (matRef.current)
      matRef.current.opacity = 0.18 + Math.sin(clock.getElapsedTime() * 0.4) * 0.06
  })
  return (
    <points geometry={geom}>
      <pointsMaterial ref={matRef} color="#bfdbfe" size={0.07} transparent opacity={0.2} sizeAttenuation />
    </points>
  )
}

/* ── Inner scene ───────────────────────────────────────────────── */
interface SceneProps { board: Board; disabled: boolean; onCellClick: (x: number, y: number) => void }

const CELL = 1.0
const OFF  = -(10 * CELL) / 2 + CELL / 2

const InnerScene: React.FC<SceneProps> = ({ board, disabled, onCellClick }) => {
  const { gl } = useThree()
  React.useEffect(() => {
    gl.domElement.style.cursor = disabled ? 'default' : 'crosshair'
  }, [disabled, gl])

  return (
    <>
      <color attach="background" args={['#020817']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 12, 8]} intensity={1.1} color="#e0f0ff" />
      <pointLight position={[-4, 6, -4]} intensity={0.5} color="#1e40af" />
      <pointLight position={[4, 4, 4]} intensity={0.3} color="#0c4a6e" />
      <fogExp2 attach="fog" color="#020817" density={0.038} />

      <OceanFloor />
      <FogParticles />
      <CameraRig />

      {/* Water tiles grid */}
      {board.map((row, y) =>
        row.map((cell, x) => {
          const wx = OFF + x * CELL
          const wz = OFF + y * CELL
          return (
            <WaterTile
              key={`${x}-${y}`}
              x={x} y={y} wx={wx} wz={wz}
              hit={cell.hit} miss={cell.miss}
              disabled={disabled}
              onClickCell={onCellClick}
            />
          )
        })
      )}

      {/* VFX markers */}
      {board.map((row, y) =>
        row.map((cell, x) => {
          const wx = OFF + x * CELL
          const wz = OFF + y * CELL
          if (cell.hit)  return <HitRing  key={`h${x}-${y}`} wx={wx} wz={wz} />
          if (cell.miss) return <MissRing key={`m${x}-${y}`} wx={wx} wz={wz} />
          return null
        })
      )}
    </>
  )
}

/* ── 2D Axis overlay (HTML over canvas) ───────────────────────── */
const AxisOverlay: React.FC = () => {
  const LETTERS = 'ABCDEFGHIJ'
  return (
    <>
      {/* Column numbers top */}
      <div style={{
        position:'absolute', top: 8, left: 0, right: 0,
        display:'flex', justifyContent:'center', pointerEvents:'none', zIndex:4
      }}>
        <div style={{ display:'flex', gap:0, marginLeft: 22 }}>
          {Array.from({length:10},(_,i)=>(
            <div key={i} style={{
              width:36, textAlign:'center',
              fontSize:10, fontWeight:700,
              color:'rgba(250,204,21,0.55)',
              letterSpacing:'0.08em',
              textShadow:'0 0 8px rgba(250,204,21,0.4)'
            }}>{i+1}</div>
          ))}
        </div>
      </div>
      {/* Row letters left */}
      <div style={{
        position:'absolute', top:0, bottom:0, left:8,
        display:'flex', flexDirection:'column', justifyContent:'center',
        pointerEvents:'none', zIndex:4
      }}>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{
            height:36, display:'flex', alignItems:'center',
            fontSize:10, fontWeight:700,
            color:'rgba(250,204,21,0.55)',
            letterSpacing:'0.06em',
            textShadow:'0 0 8px rgba(250,204,21,0.4)'
          }}>{LETTERS[i]}</div>
        ))}
      </div>
    </>
  )
}

/* ── Export ────────────────────────────────────────────────────── */
interface EnemySceneProps {
  board: Board
  disabled: boolean
  onCellClick: (x: number, y: number) => void
}

export const EnemyScene: React.FC<EnemySceneProps> = ({ board, disabled, onCellClick }) => (
  <div style={{ position:'relative', width:'100%', height:'100%' }}>
    <AxisOverlay />
    <Canvas
      shadows
      camera={{ position:[0, 9.5, 12], fov:46, near:0.1, far:100 }}
      gl={{ antialias:true, alpha:false, powerPreference:'high-performance' }}
      style={{ width:'100%', height:'100%', display:'block' }}
    >
      <InnerScene board={board} disabled={disabled} onCellClick={onCellClick} />
    </Canvas>
  </div>
)

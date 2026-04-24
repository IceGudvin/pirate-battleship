/**
 * Water.tsx
 * Fresnel ocean + hull-foam shader
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ─────────────────────────────────────────
   MAIN OCEAN PLANE  (Fresnel + normal distort)
───────────────────────────────────────── */
const OCEAN_VERT = `
uniform float uTime;
varying vec2  vUv;
varying vec3  vWorldNormal;
varying vec3  vWorldPos;
varying float vElev;

void main() {
  vUv = uv;
  vec3 p = position;

  // multi-layer wave
  float w1 = sin(p.x * 1.8 + uTime * 1.4) * 0.18;
  float w2 = cos(p.z * 1.6 + uTime * 1.1) * 0.14;
  float w3 = sin((p.x + p.z) * 3.2 + uTime * 2.6) * 0.055;
  float w4 = sin(p.x * 5.4 + uTime * 3.1) * 0.022;
  p.y += w1 + w2 + w3 + w4;
  vElev = p.y;

  // finite-difference normal
  float eps = 0.04;
  float hL = sin((p.x-eps)*1.8+uTime*1.4)*0.18 + cos(p.z*1.6+uTime*1.1)*0.14;
  float hR = sin((p.x+eps)*1.8+uTime*1.4)*0.18 + cos(p.z*1.6+uTime*1.1)*0.14;
  float hD = sin(p.x*1.8+uTime*1.4)*0.18 + cos((p.z-eps)*1.6+uTime*1.1)*0.14;
  float hU = sin(p.x*1.8+uTime*1.4)*0.18 + cos((p.z+eps)*1.6+uTime*1.1)*0.14;
  vWorldNormal = normalize(vec3(hL-hR, 2.0*eps, hD-hU));

  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const OCEAN_FRAG = `
uniform float uTime;
uniform vec3  uCamPos;
varying vec2  vUv;
varying vec3  vWorldNormal;
varying vec3  vWorldPos;
varying float vElev;

void main() {
  vec3 N = normalize(vWorldNormal);

  // normal distortion scroll
  float nx = sin(vUv.x * 28.0 + uTime * 1.9) * 0.045;
  float nz = cos(vUv.y * 24.0 + uTime * 1.5) * 0.038;
  N = normalize(N + vec3(nx, 0.0, nz));

  // Fresnel
  vec3  V       = normalize(uCamPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.5);

  vec3 deepColor    = vec3(0.004, 0.018, 0.072);
  vec3 shallowColor = vec3(0.016, 0.090, 0.30);
  vec3 fresnelColor = vec3(0.30,  0.55,  0.90);

  float elev01 = smoothstep(-0.22, 0.22, vElev);
  vec3  col    = mix(deepColor, shallowColor, elev01);
  col          = mix(col, fresnelColor, fresnel * 0.72);

  // specular sparkle (sun/moon)
  vec3  L    = normalize(vec3(12.0, 28.0, 10.0));
  vec3  H    = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 96.0) * 0.55;
  col += vec3(0.75, 0.85, 1.0) * spec;

  // fine sparkle
  float sp2  = pow(max(0.0, sin(vUv.x*52.0+uTime)*sin(vUv.y*48.0+uTime*0.8)), 10.0);
  col += sp2 * 0.12;

  // foam crests
  float foam = smoothstep(0.12, 0.24, vElev);
  col = mix(col, vec3(0.72, 0.84, 1.0), foam * 0.42);

  gl_FragColor = vec4(col, 0.93 + fresnel * 0.07);
}
`

export const OceanPlane: React.FC<{ centerZ: number }> = ({ centerZ }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
  }), [])

  useFrame(({ clock, camera }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value   = clock.getElapsedTime()
    matRef.current.uniforms.uCamPos.value.copy(camera.position)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.30, centerZ]} receiveShadow>
      <planeGeometry args={[80, 80, 90, 90]} />
      <shaderMaterial
        ref={matRef}
        transparent
        uniforms={uniforms}
        vertexShader={OCEAN_VERT}
        fragmentShader={OCEAN_FRAG}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

/* ─────────────────────────────────────────
   HULL FOAM STRIP  (per-ship)
───────────────────────────────────────── */
const FOAM_VERT = `
uniform float uTime;
varying vec2  vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(p.x * 6.0 + uTime * 3.5) * 0.018;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const FOAM_FRAG = `
uniform float uTime;
varying vec2  vUv;
void main() {
  // fade at edges along UV.x
  float fade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  // animated foam noise
  float n = sin(vUv.x * 34.0 + uTime * 2.2) * sin(vUv.y * 18.0 - uTime * 1.4);
  float foam = smoothstep(0.18, 0.72, n) * fade;
  vec3 col = mix(vec3(0.05, 0.12, 0.28), vec3(0.78, 0.90, 1.0), foam);
  gl_FragColor = vec4(col, foam * 0.72);
}
`

interface HullFoamProps {
  shipX: number
  shipZ: number
  shipLength: number // world-space length along X
  shipWidth:  number
}
export const HullFoam: React.FC<HullFoamProps> = ({ shipX, shipZ, shipLength, shipWidth }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })
  const hw = shipWidth / 2 + 0.06
  return (
    <group position={[shipX, -0.26, shipZ]}>
      {/* port side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, hw, 0]}>
        <planeGeometry args={[shipLength, 0.22, 20, 4]} />
        <shaderMaterial ref={matRef} transparent uniforms={uniforms}
          vertexShader={FOAM_VERT} fragmentShader={FOAM_FRAG}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* starboard side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -hw, 0]}>
        <planeGeometry args={[shipLength, 0.22, 20, 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={FOAM_VERT} fragmentShader={FOAM_FRAG}
          transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

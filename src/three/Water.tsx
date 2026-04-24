/**
 * Water.tsx — спокойное ночное море, мягкие волны.
 */
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ─────────────────────────────────────────
   MAIN OCEAN PLANE
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

  // мягкие волны: амплитуды снижены в 3-4 раза
  float w1 = sin(p.x * 0.90  + uTime * 0.70) * 0.055;
  float w2 = cos(p.z * 0.80  + uTime * 0.55) * 0.045;
  float w3 = sin((p.x + p.z) * 1.50 + uTime * 1.00) * 0.018;
  float w4 = sin(p.x * 3.20  + uTime * 1.40) * 0.007;
  float w5 = cos(p.z * 2.80  + uTime * 1.20) * 0.006;
  p.y += w1 + w2 + w3 + w4 + w5;
  vElev = p.y;

  // finite-diff normal (те же коэффициенты)
  float eps = 0.04;
  float hL = sin((p.x-eps)*0.90+uTime*0.70)*0.055 + cos(p.z*0.80+uTime*0.55)*0.045;
  float hR = sin((p.x+eps)*0.90+uTime*0.70)*0.055 + cos(p.z*0.80+uTime*0.55)*0.045;
  float hD = sin(p.x*0.90+uTime*0.70)*0.055 + cos((p.z-eps)*0.80+uTime*0.55)*0.045;
  float hU = sin(p.x*0.90+uTime*0.70)*0.055 + cos((p.z+eps)*0.80+uTime*0.55)*0.045;
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

  // нормал-возмущение сильно уменьшено — убираем "чечевицу"
  float nx = sin(vUv.x * 18.0 + uTime * 1.0) * 0.012
           + sin(vUv.x * 38.0 - uTime * 1.6) * 0.005;
  float nz = cos(vUv.y * 16.0 + uTime * 0.8) * 0.010
           + cos(vUv.y * 32.0 + uTime * 1.4) * 0.004;
  N = normalize(N + vec3(nx, 0.0, nz));

  // Fresnel
  vec3  V       = normalize(uCamPos - vWorldPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);

  // цвета воды
  vec3 abyssColor   = vec3(0.002, 0.010, 0.055);
  vec3 midColor     = vec3(0.010, 0.072, 0.26);
  vec3 fresnelColor = vec3(0.22,  0.48,  0.82);

  float elev01 = smoothstep(-0.08, 0.08, vElev);
  vec3  col    = mix(abyssColor, midColor, elev01);
  col          = mix(col, fresnelColor, fresnel * 0.65);

  // SSS на гребнях (теперь гребни пологие — почти не видно, но есть)
  float sss = smoothstep(0.04, 0.10, vElev);
  col = mix(col, vec3(0.04, 0.28, 0.55), sss * 0.22);

  // лунная дорожка — specular
  vec3  L    = normalize(vec3(8.0, 22.0, 12.0));
  vec3  H    = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 160.0) * 0.55;
  col += vec3(0.85, 0.92, 1.00) * spec;

  // вторичный specular
  vec3  L2   = normalize(vec3(-5.0, 18.0, -8.0));
  vec3  H2   = normalize(L2 + V);
  float sp2  = pow(max(dot(N, H2), 0.0), 100.0) * 0.20;
  col += vec3(0.70, 0.80, 1.00) * sp2;

  // foam crests — только на самых высоких гребнях
  float foam = smoothstep(0.06, 0.10, vElev);
  col = mix(col, vec3(0.78, 0.90, 1.00), foam * 0.30);

  // очень мягкая рябь (убрана агрессивная)
  float rip = pow(max(0.0, sin(vUv.x*32.0+uTime*1.2)*sin(vUv.y*28.0+uTime*0.9)), 16.0);
  col += rip * 0.04;

  float alpha = 0.94 + fresnel * 0.06;
  gl_FragColor = vec4(col, alpha);
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
      <planeGeometry args={[80, 80, 96, 96]} />
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
   HULL FOAM STRIP
───────────────────────────────────────── */
const FOAM_VERT = `
uniform float uTime;
varying vec2  vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += sin(p.x * 4.0 + uTime * 1.8) * 0.010;
  p.y += sin(p.x * 2.0 + uTime * 0.9) * 0.018;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const FOAM_FRAG = `
uniform float uTime;
varying vec2  vUv;
void main() {
  float fade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float n = sin(vUv.x * 22.0 + uTime * 1.4) * sin(vUv.y * 12.0 - uTime * 0.9);
  float foam = smoothstep(0.18, 0.72, n) * fade;
  vec3 col = mix(vec3(0.03, 0.10, 0.26), vec3(0.82, 0.93, 1.0), foam);
  gl_FragColor = vec4(col, foam * 0.65);
}
`

interface HullFoamProps {
  shipX: number; shipZ: number
  shipLength: number; shipWidth: number
}
export const HullFoam: React.FC<HullFoamProps> = ({ shipX, shipZ, shipLength, shipWidth }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })
  const hw = shipWidth / 2 + 0.06
  return (
    <group position={[shipX, -0.24, shipZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, hw, 0]}>
        <planeGeometry args={[shipLength, 0.26, 24, 4]} />
        <shaderMaterial ref={matRef} transparent uniforms={uniforms}
          vertexShader={FOAM_VERT} fragmentShader={FOAM_FRAG}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -hw, 0]}>
        <planeGeometry args={[shipLength, 0.26, 24, 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={FOAM_VERT} fragmentShader={FOAM_FRAG}
          transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

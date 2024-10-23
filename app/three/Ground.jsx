import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

class GrassOptions {
  constructor() {
    this.scale = 100;
    this.patchiness = 0.5;
  }
}

export default function Ground({ scale = 100, patchiness = 0.5, ...props }) {
  const [grassTexture, dirtTexture, dirtNormal] = useLoader(
    THREE.TextureLoader,
    ["/grass.jpg", "/dirt_color.jpg", "/dirt_normal.jpg"]
  );

  // Configure textures
  useEffect(() => {
    [grassTexture, dirtTexture, dirtNormal].forEach((texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      // Prevent texture filtering
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      // Set repeat
      texture.repeat.set(50, 50);
    });

    grassTexture.colorSpace = THREE.SRGBColorSpace;
    dirtTexture.colorSpace = THREE.SRGBColorSpace;
  }, [grassTexture, dirtTexture, dirtNormal]);

  // Create material with custom shader
  const material = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.01,
      normalMap: dirtNormal,
      shininess: 0.1,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNoiseScale = { value: scale };
      shader.uniforms.uPatchiness = { value: patchiness };
      shader.uniforms.uGrassTexture = { value: grassTexture };
      shader.uniforms.uDirtTexture = { value: dirtTexture };

      // Add varyings and uniforms
      shader.vertexShader = `
        varying vec2 vUv;
        ${shader.vertexShader}
      `;

      shader.fragmentShader = `
        varying vec2 vUv;
        uniform float uNoiseScale;
        uniform float uPatchiness;
        uniform sampler2D uGrassTexture;
        uniform sampler2D uDirtTexture;
        ${shader.fragmentShader}
      `;

      // Update vertex shader to use UV coordinates
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        vUv = uv;
        `
      );

      // Add noise functions and main shader logic
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `
        vec3 mod289(vec3 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec2 mod289(vec2 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec3 permute(vec3 x) {
          return mod289(((x * 34.0) + 1.0) * x);
        }

        float simplex2d(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;

          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

          vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
          m = m * m;
          m = m * m;

          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;

          m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        // Scale UVs for noise without affecting texture scale
        vec2 noiseUv = vUv * 2000.0; // Large scale for noise pattern
        vec2 textureUv = vUv * 50.0; // Scale for texture repeating

        vec3 grassColor = texture2D(uGrassTexture, textureUv).rgb * vec3(0.5, 1.0, 0.5);
        vec3 dirtColor = texture2D(uDirtTexture, textureUv).rgb;

        float n = 0.5 + 0.5 * simplex2d(noiseUv / uNoiseScale);
        float s = smoothstep(uPatchiness - 0.1, uPatchiness + 0.1, n);

        vec4 sampledDiffuseColor = vec4(mix(grassColor, dirtColor, s), 1.0);
        diffuseColor *= sampledDiffuseColor;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `
        vec3 mapN = texture2D(normalMap, textureUv).xyz * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
        `
      );

      mat.userData.shader = shader;
    };

    return mat;
  }, [grassTexture, dirtTexture, dirtNormal, scale, patchiness]);

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      receiveShadow
      material={material}
      {...props}
    >
      <planeGeometry args={[500, 500]} />
    </mesh>
  );
}

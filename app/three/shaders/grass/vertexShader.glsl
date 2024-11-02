uniform float iTime;

attribute vec3 color;
varying vec2 vUv;
varying vec2 cloudUV;
varying vec3 vColor;

void main() {
  vUv = uv;
//   cloudUV = uv;
  vColor = color;
  vec3 cpos = position;

  float waveSize = 10.0;
  float tipDistance = 0.3;
  float centerDistance = 0.1;

  // Conditional movement based on color.x value
  if (color.x > 0.6) {
    cpos.x += sin((iTime / 1400.0) + (uv.x * waveSize)) * tipDistance;
  } else if (color.x > 0.0) {
    cpos.x += sin((iTime / 1400.0) + (uv.x * waveSize)) * centerDistance;
  }

  // Update cloud texture UVs over time
//   cloudUV.x += iTime / 20000.0;
//   cloudUV.y += iTime / 10000.0;

  // Calculate final position
  vec4 worldPosition = vec4(cpos, 1.0);
  vec4 mvPosition = modelViewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
}
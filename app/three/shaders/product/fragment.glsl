uniform sampler2D baseTexture;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vec4 color = texture2D(baseTexture, vUv);
    
    // Basic lighting
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    float diffuse = max(dot(normal, vec3(0.0, 1.0, 0.0)), 0.0);
    
    gl_FragColor = color * (0.5 + 0.5 * diffuse); // Mix ambient and diffuse
    gl_FragColor.a = color.a;
}
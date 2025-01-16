uniform float uTime;
uniform sampler2D uPerlinTexture;

varying vec2 vUv;

void main()
{
    // Scale and animate
    vec2 smokeUv = vUv;
    smokeUv.x *= 0.5;
    smokeUv.y *= 0.3;
    smokeUv.y -= uTime * 0.03;

    // Smoke
    float smoke = texture(uPerlinTexture, smokeUv).r;

    // Remap
    smoke = smoothstep(0.2, 1.0, smoke);

    // Edges
    smoke *= smoothstep(0.0, 0.1, vUv.x);
    smoke *= smoothstep(1.0, 0.9, vUv.x);
    smoke *= smoothstep(0.0, 0.1, vUv.y);
    smoke *= smoothstep(1.0, 0.4, vUv.y);

 
// gl_FragColor = vec4(0.65, 0.50, 0.39, smoke);  // Original
// gl_FragColor = vec4(0.71, 0.53, 0.39, smoke);  // Lighter, more caramel
// gl_FragColor = vec4(1.0, 0., 0., smoke);  // Darker, more roasted
// gl_FragColor = vec4(0.67, 0.48, 0.35, smoke);  // Slightly cooler brown

// gl_FragColor = vec4(0.65, 0.48, 0.35, smoke);  // Slightly more reddish
gl_FragColor = vec4(0.63, 0.51, 0.41, smoke);  // More grey undertone
// gl_FragColor = vec4(0.68, 0.52, 0.38, smoke);  // Warmer, golden hint

// gl_FragColor = vec4(0.72, 0.55, 0.41, smoke);  // Lighter, more visible
// gl_FragColor = vec4(0.61, 0.47, 0.38, smoke);  // Muted, subtle
// gl_FragColor = vec4(0.69, 0.51, 0.36, smoke);  // Enhanced contrast

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
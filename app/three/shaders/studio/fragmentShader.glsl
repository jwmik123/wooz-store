uniform sampler2D uBakedDayTexture;
uniform vec3 uDirectionalLightColor;
uniform vec3 uDirectionalLightDirection;
varying vec2 vUv;

// #pragma glslify: blend = require(glsl-blend/lighten)

void main()
{
    vec3 bakedDayColor = texture2D(uBakedDayTexture, vUv).rgb;
    vec3 darkerColor = bakedDayColor  * 2.0; // +-1 

    gl_FragColor = vec4(darkerColor, 1.0);

    #include <tonemapping_fragment>
}
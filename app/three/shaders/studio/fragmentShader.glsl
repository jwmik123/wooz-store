uniform sampler2D uBakedDayTexture;
varying vec2 vUv;

#pragma glslify: blend = require(glsl-blend/lighten)


void main()
{
    vec3 bakedDayColor = texture2D(uBakedDayTexture, vUv).rgb;
    gl_FragColor = vec4(bakedDayColor, 1.0);
}
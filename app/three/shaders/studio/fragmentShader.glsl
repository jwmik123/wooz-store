uniform sampler2D uBakedDayTexture;
uniform vec3 uDirectionalLightColor;
uniform vec3 uDirectionalLightDirection;
varying vec2 vUv;

void main()
{
    vec3 bakedDayColor = texture2D(uBakedDayTexture, vUv).rgb;
    vec3 lighterColor = bakedDayColor * 2.;

    gl_FragColor = vec4(lighterColor, 1.0);

    #include <tonemapping_fragment>
}
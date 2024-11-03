"use client";

import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";

import vertexShader from "./shaders/grass/vertexShader.glsl";
import fragmentShader from "./shaders/grass/fragmentShader.glsl";

const GrassMaterial = new THREE.ShaderMaterial({
  uniforms: {
    iTime: new THREE.Uniform(0),
    textures: new THREE.Uniform([]),
  },
  vertexShader,
  fragmentShader,
});

export default function Grass() {
  const meshRef = useRef();
  const startTime = useRef(Date.now());
  const grassTexture = useLoader(THREE.TextureLoader, "/assets/grass.jpg");

  useEffect(() => {
    meshRef.current.material.uniforms.textures.value = [grassTexture];
  }, [grassTexture]);

  useFrame(() => {
    meshRef.current.material.uniforms.iTime.value =
      Date.now() - startTime.current;
  });

  const generateField = () => {
    const positions = [];
    const uvs = [];
    const indices = [];
    const colors = [];

    const BLADE_COUNT = 75000; // Half the original count
    const RADIUS = 45;
    const BLADE_WIDTH = 0.5;
    const BLADE_HEIGHT = 0.75;
    const BLADE_HEIGHT_VARIATION = 0.6;
    const ANGLE = Math.PI; // 180 degrees for half circle shape

    for (let i = 0; i < BLADE_COUNT; i++) {
      const r = RADIUS * Math.sqrt(Math.random());
      const theta = Math.random() * ANGLE - ANGLE; // Restrict to half circle shape
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      const pos = new THREE.Vector3(x, 0, y);
      const uv = [
        (pos.x + RADIUS) / (2 * RADIUS),
        (pos.z + RADIUS) / (2 * RADIUS),
      ];

      const blade = generateBlade(
        pos,
        i * 5,
        uv,
        BLADE_WIDTH,
        BLADE_HEIGHT,
        BLADE_HEIGHT_VARIATION
      );
      blade.verts.forEach((vert) => {
        positions.push(...vert.pos);
        uvs.push(...vert.uv);
        colors.push(...vert.color);
      });
      blade.indices.forEach((indice) => indices.push(indice));
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    return geom;
  };

  const generateBlade = (
    center,
    vArrOffset,
    uv,
    BLADE_WIDTH,
    BLADE_HEIGHT,
    BLADE_HEIGHT_VARIATION
  ) => {
    const MID_WIDTH = BLADE_WIDTH * 0.5;
    const TIP_OFFSET = 0.1;
    const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;

    const yaw = Math.random() * Math.PI * 2;
    const yawUnitVec = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const tipBend = Math.random() * Math.PI * 2;
    const tipBendUnitVec = new THREE.Vector3(
      Math.sin(tipBend),
      0,
      -Math.cos(tipBend)
    );

    const bl = new THREE.Vector3().addVectors(
      center,
      yawUnitVec.clone().multiplyScalar(BLADE_WIDTH / 2)
    );
    const br = new THREE.Vector3().addVectors(
      center,
      yawUnitVec.clone().multiplyScalar(-BLADE_WIDTH / 2)
    );
    const tl = new THREE.Vector3()
      .addVectors(center, yawUnitVec.clone().multiplyScalar(MID_WIDTH / 2))
      .setY(height / 2);
    const tr = new THREE.Vector3()
      .addVectors(center, yawUnitVec.clone().multiplyScalar(-MID_WIDTH / 2))
      .setY(height / 2);
    const tc = new THREE.Vector3()
      .addVectors(center, tipBendUnitVec.clone().multiplyScalar(TIP_OFFSET))
      .setY(height);

    const verts = [
      { pos: bl.toArray(), uv, color: [0, 0, 0] },
      { pos: br.toArray(), uv, color: [0, 0, 0] },
      { pos: tr.toArray(), uv, color: [0.5, 0.5, 0.5] },
      { pos: tl.toArray(), uv, color: [0.5, 0.5, 0.5] },
      { pos: tc.toArray(), uv, color: [1.0, 1.0, 1.0] },
    ];

    const indices = [
      vArrOffset,
      vArrOffset + 1,
      vArrOffset + 2,
      vArrOffset + 2,
      vArrOffset + 4,
      vArrOffset + 3,
      vArrOffset + 3,
      vArrOffset,
      vArrOffset + 2,
    ];
    return { verts, indices };
  };

  const grassGeometry = useMemo(() => generateField(), []);

  return (
    <group position={[0, -3.2, 6]}>
      <mesh ref={meshRef} geometry={grassGeometry}>
        <primitive attach="material" object={GrassMaterial} />
      </mesh>
      <mesh position={[0, -1, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 25]} /> {/* Adjusted plane size */}
        <meshStandardMaterial color="#00785B" />
        <ambientLight intensity={1} />
      </mesh>
    </group>
  );
}

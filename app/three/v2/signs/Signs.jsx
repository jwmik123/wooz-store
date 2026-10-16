"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { InstancedMesh, Object3D, Raycaster, Vector3 } from "three/webgpu";
import gsap from "gsap";
import { useSaleHandles } from "@/lib/sale";
import collectionStore from "../../../stores/collectionStore";
import useCameraStore from "../../../stores/cameraStore";
import { useClothingItems } from "../Clothes";
import useDebug from "../debug/useDebug";
import { openCollection, setPointerCursor } from "../interactions";
import { TABLE_SPOTS, WIRE_X, layoutSigns, rackLabel, sweepRange } from "./signLayout";
import { cellRect, drawSignAtlas, loadSignFonts } from "./signAtlas";
import {
  createBoardGeometry,
  createBoardMaterial,
  createWireGeometry,
  createWireMaterial,
  setInstanceAttributes,
} from "./signMesh";
import {
  RACK_IDS,
  finePointer,
  setGlowRack,
  setHoverSign,
  setSignsVisible,
  setSpotHover,
  signsVisible,
  uGlowAmt,
  uSignsFade,
  uSpotHoverAmt,
  uSpotSweepC,
  uSpotSweepH,
  uSpotSweepT,
  uSweepMax,
  uSweepMin,
  uSweepRack,
  uSweepT,
  useRackHover,
} from "./signState";

/*
 * Shop signage: one signboard hung above each rack on two steel wires
 * (replaced the hanging garment tags). Draw calls: 1 (boards) + 1 (wires).
 * Also runs the idle discoverability sweep over the racks' garments and the
 * table pieces (coffee cup, lookbook, totebag) in turn.
 */

const IDLE_SWEEP_EVERY = 7; // s at the overview before the next light sweep
const noRaycast = () => null;
const UP = new Vector3(0, 1, 0);

/** World y of the studio roof / beam straight above (x, z), from `fromY` up. */
function ceilingProbe(studio) {
  if (!studio) return null;
  studio.updateWorldMatrix(true, false);
  const ray = new Raycaster();
  return (x, z, fromY) => {
    ray.set(new Vector3(x, fromY, z), UP);
    return ray.intersectObject(studio, false)[0]?.point.y ?? null;
  };
}

function matricesFor(sign) {
  const o = new Object3D();
  o.position.copy(sign.center);
  o.rotation.set(0, sign.yaw, 0);
  o.updateMatrix();
  const wires = [-1, 1].map((s) => {
    const w = new Object3D();
    w.position.copy(sign.pivot).add(new Vector3(s * WIRE_X, 0, 0).applyAxisAngle(UP, sign.yaw));
    w.scale.set(1, sign.wire + 0.01, 1);
    w.updateMatrix();
    return w.matrix;
  });
  return { board: o.matrix, wires };
}

export default function Signs() {
  const debug = useDebug();
  const groups = useClothingItems();
  const sale = useSaleHandles();
  const scene = useThree((s) => s.scene);

  // Layout needs the studio mesh (roof height above each rack).
  const [signs, setSigns] = useState(null);
  useLayoutEffect(() => {
    const probe = ceilingProbe(scene.getObjectByName("studio"));
    setSigns(
      layoutSigns(groups, (x, z, fromY) => (probe ? probe(x, z, fromY) : null))
    );
  }, [groups, scene]);

  return signs?.length ? <SignBoards signs={signs} sale={sale} debug={debug} /> : null;
}

function SignBoards({ signs, sale, debug }) {
  const atlas = useMemo(() => drawSignAtlas(signs, null), [signs]);
  // Redraw once the brand fonts are in, and whenever the sale data changes.
  useEffect(() => {
    let alive = true;
    loadSignFonts().then(() => alive && drawSignAtlas(signs, sale, atlas));
    return () => {
      alive = false;
    };
  }, [signs, sale, atlas]);

  const { boards, wires } = useMemo(() => {
    const n = signs.length;
    const anchor = new Float32Array(n * 4);
    const meta = new Float32Array(n * 4);
    const cell = new Float32Array(n * 4);
    const wAnchor = new Float32Array(n * 8);
    const wMeta = new Float32Array(n * 8);
    signs.forEach((s, i) => {
      const a = [s.pivot.x, s.pivot.y, s.pivot.z, s.yaw];
      const m = [i, i * 2.39 + s.center.x * 3.1, 0, 0];
      anchor.set(a, i * 4);
      meta.set(m, i * 4);
      cell.set(cellRect(i), i * 4);
      wAnchor.set([...a, ...a], i * 8);
      wMeta.set([...m, ...m], i * 8);
    });
    const boardGeo = createBoardGeometry();
    setInstanceAttributes(boardGeo, { anchor, meta, cell });
    const wireGeo = createWireGeometry();
    setInstanceAttributes(wireGeo, { anchor: wAnchor, meta: wMeta });

    const boards = new InstancedMesh(boardGeo, createBoardMaterial(atlas), n);
    const wires = new InstancedMesh(wireGeo, createWireMaterial(), n * 2);
    signs.forEach((s, i) => {
      const { board, wires: w } = matricesFor(s);
      boards.setMatrixAt(i, board);
      wires.setMatrixAt(i * 2, w[0]);
      wires.setMatrixAt(i * 2 + 1, w[1]);
    });
    for (const m of [boards, wires]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.frustumCulled = false; // sway moves them a little past the rest bounds
      m.castShadow = true;
    }
    boards.receiveShadow = true;
    boards.name = "rackSigns";
    wires.name = "rackSignWires";
    wires.raycast = noRaycast;
    return { boards, wires };
  }, [signs, atlas]);

  useEffect(
    () => () => {
      for (const m of [boards, wires]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
    [boards, wires]
  );
  useEffect(() => () => atlas.dispose(), [atlas]);
  useEffect(() => {
    if (!debug) return;
    window.__signs = { signs, TABLE_SPOTS, setSignsVisible, setHoverSign, setSpotHover, uSignsFade, uSpotSweepT };
    return () => delete window.__signs;
  }, [debug, signs]);

  // Hide while a rack / the lookbook is open (the other cases call
  // setOverlayPointsVisible from their own flows).
  useLayoutEffect(
    () =>
      collectionStore.subscribe((s, prev) => {
        if ((s.sidebarOpen && !prev.sidebarOpen) || (s.bookVisible && !prev.bookVisible))
          setSignsVisible(false);
        else if (prev.bookVisible && !s.bookVisible && !s.sidebarOpen && !s.introScreen)
          setSignsVisible(true);
      }),
    []
  );

  // Idle sweep targets: racks and table pieces, interleaved.
  const targets = useMemo(() => {
    const racks = signs.map((s) => ({ rack: s }));
    const spots = Object.values(TABLE_SPOTS).map((spot) => ({ spot }));
    const out = [];
    for (let i = 0; i < Math.max(racks.length, spots.length); i++) {
      if (racks[i]) out.push(racks[i]);
      if (spots[i]) out.push(spots[i]);
    }
    return out;
  }, [signs]);

  const state = useRef({ shown: null, idle: 0, next: 0, sweeping: false });
  useFrame((_, delta) => {
    const st = state.current;
    const shown = uSignsFade.value > 0.001;
    if (shown !== st.shown) {
      st.shown = shown;
      boards.visible = wires.visible = shown;
    }
    const clickable = signsVisible() && uSignsFade.value > 0.4;
    boards.raycast = clickable ? InstancedMesh.prototype.raycast : noRaycast;

    // Discoverability hint: every ~7 s idle at the overview, a soft light
    // sweep glides over one rack's garments or one table piece.
    const cam = useCameraStore.getState();
    const idle =
      clickable &&
      cam.preset === "default" &&
      !cam.cinematic &&
      uGlowAmt.value < 0.01 &&
      uSpotHoverAmt.value < 0.01;
    st.idle = idle ? st.idle + Math.min(delta, 0.1) : 0;
    if (st.idle > IDLE_SWEEP_EVERY && !st.sweeping) {
      st.idle = 0;
      const target = targets[st.next++ % targets.length];
      if (!target) return;
      st.sweeping = true;
      const done = () => {
        st.sweeping = false;
      };
      if (target.rack) {
        const [min, max] = sweepRange(target.rack.box);
        uSweepMin.value = min;
        uSweepMax.value = max;
        uSweepRack.value = RACK_IDS[target.rack.key];
        uSweepT.value = 0;
        gsap.to(uSweepT, {
          value: 1,
          duration: 1.8,
          ease: "sine.inOut",
          onComplete: () => {
            uSweepRack.value = -1;
            done();
          },
        });
      } else {
        uSpotSweepC.value.copy(target.spot.center);
        uSpotSweepH.value.copy(target.spot.half);
        uSpotSweepT.value = 0;
        gsap.to(uSpotSweepT, { value: 1, duration: 1.4, ease: "sine.inOut", onComplete: done });
      }
    }
  });

  const hovered = useRef(-1);
  const over = (e) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined || i === hovered.current) return;
    hovered.current = i;
    const sign = signs[i];
    setPointerCursor(true);
    setHoverSign(i);
    collectionStore.getState().setSelectedCollection(sign.key);
    if (finePointer()) {
      setGlowRack(sign.key);
      useRackHover.setState({ label: rackLabel(sign.key, sign.items) });
    }
  };
  const out = () => {
    hovered.current = -1;
    setPointerCursor(false);
    setHoverSign(-1);
    setGlowRack(null);
    collectionStore.getState().setSelectedCollection(null);
    useRackHover.setState({ label: null });
  };

  return (
    <>
      <primitive
        object={boards}
        onPointerMove={over}
        onPointerOut={out}
        onClick={(e) => {
          e.stopPropagation();
          const sign = signs[e.instanceId];
          if (!sign) return;
          out();
          openCollection(sign.key);
        }}
      />
      <primitive object={wires} />
    </>
  );
}

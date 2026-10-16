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
import {
  SALE_SCALE,
  TABLE_SPOTS,
  WIRE_X,
  layoutSaleTags,
  layoutSigns,
  rackLabel,
  sweepRange,
} from "./signLayout";
import { SALE_CELL0, cellRect, drawSignAtlas, loadSignFonts } from "./signAtlas";
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
 * (replaced the hanging garment tags). On-sale racks get a small red
 * "Sale −X%" swing tag off the board's corner (the totebag one stands on the
 * table): same instanced mesh as the boards. Draw calls: 1 (boards + sale
 * tags) + 1 (wires).
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

function saleMatrices(tag) {
  const o = new Object3D();
  o.position.copy(tag.center);
  o.rotation.set(tag.pitch, tag.yaw, 0, "YXZ");
  o.scale.setScalar(SALE_SCALE);
  o.updateMatrix();
  let string = null;
  if (tag.string) {
    const w = new Object3D();
    w.position.copy(tag.string.top);
    w.scale.set(0.6, tag.string.len + 0.004, 0.6);
    w.updateMatrix();
    string = w.matrix;
  }
  return { tag: o.matrix, string };
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
  const saleTags = useMemo(() => layoutSaleTags(signs, sale), [signs, sale]);
  const atlas = useMemo(() => drawSignAtlas(signs, null), [signs]);
  // Redraw once the brand fonts are in, and whenever the sale data changes.
  useEffect(() => {
    let alive = true;
    loadSignFonts().then(() => alive && drawSignAtlas(signs, saleTags, atlas));
    return () => {
      alive = false;
    };
  }, [signs, saleTags, atlas]);

  // Instances: boards 0..n-1, then the sale tags. `keys[i]` = what instance i
  // opens (the totebag tag opens the totebag).
  const { boards, wires, keys } = useMemo(() => {
    const n = signs.length;
    const strung = saleTags.filter((t) => t.string);
    const nb = n + saleTags.length;
    const nw = n * 2 + strung.length;
    const anchor = new Float32Array(nb * 4);
    const meta = new Float32Array(nb * 4);
    const cell = new Float32Array(nb * 4);
    const wAnchor = new Float32Array(nw * 4);
    const wMeta = new Float32Array(nw * 4);
    const metaOf = (i, x) => [i, i * 2.39 + x * 3.1, 0, 0];
    signs.forEach((s, i) => {
      const a = [s.pivot.x, s.pivot.y, s.pivot.z, s.yaw];
      const m = metaOf(i, s.center.x);
      anchor.set(a, i * 4);
      meta.set(m, i * 4);
      cell.set(cellRect(i), i * 4);
      wAnchor.set([...a, ...a], i * 8);
      wMeta.set([...m, ...m], i * 8);
    });
    let w = n * 2;
    saleTags.forEach((t, k) => {
      const i = n + k;
      const owner = signs[t.signIndex];
      // A rack's sale tag sways (and brightens) with its board.
      const a = [t.pivot.x, t.pivot.y, t.pivot.z, t.yaw];
      const m = owner ? metaOf(t.signIndex, owner.center.x) : [-9, 0, 1, 0];
      anchor.set(a, i * 4);
      meta.set(m, i * 4);
      cell.set(cellRect(SALE_CELL0 + k), i * 4);
      if (t.string) {
        wAnchor.set(a, w * 4);
        wMeta.set(m, w * 4);
        w++;
      }
    });
    const boardGeo = createBoardGeometry();
    setInstanceAttributes(boardGeo, { anchor, meta, cell });
    const wireGeo = createWireGeometry();
    setInstanceAttributes(wireGeo, { anchor: wAnchor, meta: wMeta });

    const boards = new InstancedMesh(boardGeo, createBoardMaterial(atlas), nb);
    const wires = new InstancedMesh(wireGeo, createWireMaterial(), nw);
    signs.forEach((s, i) => {
      const { board, wires: ww } = matricesFor(s);
      boards.setMatrixAt(i, board);
      wires.setMatrixAt(i * 2, ww[0]);
      wires.setMatrixAt(i * 2 + 1, ww[1]);
    });
    w = n * 2;
    saleTags.forEach((t, k) => {
      const { tag, string } = saleMatrices(t);
      boards.setMatrixAt(n + k, tag);
      if (string) wires.setMatrixAt(w++, string);
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
    const keys = [...signs.map((s, i) => i), ...saleTags.map((t) => (t.signIndex >= 0 ? t.signIndex : "totebag"))];
    return { boards, wires, keys };
  }, [signs, saleTags, atlas]);

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
    window.__signs = { signs, saleTags, boards, TABLE_SPOTS, setSignsVisible, setHoverSign, setSpotHover, uSignsFade, uSpotSweepT };
    return () => delete window.__signs;
  }, [debug, signs, saleTags, boards]);

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
    const k = keys[e.instanceId];
    if (k === undefined || k === hovered.current) return;
    hovered.current = k;
    if (k === "totebag") {
      setPointerCursor(true);
      collectionStore.getState().setSelectedCollection("totebag");
      if (finePointer()) {
        setSpotHover(TABLE_SPOTS.totebag);
        useRackHover.setState({ label: TABLE_SPOTS.totebag.label });
      }
      return;
    }
    const i = k;
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
    setSpotHover(null);
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
          const k = keys[e.instanceId];
          if (k === undefined) return;
          out();
          openCollection(k === "totebag" ? "totebag" : signs[k].key);
        }}
      />
      <primitive object={wires} />
    </>
  );
}

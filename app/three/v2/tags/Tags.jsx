"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, Vector3 } from "three/webgpu";
import gsap from "gsap";
import { useSaleHandles } from "@/lib/sale";
import collectionStore from "../../../stores/collectionStore";
import useCameraStore from "../../../stores/cameraStore";
import { useClothingItems } from "../Clothes";
import useDebug from "../debug/useDebug";
import { openCollection, setPointerCursor } from "../interactions";
import { layoutTags, rackLabel, sweepRange, TAG_HOLE } from "./tagLayout";
import { cellRect, drawTagAtlas, loadTagFonts } from "./tagAtlas";
import {
  createHitGeometry,
  createStringGeometry,
  createStringMaterial,
  createTagGeometry,
  createTagMaterial,
  setInstanceAttributes,
} from "./tagMesh";
import {
  RACK_IDS,
  finePointer,
  setGlowRack,
  setHoverTag,
  setTagsVisible,
  tagsVisible,
  uGlowAmt,
  uSweepMax,
  uSweepMin,
  uSweepRack,
  uSweepT,
  uTagsFade,
  useRackHover,
} from "./tagState";

/*
 * In-world hanging garment tags (replace the old DOM hotspot dots).
 * Draw calls: 1 (cards, InstancedMesh) + 1 (strings). The hit boxes are an
 * invisible InstancedMesh (raycast only, never drawn).
 */

const IDLE_SWEEP_EVERY = 8; // s at the overview before the next light sweep
const noRaycast = () => null;

/** What clicking a tag does: same as its rack / table hotspot. */
function activate(tag) {
  setHoverTag(-1);
  setGlowRack(null);
  useRackHover.setState({ label: null });
  setPointerCursor(false);
  if (tag.key === "coffee") {
    useCameraStore.getState().setCinematic(true);
  } else if (tag.key === "lookbook") {
    if (collectionStore.getState().bookVisible) return;
    const camera = useCameraStore.getState();
    camera.setCameraPosition(new Vector3(0, -0.5, 1.9));
    camera.setCameraTarget(new Vector3(0, -5, 0));
    collectionStore.getState().setBookVisible(true);
  } else {
    openCollection(tag.key);
  }
}

function matricesFor(tag) {
  const o = new Object3D();
  o.position.copy(tag.anchor);
  o.rotation.set(tag.pitch, tag.yaw, 0, "YXZ");
  o.updateMatrix();
  const down = new Matrix4().makeTranslation(0, -tag.string, 0);
  const s = tag.scale;
  const card = o.matrix.clone().multiply(down).multiply(new Matrix4().makeScale(s, s, s));
  // String: from the anchor to the eyelet (hole sits at the card origin).
  const string = o.matrix.clone().multiply(new Matrix4().makeScale(1, tag.string + TAG_HOLE * 0.2, 1));
  return { card, string };
}

export default function Tags({ isMobile = false }) {
  const debug = useDebug();
  const groups = useClothingItems();
  const sale = useSaleHandles();
  const tags = useMemo(() => layoutTags(groups, { isMobile }), [groups, isMobile]);

  const atlas = useMemo(() => drawTagAtlas(tags, null), [tags]);
  // Redraw once the brand fonts are in, and whenever the sale data changes.
  useEffect(() => {
    let alive = true;
    loadTagFonts().then(() => alive && drawTagAtlas(tags, sale, atlas));
    return () => {
      alive = false;
    };
  }, [tags, sale, atlas]);

  const { cards, strings, hits } = useMemo(() => {
    const n = tags.length;
    const anchor = new Float32Array(n * 4);
    const meta = new Float32Array(n * 4);
    const cell = new Float32Array(n * 4);
    tags.forEach((t, i) => {
      anchor.set([t.anchor.x, t.anchor.y, t.anchor.z, t.yaw], i * 4);
      meta.set([i, t.sway, i * 2.39 + t.anchor.x * 3.1, 0], i * 4);
      cell.set(cellRect(i), i * 4);
    });
    const cardGeo = createTagGeometry();
    setInstanceAttributes(cardGeo, { anchor, meta, cell });
    const stringGeo = createStringGeometry();
    setInstanceAttributes(stringGeo, { anchor, meta });

    const cards = new InstancedMesh(cardGeo, createTagMaterial(atlas), n);
    const strings = new InstancedMesh(stringGeo, createStringMaterial(), n);
    const hits = new InstancedMesh(createHitGeometry(), new MeshBasicMaterial({ visible: false }), n);
    tags.forEach((t, i) => {
      const { card, string } = matricesFor(t);
      cards.setMatrixAt(i, card);
      hits.setMatrixAt(i, card);
      strings.setMatrixAt(i, string);
    });
    for (const m of [cards, strings, hits]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.frustumCulled = false; // sway moves them a little past the rest bounds
    }
    cards.name = "garmentTags";
    strings.name = "garmentTagStrings";
    hits.name = "garmentTagHits";
    cards.castShadow = strings.castShadow = true;
    cards.receiveShadow = true;
    cards.raycast = strings.raycast = noRaycast;
    return { cards, strings, hits };
  }, [tags, atlas]);

  useEffect(
    () => () => {
      for (const m of [cards, strings, hits]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
    [cards, strings, hits]
  );
  useEffect(() => () => atlas.dispose(), [atlas]);
  useEffect(() => {
    if (!debug) return;
    window.__tags = { tags, setTagsVisible, setHoverTag, setGlowRack, uTagsFade };
    return () => delete window.__tags;
  }, [debug, tags]);

  // Hide while a rack / the lookbook is open (the other cases call
  // setOverlayPointsVisible from their own flows).
  useLayoutEffect(
    () =>
      collectionStore.subscribe((s, prev) => {
        if ((s.sidebarOpen && !prev.sidebarOpen) || (s.bookVisible && !prev.bookVisible))
          setTagsVisible(false);
        else if (prev.bookVisible && !s.bookVisible && !s.sidebarOpen && !s.introScreen)
          setTagsVisible(true);
      }),
    []
  );

  // Visibility / raycast follow the fade; idle light sweep over one rack.
  const state = useRef({ shown: null, idle: 0, next: 0, sweeping: false });
  useFrame((_, delta) => {
    const st = state.current;
    const shown = uTagsFade.value > 0.001;
    if (shown !== st.shown) {
      st.shown = shown;
      cards.visible = strings.visible = shown;
    }
    const clickable = tagsVisible() && uTagsFade.value > 0.4;
    hits.raycast = clickable ? InstancedMesh.prototype.raycast : noRaycast;

    // Discoverability hint: every ~8 s idle at the overview, a soft light
    // sweep glides over one rack's garments.
    const cam = useCameraStore.getState();
    const idle =
      clickable && cam.preset === "default" && !cam.cinematic && uGlowAmt.value < 0.01;
    st.idle = idle ? st.idle + Math.min(delta, 0.1) : 0;
    if (st.idle > IDLE_SWEEP_EVERY && !st.sweeping) {
      st.idle = 0;
      const racks = tags.filter((t) => t.box);
      const tag = racks[st.next++ % racks.length];
      if (!tag) return;
      const [min, max] = sweepRange(tag.box);
      uSweepMin.value = min;
      uSweepMax.value = max;
      uSweepRack.value = RACK_IDS[tag.key];
      uSweepT.value = 0;
      st.sweeping = true;
      gsap.to(uSweepT, {
        value: 1,
        duration: 1.8,
        ease: "sine.inOut",
        onComplete: () => {
          uSweepRack.value = -1;
          st.sweeping = false;
        },
      });
    }
  });

  const hovered = useRef(-1);
  const over = (e) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined || i === hovered.current) return;
    hovered.current = i;
    const tag = tags[i];
    setPointerCursor(true);
    setHoverTag(i);
    if (finePointer()) {
      if (tag.box) setGlowRack(tag.key);
      useRackHover.setState({
        label: tag.items ? rackLabel(tag.key, tag.items) : `${tag.name} · ${tag.sub}`,
      });
    }
  };
  const out = () => {
    hovered.current = -1;
    setPointerCursor(false);
    setHoverTag(-1);
    setGlowRack(null);
    useRackHover.setState({ label: null });
  };

  return (
    <>
      <primitive object={cards} />
      <primitive object={strings} />
      <primitive
        object={hits}
        onPointerMove={over}
        onPointerOut={out}
        onClick={(e) => {
          e.stopPropagation();
          const tag = tags[e.instanceId];
          if (tag) activate(tag);
          hovered.current = -1;
        }}
      />
    </>
  );
}

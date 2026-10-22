# Moos (chat brain + event bridge)

Moos is the Wooz mascot. This workstream provides the **brain** (AI route), the **chat UI** and an **event bridge** (`moosStore`) for the 3D Moos (`app/three/v2/moos/`, other workstream).

```
MoosChat.jsx  --useChat-->  POST /api/moos  --streamText-->  AI Gateway (haiku 5.5, fallback sonnet 5.5)
     |                              |__ server tools: searchProducts, getProduct (Shopify Storefront)
     |__ client tools (onToolCall): openCollection, setMood
     |
     v
moosStore (zustand)  <--subscribe--  3D Moos component
```

## API `/api/moos` (app/api/moos/route.js)

- `POST { messages: UIMessage[] }` -> AI SDK UI message stream (`toUIMessageStreamResponse`).
- Models (plain gateway strings, verified against `/v1/models`): primary `anthropic/claude-haiku-5.5`, fallback `anthropic/claude-sonnet-5.5` via `providerOptions.gateway.models`. Note the IDs use a dot (`5.5`), not a dash. Override with `MOOS_MODEL` / `MOOS_FALLBACK_MODEL`.
- Auth: AI Gateway OIDC (`VERCEL_OIDC_TOKEN` in `.env.local` locally, automatic on Vercel) or `AI_GATEWAY_API_KEY`. No provider SDK needed.
- Limits: 15 req/min per IP (in-memory, **dev only**: use Upstash Ratelimit / Vercel Firewall in production), 500 chars per user message (413), last 20 messages, `isStepCount(4)`, `maxOutputTokens: 400`. Errors: 429 `rate_limited`, 413 `too_long`, 400 `bad_request`.
- Persona (Dutch default, switches to English), 1-3 sentences, never invents products/prices, refuses off-topic politely.

### Tools

| tool | where | notes |
|---|---|---|
| `searchProducts({query?})` | server | Shopify `products(query)`; returns name, handle, price, colors, sizes, inStock |
| `getProduct({handle})` | server | handles = `longsleeve`, `polo`, `splatter`, `hoodie` |
| `openCollection({type, color?})` | client | calls `openCollection(type)` from `three/v2/interactions.js` (camera + sidebar). On mobile the chat closes so the rack is visible |
| `setMood({animation})` | client | `idle`/`talk`/`wave`/`think`/`happy`, timed override of 2.5s |

**No `addToCart` tool** (deliberate): a model-driven purchase action is a trust/abuse risk and the sidebar already has a clear Add-to-Cart flow with size/colour selection. Moos sends people to the product panel instead. Can be added later as a client tool that requires an explicit UI confirmation button (`addToolOutput` after a click, never auto).

## Event bridge `app/stores/moosStore.js`

```js
import useMoosStore from "@/app/stores/moosStore";
const anim = useMoosStore((s) => s.currentAnimation); // 'idle'|'talk'|'wave'|'think'|'happy'
```

| field | meaning |
|---|---|
| `open` | chat panel open (on open Moos waves for 2.2s) |
| `isThinking` | request sent, no text yet / tools running |
| `isTalking` | assistant text is streaming |
| `currentAnimation` | derived: talking > thinking > idle, with timed overrides (`wave` on open, `happy` after a reply, `setMood` tool) |
| `lastAction` | `{ type: 'openCollection'\|'setMood', payload, id, at }`; `id` changes on every action, use it as effect dependency |
| actions | `setOpen`, `toggleOpen`, `setAnimation(name, revertMs?)`, `setThinking`, `setTalking`, `recordAction` |

The 3D Moos should only *read* this store (and may call `setAnimation` for its own cues, e.g. `wave` when the camera arrives).

## UI `app/components/moos/MoosChat.jsx`

Mounted once in `app/page.js`. Hidden during the intro screen. Launcher sits bottom-right and moves to the bottom-left while the product sidebar is open. All colours/radii are CSS variables in the `THEME` object at the top (`--moos-*`), easy to map to `docs/UI-TOKENS.md`. `MoosAvatar` is a placeholder SVG until the 3D/portrait asset exists.

## Cost notes

Haiku-class model, <=400 output tokens, <=4 steps, 20-message window, short system prompt (~450 tokens). Gateway tags `moos` for reporting.

## 3D Moos: rig + animation (app/three/v2/moos/)

**Pipeline** (headless Blender 4.5 + gltf-transform, nothing paid):

```
Meshy GLB (A-pose) ──scripts/moos/retarget_anims.py──> moos_anims_raw.glb ──scripts/moos/optimize-moos.mjs──> public/models/v2/moos.glb
                      (imports scripts/moos/rig_moos.py)                       (KTX2 1024, meshopt, resample)   ≈1.3 MB
```

- **Skeleton** (`rig_moos.py`): same bone names/hierarchy as the Quaternius Universal Animation Library (UAL):
  `root, pelvis, spine_01..03, neck_01, Head, clavicle/upperarm/lowerarm/hand, thigh/calf/foot/ball _l/_r` (no fingers: Moos' fingers are fused).
  Joints sit on Moos' measured landmarks; every bone's rest orientation = the UAL rest orientation swung (minimal rotation, no twist) onto Moos' limb.
  So arm twist/roll follows the source rig exactly; that fixes the old wrong-way wave. Bone-heat weights, nearest-neighbour fill, hair above the jaw → `Head` only.
- **Retarget** (`retarget_anims.py`): per frame `moosWorld = ualWorld · offset` (constant per bone), pelvis translation scaled by the leg-length ratio (0.77).
- **Clips** (24 fps, all loop): `idle` (UAL1 Idle_Loop), `talk` (UAL1 Idle_Talking_Loop), `think` (UAL2 Idle_FoldArms_Loop),
  `happy` (UAL1 Dance_Loop, small groove), `walk` (UAL1 Walk_Loop in place; gaze lifted 13°), `wave` (Idle_Loop body + right arm authored in UAL space:
  arm out/up, elbow up, palm forward, 5 forearm swings per 2.5 s). The free UAL tiers have no wave.
- **Walk speed**: measured on the baked walk (planted-foot velocity) → armature extras `moosWalkSpeed` (0.7615 m/s at scale 1). Runtime walk `timeScale = speed / that`, so the feet don't skate (measured in browser: planted foot ≈3 cm/s vs 0.7 m/s walk).

Rebuild:
```
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b -P scripts/moos/retarget_anims.py -- Meshy_AI_Moos_Character_10k_1016080920_texture.glb UAL1_Standard.glb UAL2_Standard.glb moos_anims_raw.glb [--renders dir]
node scripts/moos/optimize-moos.mjs moos_anims_raw.glb public/models/v2/moos.glb   # deps in a temp dir, see header
```

**Runtime** (`Moos.jsx`, `rig.js`, `locomotion.js`, `moosBody.js`): one AnimationMixer, one action per clip, weights damped (~0.4 s crossfades)
towards `moosStore.currentAnimation` (walk overrides while moving). Additive look-at on `spine_03/neck_01/Head` after the mixer (clamped; restored before each mixer update because the mixer skips unchanged channels).
Mixer skipped while off-screen. Contact shadow + night dimming unchanged.

**Strolling** (desktop only): every 20–40 s at the overview (chat closed, no rack/lookbook/cinematic, not talking) he walks to another stop
(`home` (-1.6, 1.15), `left` (-0.6, -0.35), `back` (-0.45, -1.4), `centre` (-0.35, 0.2), via `m1` (-1.05, 0.45)), Catmull-Rom path, pure-pursuit steering, then studies a rack 3–5 s and turns to the camera.
Stops were chosen from an occupancy map of studio.glb and stay clear of the table lamp and the rack hotspot dots. Chat opens → he brakes, turns to the chat camera and waves; the `moos` camera shot follows his live position (`moosShot()` in cameraStore, clamped inside the walls; CameraRig re-aims if he moves > 5 cm). Phones: he stays at home.
`#debug`: `__moos.stroll('back')`, `__moos.state.timeScale = 0` (freeze), `__moos.state.lookOff = true`.

### Animation credits / license

Animations: **Quaternius – Universal Animation Library** (Standard) and **Universal Animation Library 2** (Standard),
https://quaternius.itch.io/universal-animation-library and https://quaternius.itch.io/universal-animation-library-2 —
**CC0 1.0** (public domain, https://creativecommons.org/publicdomain/zero/1.0/). See also `public/models/v2/CREDITS.md`.

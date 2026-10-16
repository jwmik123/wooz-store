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

Mounted once in `app/page.js`. Hidden during the intro screen. Launcher sits bottom-right above the Awwwards ribbon and moves to the bottom-left while the product sidebar is open. All colours/radii are CSS variables in the `THEME` object at the top (`--moos-*`), easy to map to `docs/UI-TOKENS.md`. `MoosAvatar` is a placeholder SVG until the 3D/portrait asset exists.

## Cost notes

Haiku-class model, <=400 output tokens, <=4 steps, 20-message window, short system prompt (~450 tokens). Gateway tags `moos` for reporting.

"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import gsap from "gsap";
import { X, ArrowUp } from "lucide-react";
import useMoosStore from "../../stores/moosStore";
import collectionStore from "../../stores/collectionStore";
import { openCollection } from "../../three/v2/interactions";
import { EASE, STAGGER, d } from "../ui/tokens";

/*
 * Moos chat panel. Styled with the Wooz tokens (docs/UI-TOKENS.md):
 * frosted .wz-glass panel, Fraunces name, Instrument Sans body, ink text,
 * mint Moos bubbles, ink user bubbles, .wz-btn-primary send.
 *
 * Layout
 *  - desktop: floating panel at --wz-panel-inset, bottom-right; it moves to the
 *    left while the shop panel (html[data-wz-panel="open"]) owns the right.
 *  - mobile (< md): bottom sheet with a drag handle (drag down to close).
 *  - sets html[data-wz-chat="open"] so the Awwwards ribbon steps aside
 *    (globals.css) and the 3D camera frames Moos (CameraRig).
 *  - the closed launcher floats above the ribbon (fixed 208 px tall iframe).
 */

const STARTERS = [
  { label: "Wat past bij mij?", text: "Wat past bij mij?" },
  { label: "Laat de hoodies zien", text: "Laat de hoodies zien" },
  { label: "Wie ben jij?", text: "Wie ben jij?" },
];

const ACTION_LABEL = {
  openCollection: (i) => {
    const names = {
      hoodie: "hoodies",
      polo: "polo's",
      longsleeve: "longsleeves",
      splatter: "splatter shirts",
    };
    return `Moos opent de ${names[i?.type] ?? i?.type ?? "collectie"}…`;
  },
  searchProducts: () => "Moos zoekt in de collectie…",
  getProduct: () => "Moos kijkt het even na…",
};

export function MoosAvatar({ size = 40 }) {
  // Portrait rendered from the rigged 3D model (scripts/moos/rig_moos.py --portrait).
  return (
    <img
      src="/assets/moos/avatar.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="object-cover rounded-full shrink-0 bg-mint ring-1 ring-white/80"
      style={{ width: size, height: size }}
    />
  );
}

function ToolNote({ part }) {
  const name = part.type.replace("tool-", "");
  const label = ACTION_LABEL[name];
  if (!label) return null; // setMood is silent
  const done = part.state === "output-available";
  return (
    <div className="flex items-center gap-2 pl-1 italic text-wz-sm text-ink-soft">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full bg-leaf ${done ? "" : "animate-pulse"}`}
      />
      {label(part.input)}
    </div>
  );
}

function Typing() {
  return (
    <div className="flex gap-1 px-3.5 py-3 w-fit rounded-wz-md rounded-bl-wz-xs bg-mint" aria-label="Moos typt">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-ink/40 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

/** Fade + lift new children of `ref` in (GSAP, respects reduced motion). */
function useRevealNew(ref, count) {
  const seen = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      seen.current = 0; // panel closed: stagger everything in again on reopen
      return;
    }
    const items = [...el.querySelectorAll("[data-reveal]")].slice(seen.current);
    seen.current = el.querySelectorAll("[data-reveal]").length;
    if (!items.length) return;
    gsap.fromTo(
      items,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: d(0.6), ease: EASE.out, stagger: STAGGER }
    );
  }, [ref, count]);
}

export default function MoosChat() {
  const open = useMoosStore((s) => s.open);
  const setOpen = useMoosStore((s) => s.setOpen);
  const sidebarOpen = collectionStore((s) => s.sidebarOpen);
  const introScreen = collectionStore((s) => s.introScreen);
  const [input, setInput] = useState("");
  const scroller = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const drag = useRef(null);

  const { messages, sendMessage, addToolOutput, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/moos" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      const moos = useMoosStore.getState();
      if (toolCall.toolName === "openCollection") {
        const { type, color } = toolCall.input;
        moos.recordAction("openCollection", { type, color });
        openCollection(type);
        // keep the chat reachable but give the rack the stage on small screens
        if (window.innerWidth < 768) moos.setOpen(false);
        addToolOutput({
          tool: "openCollection",
          toolCallId: toolCall.toolCallId,
          output: `Opened ${type} rack`,
        });
      } else if (toolCall.toolName === "setMood") {
        const { animation } = toolCall.input;
        moos.recordAction("setMood", { animation });
        moos.setAnimation(animation, 2500);
        addToolOutput({
          tool: "setMood",
          toolCallId: toolCall.toolCallId,
          output: `Mood ${animation}`,
        });
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const lastHasText =
    last?.role === "assistant" && last.parts.some((p) => p.type === "text" && p.text);

  // Bridge: chat state -> 3D Moos
  useEffect(() => {
    const m = useMoosStore.getState();
    m.setThinking(busy && !lastHasText);
    m.setTalking(status === "streaming" && lastHasText);
  }, [busy, lastHasText, status]);
  useEffect(() => {
    if (status === "ready" && last?.role === "assistant") {
      useMoosStore.getState().setAnimation("happy", 1800);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // Let the ribbon (globals.css) and the camera rig know the chat is open.
  useEffect(() => {
    const visible = open && !introScreen;
    document.documentElement.dataset.wzChat = visible ? "open" : "closed";
    return () => {
      document.documentElement.dataset.wzChat = "closed";
    };
  }, [open, introScreen]);

  // Panel entrance: slide up + fade (expo.out), content staggers in.
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    gsap.fromTo(
      panelRef.current,
      { y: mobile ? "100%" : 24, opacity: mobile ? 1 : 0 },
      { y: 0, opacity: 1, duration: d(mobile ? 0.7 : 0.6), ease: EASE.out }
    );
  }, [open]);

  useRevealNew(scroller, open ? messages.length + 1 : 0);

  // Mobile bottom sheet: drag the handle down to dismiss.
  const onHandleDown = (e) => {
    if (window.innerWidth >= 768) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y0);
    gsap.set(panelRef.current, { y: drag.current.dy });
  };
  const onHandleUp = () => {
    if (!drag.current) return;
    const { dy, t0 } = drag.current;
    const v = dy / Math.max(performance.now() - t0, 1);
    drag.current = null;
    if (dy > 110 || (dy > 30 && v > 0.6)) {
      gsap.to(panelRef.current, {
        y: "100%",
        duration: d(0.35),
        ease: EASE.in,
        onComplete: () => setOpen(false),
      });
    } else {
      gsap.to(panelRef.current, { y: 0, duration: d(0.5), ease: EASE.spring });
    }
  };

  const submit = (text) => {
    const t = text.trim();
    if (!t || busy) return;
    clearError?.();
    sendMessage({ text: t });
    setInput("");
  };

  if (introScreen) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Praat met Moos"
          className={`fixed z-wz-panel wz-btn-primary wz-moos-launcher !gap-2.5 h-14 pl-1.5 pr-5 shadow-[0_10px_30px_-8px_rgb(var(--wz-ink)/0.55)] wz-focus
            transition-[transform,opacity] duration-wz-base ease-wz-out hover:scale-[1.03] active:scale-[0.97]
            right-[var(--wz-panel-inset)] bottom-[calc(208px+var(--wz-panel-inset))]
            ${sidebarOpen ? "max-md:opacity-0 max-md:pointer-events-none md:right-auto md:left-[var(--wz-panel-inset)] md:bottom-[calc(var(--wz-panel-inset)+56px)]" : ""}`}
        >
          <span className="rounded-full ring-2 ring-[rgb(var(--wz-paper)/0.9)]">
            <MoosAvatar size={42} />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-wz-sm font-semibold">Vraag Moos</span>
            <span className="block text-[11px] opacity-75">Je gids in de studio</span>
          </span>
        </button>
      )}

      {open && (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Chat met Moos"
          className={`fixed z-wz-panel flex flex-col overflow-hidden wz-glass text-ink
            inset-x-0 bottom-0 h-[64dvh] rounded-t-wz-xl
            md:inset-x-auto md:h-[min(560px,calc(100dvh-6rem))] md:w-[380px] md:rounded-wz-xl md:bottom-[var(--wz-panel-inset)]
            ${sidebarOpen ? "md:left-[var(--wz-panel-inset)]" : "md:right-[var(--wz-panel-inset)]"}`}
        >
          {/* Header (drag zone on mobile) */}
          <div
            className="shrink-0 touch-none md:touch-auto"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
              <span className="h-1.5 w-11 rounded-full bg-ink/15" />
            </div>
            <header className="flex items-center gap-3 px-4 pt-2 pb-3 md:pt-4 md:px-5 border-b border-[color:var(--wz-line)]">
              <MoosAvatar size={40} />
              <div className="flex-1 min-w-0">
                <div className="wz-eyebrow">Wooz-gids</div>
                <div className="text-wz-lg wz-display leading-tight">
                  Moos
                  <span className="ml-2 align-middle text-wz-sm font-sans font-normal tracking-normal text-ink-soft">
                    {busy ? "typt…" : "online"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sluit chat"
                className="wz-icon-btn"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            </header>
          </div>

          <div
            ref={scroller}
            className="flex-1 px-4 py-4 space-y-3 overflow-y-auto md:px-5 wz-no-scrollbar overscroll-contain"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="wz-eyebrow" data-reveal>Moos</div>
                <div
                  data-reveal
                  className="px-4 py-2.5 text-wz-base rounded-wz-md rounded-tl-wz-xs w-fit max-w-[88%] bg-mint text-ink"
                >
                  Hoi! Ik ben Moos. Zin om samen door de studio te struinen?
                </div>
                <div className="flex flex-wrap gap-2 pt-1" data-reveal>
                  {STARTERS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => submit(s.text)}
                      className="h-9 px-3.5 text-wz-sm font-medium rounded-full bg-paper/80 text-ink border border-[color:var(--wz-line-strong)] wz-focus transition-colors duration-wz-fast ease-wz-out hover:bg-mint"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const user = m.role === "user";
              return (
                <div
                  key={m.id}
                  data-reveal
                  className={`flex flex-col gap-1.5 ${user ? "items-end" : "items-start"}`}
                >
                  {m.parts.map((p, i) => {
                    if (p.type === "text") {
                      if (!p.text) return null;
                      return (
                        <div
                          key={i}
                          className={`px-4 py-2.5 text-wz-base rounded-wz-md max-w-[88%] whitespace-pre-wrap ${
                            user
                              ? "bg-ink text-paper rounded-br-wz-xs"
                              : "bg-mint text-ink rounded-tl-wz-xs"
                          }`}
                        >
                          {p.text}
                        </div>
                      );
                    }
                    if (p.type.startsWith("tool-")) return <ToolNote key={i} part={p} />;
                    return null;
                  })}
                </div>
              );
            })}

            {busy && !lastHasText && <Typing />}

            {error && (
              <div className="text-wz-sm text-danger" role="alert">
                {/rate|429|Te veel/i.test(error.message)
                  ? "Even rustig aan, ik heb even tijd nodig. Probeer het zo opnieuw."
                  : "Oeps, mijn verbinding hapert. Probeer het nog eens."}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-center gap-2 p-3 md:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[color:var(--wz-line)]"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Vraag Moos iets…"
              aria-label="Bericht aan Moos"
              className="flex-1 min-w-0 h-11 px-4 text-wz-base rounded-full bg-paper/90 text-ink placeholder:text-ink-soft/80 border border-[color:var(--wz-line-strong)] outline-none transition-shadow duration-wz-fast ease-wz-out focus:shadow-wz-focus"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Verstuur"
              className="w-11 h-11 wz-btn-primary shrink-0 disabled:opacity-40"
            >
              <ArrowUp className="w-5 h-5" strokeWidth={2} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

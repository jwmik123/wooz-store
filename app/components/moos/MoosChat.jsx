"use client";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { X, ArrowUp } from "lucide-react";
import useMoosStore from "../../stores/moosStore";
import collectionStore from "../../stores/collectionStore";
import { openCollection } from "../../three/v2/interactions";

/* Restyle here: all colours/radii come from these CSS variables. */
const THEME = {
  "--moos-bg": "#fbf8f4",
  "--moos-surface": "#ffffff",
  "--moos-ink": "#2b2a33",
  "--moos-muted": "#8b8794",
  "--moos-accent": "#9fd8c4", // mint (hoodie)
  "--moos-accent-ink": "#1f4a3d",
  "--moos-user": "#2b2a33",
  "--moos-user-ink": "#ffffff",
  "--moos-border": "rgba(43,42,51,0.08)",
  "--moos-radius": "22px",
  "--moos-shadow": "0 18px 50px -12px rgba(43,42,51,0.28)",
};

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
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size, background: "#dff1e9" }}
    />
  );
}

function ToolNote({ part }) {
  const name = part.type.replace("tool-", "");
  const label = ACTION_LABEL[name];
  if (!label) return null; // setMood is silent
  const done = part.state === "output-available";
  return (
    <div className="flex items-center gap-2 text-xs italic" style={{ color: "var(--moos-muted)" }}>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${done ? "" : "animate-pulse"}`}
        style={{ background: "var(--moos-accent)" }}
      />
      {label(part.input)}
    </div>
  );
}

function Typing() {
  return (
    <div className="flex gap-1 px-3 py-2.5 w-fit rounded-2xl" style={{ background: "var(--moos-surface)", border: "1px solid var(--moos-border)" }}>
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: "var(--moos-muted)", animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

export default function MoosChat() {
  const open = useMoosStore((s) => s.open);
  const setOpen = useMoosStore((s) => s.setOpen);
  const sidebarOpen = collectionStore((s) => s.sidebarOpen);
  const introScreen = collectionStore((s) => s.introScreen);
  const [input, setInput] = useState("");
  const scroller = useRef(null);
  const inputRef = useRef(null);

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

  const submit = (text) => {
    const t = text.trim();
    if (!t || busy) return;
    clearError?.();
    sendMessage({ text: t });
    setInput("");
  };

  if (introScreen) return null;

  // the sidebar occupies the right side: slide the launcher out of its way
  const side = sidebarOpen ? "left-4 md:left-4" : "right-4 md:right-6";

  return (
    <div style={THEME} className="contents">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Praat met Moos"
          className={`fixed z-40 bottom-28 ${side} flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95`}
          style={{
            background: "var(--moos-surface)",
            color: "var(--moos-ink)",
            boxShadow: "var(--moos-shadow)",
            border: "1px solid var(--moos-border)",
          }}
        >
          <MoosAvatar size={40} />
          <span className="text-sm font-medium">Vraag Moos</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Chat met Moos"
          className={`fixed z-40 flex flex-col overflow-hidden bottom-0 inset-x-0 h-[75vh] md:h-[520px] md:bottom-28 md:inset-x-auto ${
            sidebarOpen ? "md:left-4" : "md:right-6"
          } md:w-[380px] rounded-t-[var(--moos-radius)] md:rounded-[var(--moos-radius)]`}
          style={{
            background: "var(--moos-bg)",
            color: "var(--moos-ink)",
            boxShadow: "var(--moos-shadow)",
            border: "1px solid var(--moos-border)",
          }}
        >
          <header className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--moos-border)" }}>
            <MoosAvatar size={36} />
            <div className="flex-1 leading-tight">
              <div className="text-sm font-semibold">Moos</div>
              <div className="text-xs" style={{ color: "var(--moos-muted)" }}>
                {busy ? "typt…" : "Wooz-gids"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Sluit chat" className="p-1.5 rounded-full hover:bg-black/5">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div ref={scroller} className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="px-3.5 py-2.5 text-sm rounded-2xl w-fit max-w-[85%]" style={{ background: "var(--moos-surface)", border: "1px solid var(--moos-border)" }}>
                  Hoi! Ik ben Moos. Zin om samen door de studio te struinen?
                </div>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => submit(s.text)}
                      className="px-3 py-1.5 text-xs rounded-full transition-colors hover:brightness-95"
                      style={{ background: "var(--moos-accent)", color: "var(--moos-accent-ink)" }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") {
                    if (!p.text) return null;
                    const user = m.role === "user";
                    return (
                      <div
                        key={i}
                        className="px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl max-w-[85%] whitespace-pre-wrap"
                        style={
                          user
                            ? { background: "var(--moos-user)", color: "var(--moos-user-ink)" }
                            : { background: "var(--moos-surface)", border: "1px solid var(--moos-border)" }
                        }
                      >
                        {p.text}
                      </div>
                    );
                  }
                  if (p.type.startsWith("tool-")) return <ToolNote key={i} part={p} />;
                  return null;
                })}
              </div>
            ))}

            {busy && !lastHasText && <Typing />}

            {error && (
              <div className="text-xs" style={{ color: "#b4493f" }}>
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
            className="flex items-center gap-2 p-3"
            style={{ borderTop: "1px solid var(--moos-border)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Vraag Moos iets…"
              className="flex-1 px-4 py-2.5 text-sm bg-white rounded-full outline-none"
              style={{ border: "1px solid var(--moos-border)", color: "var(--moos-ink)" }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Verstuur"
              className="flex items-center justify-center w-10 h-10 rounded-full transition-opacity disabled:opacity-40"
              style={{ background: "var(--moos-user)", color: "var(--moos-user-ink)" }}
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

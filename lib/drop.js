import { create } from "zustand";
import { track } from "@vercel/analytics";

/*
 * Sale drop countdown. Until DROP_AT the greenhouse is closed: the intro ends at
 * the countdown board in the garden (app/three/v2/garden/DropBoard.jsx) instead
 * of "Step inside", and its buttons open the calendar sheet
 * (app/components/ui/DropSheet.jsx, .ics from app/api/drop.ics).
 *
 * Set NEXT_PUBLIC_DROP_AT (ISO with offset) to move it. Everything compares
 * epoch ms, so the DST switch in the night before the drop doesn't matter.
 *
 * Preview the opening moment with ?drop=30 (opens 30 s after load) or skip the
 * countdown with ?drop=open.
 */

export const DROP_AT = new Date(process.env.NEXT_PUBLIC_DROP_AT || "2026-10-25T15:00:00+01:00");

/*
 * Human copy, fixed to Amsterdam time so every visitor reads the same thing.
 * "Sunday 25 Oct · 15:00 CET" / "zondag 25 okt · 15:00 CET" and
 * "Sunday 25 October at 15:00 (Amsterdam)" / "zondag 25 oktober om 15:00 (Amsterdam)".
 */
const fmt = (locale, opts) =>
  new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { timeZone: "Europe/Amsterdam", ...opts }).format(DROP_AT);
const dropTimeOfDay = () => fmt("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const tzShort = () => (fmt("en", { timeZoneName: "short" }).match(/GMT\+2|CEST/) ? "CEST" : "CET");

export const dropLabel = (locale = "en") =>
  `${fmt(locale, { weekday: "long", day: "numeric", month: "short" }).replace(/\.$/, "")} · ${dropTimeOfDay()} ${tzShort()}`;
export const dropLong = (locale = "en") =>
  `${fmt(locale, { weekday: "long", day: "numeric", month: "long" })} ${locale === "nl" ? "om" : "at"} ${dropTimeOfDay()} (Amsterdam)`;

export const DROP_LABEL = dropLabel("en");
export const DROP_LONG = dropLong("en");

/** How long the board plays its opening act before "Step inside" shows. */
const OPENING_MS = 4200;

let dropMs = DROP_AT.getTime();
if (typeof window !== "undefined") {
  const q = new URLSearchParams(window.location.search).get("drop");
  if (q === "open") dropMs = 0;
  else if (q && Number.isFinite(+q)) dropMs = Date.now() + +q * 1000;
}

/** Drop time in epoch ms (with the ?drop override applied). */
export const dropTime = () => dropMs;

const phaseAt = (now) => (now < dropMs ? "before" : now < dropMs + OPENING_MS ? "opening" : "open");

/**
 * phase   "before" → countdown, "opening" → the board's T-0 act, "open" → normal site.
 * closed  the session started before the drop (the board stays up afterwards,
 *         showing NOW OPEN, until the next page load).
 * sheet   which calendar sheet is open: null | "calendar" | "remind".
 */
export const useDropStore = create((set) => {
  const initial = typeof window === "undefined" ? "before" : phaseAt(Date.now());
  if (typeof window !== "undefined" && initial !== "open") {
    const schedule = () => {
      const now = Date.now();
      const phase = phaseAt(now);
      set({ phase });
      if (phase === "open") return;
      const next = phase === "before" ? dropMs : dropMs + OPENING_MS;
      // Timers drift / pause in background tabs: re-check at most every minute.
      setTimeout(schedule, Math.min(60_000, Math.max(16, next - now)));
    };
    setTimeout(schedule, 0);
  }
  return {
    phase: initial,
    closed: initial !== "open",
    sheet: null,
    openSheet: (sheet) => {
      track("drop_button", { button: sheet });
      set({ sheet });
    },
    closeSheet: () => set({ sheet: null }),
  };
});

/** True while the greenhouse is still closed (countdown or the opening act). */
export const useDropClosed = () => useDropStore((s) => s.phase !== "open");

const gcalStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Google Calendar "new event" link (Google ignores alarms from links). */
export function googleCalendarUrl({ title = "Wooz sale drop", details = "The Wooz greenhouse opens for the sale drop. https://wooz.store" } = {}) {
  const start = DROP_AT.getTime();
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${gcalStamp(start)}/${gcalStamp(start + 2 * 3600e3)}`,
    details,
    location: "https://wooz.store",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

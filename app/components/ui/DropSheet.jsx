"use client";

import { useEffect, useRef } from "react";
import { AlarmClock, CalendarPlus, X } from "lucide-react";
import { track } from "@vercel/analytics";
import { dropLong, googleCalendarUrl, useDropStore } from "@/lib/drop";
import { useLocale, useT } from "@/lib/i18n";

/*
 * Bottom sheet behind the two push-buttons on the countdown board
 * (three/v2/garden/DropBoard.jsx). A website can't set an alarm in the phone's
 * clock app, so "Remind me" is a calendar event with alerts (.ics VALARM) too.
 */

const ICS = "/api/drop.ics";

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

function options(kind, t, locale) {
  const ics = `${ICS}?lang=${locale}`;
  if (kind === "remind")
    return [
      { key: "early", title: t("drop.early"), note: t("drop.earlyNote"), href: `${ics}&remind=early` },
      { key: "open", title: t("drop.openOnly"), note: t("drop.openOnlyNote"), href: `${ics}&remind=open` },
    ];
  const apple = { key: "apple", title: "Apple Calendar", note: t("drop.appleNote"), href: ics };
  const google = {
    key: "google",
    title: "Google Calendar",
    note: t("drop.googleNote"),
    href: googleCalendarUrl({ title: t("drop.gcalTitle"), details: t("drop.gcalDetails") }),
    external: true,
  };
  const outlook = { key: "outlook", title: t("drop.other"), note: t("drop.otherNote"), href: ics };
  return isAndroid() ? [google, apple, outlook] : [apple, google, outlook];
}

export default function DropSheet() {
  const sheet = useDropStore((s) => s.sheet);
  const close = useDropStore((s) => s.closeSheet);
  const panel = useRef(null);
  const t = useT();
  const locale = useLocale();
  const open = !!sheet;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector("a")?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const remind = sheet === "remind";
  const Icon = remind ? AlarmClock : CalendarPlus;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-wz-base ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="false"
        aria-labelledby="wz-drop-sheet-title"
        aria-hidden={!open}
        inert={!open || undefined}
        className={`fixed z-[61] left-1/2 bottom-0 w-[min(100%-1.5rem,26rem)] -translate-x-1/2 wz-glass rounded-t-wz-lg px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-wz-lg transition-transform duration-wz-slow ease-wz-out ${
          open ? "translate-y-0" : "translate-y-[110%]"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <h2 id="wz-drop-sheet-title" className="wz-display text-wz-xl leading-tight">
              {remind ? t("drop.remindTitle") : t("drop.calendarTitle")}
            </h2>
            <p className="text-wz-sm text-ink-soft">{t("drop.opens", { date: dropLong(locale) })}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("chrome.close")}
            className="grid shrink-0 w-9 h-9 rounded-full place-items-center bg-ink/5 hover:bg-ink/10 wz-focus"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {(sheet ? options(sheet, t, locale) : []).map((o) => (
            <li key={o.key}>
              <a
                href={o.href}
                {...(o.external ? { target: "_blank", rel: "noopener" } : {})}
                onClick={() => {
                  track("calendar_add", { sheet, option: o.key });
                  setTimeout(close, 300);
                }}
                className="flex items-center gap-3 p-3 transition-colors bg-white/70 rounded-wz-md hover:bg-white wz-focus min-h-[56px]"
              >
                <span className="grid shrink-0 w-9 h-9 rounded-wz-sm place-items-center bg-[rgb(var(--wz-mint))] text-ink">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-semibold text-wz-base leading-tight">{o.title}</span>
                  <span className="text-xs text-ink-soft">{o.note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

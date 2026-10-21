import { DROP_AT } from "@/lib/drop";

/*
 * Calendar file for the sale drop (lib/drop.js). Served inline as text/calendar,
 * so iOS / macOS open the "Add event" sheet straight away and Android / Outlook
 * hand it to the calendar app. The alarms are what make it a phone reminder.
 *
 *   ?remind=early  1 day + 1 hour before + at the start
 *   ?remind=open   only at the start
 *   (default)      30 min before + at the start
 */

const ALARMS = {
  early: ["-P1D", "-PT1H", "PT0M"],
  open: ["PT0M"],
  default: ["-PT30M", "PT0M"],
};

const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function GET(request) {
  const remind = new URL(request.url).searchParams.get("remind");
  const alarms = ALARMS[remind] ?? ALARMS.default;
  const start = DROP_AT;
  const end = new Date(start.getTime() + 2 * 3600e3);

  const alarm = (trigger) => [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${trigger === "PT0M" ? "The Wooz sale drop is open" : "The Wooz sale drop opens soon"}`,
    `TRIGGER:${trigger}`,
    "END:VALARM",
  ];

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wooz Studio//Sale drop//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Fixed UID: adding it twice updates the event instead of duplicating it.
    `UID:sale-drop-${stamp(start)}@wooz.store`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Wooz sale drop",
    "DESCRIPTION:The Wooz greenhouse opens for the sale drop. https://wooz.store",
    "URL:https://wooz.store",
    "LOCATION:https://wooz.store",
    ...alarms.flatMap(alarm),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="wooz-sale-drop.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}

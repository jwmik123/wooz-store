"use client";

import { useCallback } from "react";
import { create } from "zustand";

/*
 * NL / EN. The visitor's device language picks the first one (navigator.languages:
 * any "nl…" → Dutch, everything else English); the switch in the menu overrides
 * it and is remembered (localStorage). Server render is always English, the real
 * locale lands right after hydration (still behind the loader).
 *
 *   const t = useT();  t("intro.step")            in components
 *   t("bag.items", { n: 3 })                       values / plural functions
 *   tr("hover.colours", { n })                     outside React (current locale)
 *
 * Not translated on purpose: "Sale", "Wooz Studio", product names.
 */

export const LOCALES = ["en", "nl"];
const KEY = "wz-locale";

export function detectLocale() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LOCALES.includes(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const first = langs.find((l) => /^(nl|en)\b/i.test(l || ""));
  return first && /^nl/i.test(first) ? "nl" : "en";
}

export const useLocaleStore = create((set) => ({
  locale: "en",
  /** `remember` = the visitor picked it (menu switch), not device detection. */
  setLocale: (locale, remember = false) => {
    if (!LOCALES.includes(locale)) return;
    if (remember) {
      try {
        localStorage.setItem(KEY, locale);
      } catch {
        /* storage blocked */
      }
    }
    if (typeof document !== "undefined") document.documentElement.lang = locale;
    set({ locale });
  },
}));

export const useLocale = () => useLocaleStore((s) => s.locale);
export const getLocale = () => useLocaleStore.getState().locale;

function translate(locale, key, vars) {
  const v = MESSAGES[locale]?.[key] ?? MESSAGES.en[key];
  if (v === undefined) return key;
  const s = typeof v === "function" ? v(vars ?? {}) : v;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
}

/** Translate with the current locale, outside React (event handlers, canvases). */
export const tr = (key, vars) => translate(getLocale(), key, vars);

export function useT() {
  const locale = useLocale();
  return useCallback((key, vars) => translate(locale, key, vars), [locale]);
}

/** Intl locale tag for dates / numbers. */
export const intlLocale = (locale) => (locale === "nl" ? "nl-NL" : "en-GB");

const plural = (one, many) => ({ n }) => (n === 1 ? one : many).replace("{n}", n);

const MESSAGES = {
  en: {
    "lang.label": "Language",

    "chrome.menu": "Menu",
    "chrome.soundOff": "Mute sound",
    "chrome.soundOn": "Turn sound on",
    "chrome.closeBook": "close book",
    "chrome.close": "Close",

    "menu.about": "About",
    "menu.sustainability": "Sustainability",
    "menu.terms": "Terms of Service",
    "menu.site2d": "2D Website",
    "about.title": "Our Story",
    "about.p1":
      "Creating a community through our brand by sharing happy moments together while wearing Wooz clothing. Let’s make the world a happier and healthier place.",
    "about.p2":
      "Our mission is to create items that carry a happy message that will inspire people to live a happier life so that they can share it with others.",
    "about.quote": "'A smile from you can change someone else's day!'",
    "about.p3":
      "Aiming for a fair production process which creates premium quality garments, Wooz' pieces are entirely hand made in the Netherlands. The garments are made by experienced tailors close to Wooz in the Netherlands.",
    "about.love": "LOVE",
    "sus.title": "What sustainability means to Wooz",
    "sus.p1":
      "Being sustainable is very important to us. We try to keep our footprint as small as possible. We will also continue to research and develop sustainable products to take the best care of planet earth.",
    "sus.madeTitle": "Made in Holland",
    "sus.p2":
      "The clothing of Wooz is produced in a responsible way in the Netherlands. The production is close to 'home' so it doesn't have to travel far :)",

    "intro.welcome": "Welcome to",
    "intro.closed":
      "The glasshouse is closed until the sale drop on {date}. Press a button on the sign so you don't miss it.",
    "intro.open":
      "A little glasshouse at the end of a wild garden. Wander in, try things on, take something happy home.",
    "intro.srCalendar": "Add the sale drop to your calendar",
    "intro.srRemind": "Remind me about the sale drop",
    "intro.step": "Step inside",
    "intro.stepMuted": "Step inside without sound",

    "loader.boot": "Unlocking the gate",
    "loader.assets": "Planting the garden",
    "loader.compile": "Watering the flowers",
    "loader.calibrate": "Polishing the glass",
    "loader.settle": "Letting it bloom",
    "loader.sound": "Best with sound on",
    "hint.glow": "Tap anything that glows",
    "hint.glowLong": "tap anything that glows to explore it.",

    "sale.upTo": "up to −{pct}%",
    "sale.aria": "Sale: up to {pct}% off",
    "sale.dropAria": "Sale drop: {date}",

    "drop.remindTitle": "Remind me",
    "drop.calendarTitle": "Add to calendar",
    "drop.opens": "The greenhouse opens {date}.",
    "drop.early": "A day before and an hour before",
    "drop.earlyNote": "Calendar alerts on your phone",
    "drop.openOnly": "Only when it opens",
    "drop.openOnlyNote": "One alert at 15:00",
    "drop.appleNote": "iPhone, iPad, Mac",
    "drop.googleNote": "Android, browser",
    "drop.other": "Outlook or other",
    "drop.otherNote": "Opens a calendar file",
    "drop.gcalTitle": "Wooz sale drop",
    "drop.gcalDetails": "The Wooz greenhouse opens for the sale drop. https://wooz.store",
    "board.open": "We're open · step inside",
    "board.units": ["Days", "Hours", "Min", "Sec"],
    "board.calendar": "Add to calendar",
    "board.remind": "Remind me",
    "board.flaps": "NOW OPEN",

    "bag.button": "Bag",
    "bag.open": plural("Open bag, {n} item", "Open bag, {n} items"),
    "bag.emptyTitle": "Your bag is still empty",
    "bag.emptyCopy":
      "Wander through the studio and tap a clothing rack to find something that makes you smile.",
    "bag.explore": "Explore the studio",
    "bag.title": "Your bag",
    "bag.remove": "Remove {title}",
    "bag.decrease": "Decrease quantity of {title}",
    "bag.increase": "Increase quantity of {title}",
    "bag.subtotal": "Subtotal",
    "bag.shipping": "Shipping & taxes calculated at checkout.",
    "bag.checkout": "Checkout",

    "panel.bag": "Your bag",
    "panel.product": "Product details",
    "panel.prev": "Previous collection",
    "panel.next": "Next collection",
    "panel.back": "Back to product",
    "panel.close": "Close panel (Esc)",

    "product.made": "Made in Holland",
    "product.colour": "Colour",
    "product.size": "Size",
    "product.sizeAria": "Size {size}",
    "product.pickFit": "Pick your fit",
    "product.soldOutSuffix": " (sold out)",
    "product.details": "Details",
    "product.care": "Made with care",
    "product.careCopy":
      "Every Wooz piece is handmade by experienced tailors close to home in the Netherlands, so it doesn't have to travel far. Made to carry a happy message.",
    "product.terms": "Terms of service",
    "product.error": "Couldn't load this piece right now. Please try again.",
    "product.drag": "Drag to play",
    "product.photos": "Product photos",
    "product.photoOf": "{i} of {n}",
    "product.photoAlt": "{title} photo {i}",
    "product.photo": "Photo {i}",
    "product.choosePhoto": "Choose photo",
    "product.prevPhoto": "Previous photo",
    "product.nextPhoto": "Next photo",
    "product.closePhotos": "Close photos",
    "product.view": "Product view",
    "product.viewPhotos": "Photos",
    "product.added": "Added to your bag",
    "product.adding": "Adding…",
    "product.soldOut": "Sold out",
    "product.selectSize": "Select a size",
    "product.add": "Add to bag",
    "product.loading": "Loading product",
    "product.fallbackTitle": "Product",

    "clock.aria": "Studio time: {time}. Tap to change the time, hold to fast-forward.",
    "clock.title": "Garden time",
    "clock.slider": "Time of day",
    "clock.live": "Live",
    "clock.playing": "A day in 24s",
    "clock.drag": "Drag the sun",
    "clock.pause": "Pause",
    "clock.play": "Play a day",
    "clock.now": "Now",
    "clock.psst": "Psst: hold the clock to fast-forward time.",
    "clock.night": "Night",
    "clock.sunrise": "Sunrise",
    "clock.morning": "Morning",
    "clock.midday": "Midday",
    "clock.afternoon": "Afternoon",
    "clock.golden": "Golden hour",
    "clock.dusk": "Dusk",

    "cin.tagline": "A garden full of clothes",
    "cin.design": "3D design",
    "cin.dev": "Development",
    "cin.return": "Tap anywhere to return",

    "lite.unsupported": "Your browser can't show our 3D garden.",
    "lite.error": "Something went wrong loading our 3D garden.",
    "lite.slow": "Our 3D garden is a bit too heavy for this device.",
    "lite.copy": "No worries: the full collection is waiting on our 2D website.",
    "lite.go": "Go to the 2D website",
    "lite.anyway": "Try 3D anyway",
    "shop2d.button": "Shop in 2D",
    "shop2d.label": "Open the 2D shop",
    "shop2d.loader": "Rather shop right away? Go to the 2D shop",
    "shop2d.intro": "Shop in 2D",

    "hover.colours": plural("{name} · {n} colour", "{name} · {n} colours"),
    "spot.coffee": "Watch the film",
    "spot.lookbook": "Flip through the lookbook",

    "moos.starters": [
      { label: "What suits me?", text: "What would suit me?" },
      { label: "Show me the hoodies", text: "Show me the hoodies" },
      { label: "Who are you?", text: "Who are you?" },
    ],
    "moos.collections": {
      hoodie: "hoodies",
      polo: "polos",
      longsleeve: "longsleeves",
      splatter: "splatter shirts",
    },
    "moos.opening": "Moos is opening the {name}…",
    "moos.collection": "collection",
    "moos.searching": "Moos is looking through the collection…",
    "moos.checking": "Moos is checking…",
    "moos.typing": "Moos is typing",
    "moos.statusTyping": "typing…",
    "moos.statusOnline": "online",
    "moos.chat": "Chat with Moos",
    "moos.ask": "Ask Moos",
    "moos.guide": "Your studio guide",
    "moos.eyebrow": "Wooz guide",
    "moos.close": "Close chat",
    "moos.hello": "Hi! I’m Moos. Fancy a wander through the studio together?",
    "moos.rateLimited": "Easy there — I need a moment. Try again in a bit.",
    "moos.error": "Oops, my connection hiccuped. Try again?",
    "moos.placeholder": "Ask Moos anything…",
    "moos.inputAria": "Message to Moos",
    "moos.send": "Send",
  },

  nl: {
    "lang.label": "Taal",

    "chrome.menu": "Menu",
    "chrome.soundOff": "Geluid uit",
    "chrome.soundOn": "Geluid aan",
    "chrome.closeBook": "boek sluiten",
    "chrome.close": "Sluiten",

    "menu.about": "Over ons",
    "menu.sustainability": "Duurzaamheid",
    "menu.terms": "Algemene voorwaarden",
    "menu.site2d": "2D-website",
    "about.title": "Ons verhaal",
    "about.p1":
      "Met ons merk bouwen we aan een community door samen vrolijke momenten te delen in Wooz-kleding. Laten we de wereld een stukje blijer en gezonder maken.",
    "about.p2":
      "Onze missie is kleding maken met een vrolijke boodschap, die mensen inspireert om blijer te leven en dat geluk met anderen te delen.",
    "about.quote": "'Jouw glimlach kan de dag van een ander maken!'",
    "about.p3":
      "We streven naar een eerlijk productieproces met kleding van topkwaliteit: elk stuk van Wooz is volledig met de hand gemaakt in Nederland, door ervaren kleermakers dicht bij Wooz.",
    "about.love": "LIEFS",
    "sus.title": "Wat duurzaamheid betekent voor Wooz",
    "sus.p1":
      "Duurzaamheid is voor ons heel belangrijk. We houden onze voetafdruk zo klein mogelijk en blijven onderzoek doen naar duurzame producten, om zo goed mogelijk voor de aarde te zorgen.",
    "sus.madeTitle": "Gemaakt in Nederland",
    "sus.p2":
      "Wooz-kleding wordt op een verantwoorde manier in Nederland gemaakt. De productie zit dicht bij 'huis', dus het hoeft niet ver te reizen :)",

    "intro.welcome": "Welkom bij",
    "intro.closed":
      "De kas is dicht tot de sale drop op {date}. Druk op een knop op het bord, dan mis je hem niet.",
    "intro.open":
      "Een kleine glazen kas aan het eind van een wilde tuin. Loop binnen, pas wat je leuk vindt en neem iets vrolijks mee naar huis.",
    "intro.srCalendar": "Zet de sale drop in je agenda",
    "intro.srRemind": "Herinner me aan de sale drop",
    "intro.step": "Stap binnen",
    "intro.stepMuted": "Stap binnen zonder geluid",

    "loader.boot": "Het hek gaat open",
    "loader.assets": "De tuin wordt geplant",
    "loader.compile": "De bloemen krijgen water",
    "loader.calibrate": "Het glas wordt gepoetst",
    "loader.settle": "Alles komt in bloei",
    "loader.sound": "Het mooist met geluid aan",
    "hint.glow": "Tik op alles wat gloeit",
    "hint.glowLong": "tik op alles wat gloeit om het te ontdekken.",

    "sale.upTo": "tot −{pct}%",
    "sale.aria": "Sale: tot {pct}% korting",
    "sale.dropAria": "Sale drop: {date}",

    "drop.remindTitle": "Herinner me",
    "drop.calendarTitle": "Zet in je agenda",
    "drop.opens": "De kas gaat open op {date}.",
    "drop.early": "Een dag en een uur van tevoren",
    "drop.earlyNote": "Agendameldingen op je telefoon",
    "drop.openOnly": "Alleen als hij opengaat",
    "drop.openOnlyNote": "Eén melding om 15:00",
    "drop.appleNote": "iPhone, iPad, Mac",
    "drop.googleNote": "Android, browser",
    "drop.other": "Outlook of anders",
    "drop.otherNote": "Opent een agendabestand",
    "drop.gcalTitle": "Wooz sale drop",
    "drop.gcalDetails": "De kas van Wooz gaat open voor de sale drop. https://wooz.store",
    "board.open": "We zijn open · stap binnen",
    "board.units": ["Dagen", "Uren", "Min", "Sec"],
    "board.calendar": "In je agenda",
    "board.remind": "Herinner me",
    "board.flaps": "NU  OPEN",

    "bag.button": "Tas",
    "bag.open": plural("Open tas, {n} artikel", "Open tas, {n} artikelen"),
    "bag.emptyTitle": "Je tas is nog leeg",
    "bag.emptyCopy":
      "Loop door de studio en tik op een kledingrek om iets te vinden waar je blij van wordt.",
    "bag.explore": "Ontdek de studio",
    "bag.title": "Je tas",
    "bag.remove": "{title} verwijderen",
    "bag.decrease": "Minder {title}",
    "bag.increase": "Meer {title}",
    "bag.subtotal": "Subtotaal",
    "bag.shipping": "Verzendkosten en btw worden bij het afrekenen berekend.",
    "bag.checkout": "Afrekenen",

    "panel.bag": "Je tas",
    "panel.product": "Productdetails",
    "panel.prev": "Vorige collectie",
    "panel.next": "Volgende collectie",
    "panel.back": "Terug naar product",
    "panel.close": "Paneel sluiten (Esc)",

    "product.made": "Gemaakt in Nederland",
    "product.colour": "Kleur",
    "product.size": "Maat",
    "product.sizeAria": "Maat {size}",
    "product.pickFit": "Kies je maat",
    "product.soldOutSuffix": " (uitverkocht)",
    "product.details": "Details",
    "product.care": "Met zorg gemaakt",
    "product.careCopy":
      "Elk Wooz-item wordt met de hand gemaakt door ervaren kleermakers dicht bij huis in Nederland, zodat het niet ver hoeft te reizen. Gemaakt om een vrolijke boodschap uit te dragen.",
    "product.terms": "Algemene voorwaarden",
    "product.error": "Dit item kan nu niet geladen worden. Probeer het zo nog eens.",
    "product.drag": "Sleep om te spelen",
    "product.photos": "Productfoto's",
    "product.photoOf": "{i} van {n}",
    "product.photoAlt": "{title} foto {i}",
    "product.photo": "Foto {i}",
    "product.choosePhoto": "Kies een foto",
    "product.prevPhoto": "Vorige foto",
    "product.nextPhoto": "Volgende foto",
    "product.closePhotos": "Foto's sluiten",
    "product.view": "Productweergave",
    "product.viewPhotos": "Foto's",
    "product.added": "In je tas gestopt",
    "product.adding": "Toevoegen…",
    "product.soldOut": "Uitverkocht",
    "product.selectSize": "Kies een maat",
    "product.add": "In mijn tas",
    "product.loading": "Product laden",
    "product.fallbackTitle": "Product",

    "clock.aria": "Studiotijd: {time}. Tik om de tijd te veranderen, houd vast om door te spoelen.",
    "clock.title": "Tuintijd",
    "clock.slider": "Tijd van de dag",
    "clock.live": "Live",
    "clock.playing": "Een dag in 24s",
    "clock.drag": "Sleep de zon",
    "clock.pause": "Pauze",
    "clock.play": "Speel een dag af",
    "clock.now": "Nu",
    "clock.psst": "Psst: houd de klok vast om de tijd door te spoelen.",
    "clock.night": "Nacht",
    "clock.sunrise": "Zonsopgang",
    "clock.morning": "Ochtend",
    "clock.midday": "Middag",
    "clock.afternoon": "Namiddag",
    "clock.golden": "Gouden uur",
    "clock.dusk": "Schemering",

    "cin.tagline": "Een tuin vol kleren",
    "cin.design": "3D-ontwerp",
    "cin.dev": "Development",
    "cin.return": "Tik ergens om terug te gaan",

    "lite.unsupported": "Je browser kan onze 3D-tuin niet laten zien.",
    "lite.error": "Er ging iets mis bij het laden van onze 3D-tuin.",
    "lite.slow": "Onze 3D-tuin is iets te zwaar voor dit apparaat.",
    "lite.copy": "Geen zorgen: de hele collectie staat klaar op onze 2D-website.",
    "lite.go": "Naar de 2D-website",
    "lite.anyway": "Toch 3D proberen",
    "shop2d.button": "Shop in 2D",
    "shop2d.label": "Open de 2D-shop",
    "shop2d.loader": "Liever meteen shoppen? Naar de 2D-shop",
    "shop2d.intro": "Shop in 2D",

    "hover.colours": plural("{name} · {n} kleur", "{name} · {n} kleuren"),
    "spot.coffee": "Bekijk de film",
    "spot.lookbook": "Blader door het lookbook",

    "moos.starters": [
      { label: "Wat past bij mij?", text: "Wat zou mij goed staan?" },
      { label: "Laat de hoodies zien", text: "Laat me de hoodies zien" },
      { label: "Wie ben jij?", text: "Wie ben jij?" },
    ],
    "moos.collections": {
      hoodie: "hoodies",
      polo: "polo's",
      longsleeve: "longsleeves",
      splatter: "splatter-shirts",
    },
    "moos.opening": "Moos opent de {name}…",
    "moos.collection": "collectie",
    "moos.searching": "Moos kijkt door de collectie…",
    "moos.checking": "Moos zoekt het even op…",
    "moos.typing": "Moos typt",
    "moos.statusTyping": "typt…",
    "moos.statusOnline": "online",
    "moos.chat": "Chat met Moos",
    "moos.ask": "Vraag Moos",
    "moos.guide": "Je gids in de studio",
    "moos.eyebrow": "Wooz-gids",
    "moos.close": "Chat sluiten",
    "moos.hello": "Hoi! Ik ben Moos. Zin om samen door de studio te struinen?",
    "moos.rateLimited": "Rustig aan, ik heb even een momentje nodig. Probeer het zo nog eens.",
    "moos.error": "Oeps, mijn verbinding hikte even. Nog een keer?",
    "moos.placeholder": "Vraag Moos maar raak…",
    "moos.inputAria": "Bericht aan Moos",
    "moos.send": "Verstuur",
  },
};

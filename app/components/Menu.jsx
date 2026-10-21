"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Instagram, Facebook, X } from "lucide-react";
import { LOCALES, useLocaleStore, useT } from "@/lib/i18n";

const Menu = ({
  isNavOpen,
  setIsNavOpen,
  navRef,
  navContainer,
  openModel,
  setOpenModel,
}) => {
  const linkRefs = useRef([]);
  const modelRef = useRef(null);

  const [modelInfo, setModelInfo] = useState([]);
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  useEffect(() => {
    if (openModel) {
      gsap.to(modelRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.3,
      });
    }

    if (!openModel) {
      gsap.to(modelRef.current, {
        y: "150%",
        opacity: 0,
        duration: 0.3,
      });
    }

    if (isNavOpen) {
      gsap.fromTo(
        linkRefs.current,
        {
          opacity: 0,
          y: 50,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          delay: 0.4,
          stagger: 0.2,
        }
      );
    }
  }, [isNavOpen, openModel]);

  return (
    <>
      <nav
        ref={navContainer}
        className={`fixed inset-0 z-40 w-full h-full transition-transform duration-700 ease-wz-out text-ink pointer-events-none ${
          isNavOpen
            ? "-translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* <div
        className={`absolute top-0 left-0 w-full h-full transition-opacity delay-500 duration-200 bg-black ${
          isNavOpen ? "opacity-30" : "opacity-0"
        }`}
        onClick={toggleNav}
      ></div> */}
        <div
          ref={navRef}
          className="fixed z-10 overflow-hidden wz-glass top-[calc(var(--wz-banner-h)+var(--wz-panel-inset))] bottom-[var(--wz-panel-inset)] left-[var(--wz-panel-inset)] w-[calc(100%-2*var(--wz-panel-inset))] md:w-[460px] rounded-wz-xl"
        >
          <div className="flex flex-col justify-center h-full gap-5">
            <div className="flex flex-col">
              {["About", "Sustainability"].map((path, index) => (
                <div
                  key={path}
                  className="px-8 py-3 overflow-hidden text-5xl wz-display transition-colors duration-wz-base hover:text-primary"
                >
                  <div
                    ref={(el) => (linkRefs.current[index] = el)}
                    className="flex items-center justify-between w-full opacity-100 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
                    }}
                    onClick={() => {
                      setIsNavOpen(false);
                      setOpenModel(true);
                      setModelInfo(path);
                    }}
                  >
                    {t(path === "About" ? "menu.about" : "menu.sustainability")}
                  </div>
                </div>
              ))}
            </div>
            <div
              ref={(el) => (linkRefs.current[4] = el)}
              className="flex flex-col gap-2 pt-16 mx-8 text-wz-sm text-ink-soft"
            >
              <Link
                data-animation-link="no-animation"
                className="transition-all duration-200 hover:font-bold"
                target="_blank"
                href="https://shop.wooz.store/policies/terms-of-service"
              >
                {t("menu.terms")}
              </Link>
              <Link
                data-animation-link="no-animation"
                className="transition-all duration-200 hover:font-bold"
                href="https://shop.wooz.store/"
                target="_blank"
              >
                {t("menu.site2d")}
              </Link>
              <div
                role="radiogroup"
                aria-label={t("lang.label")}
                className="flex items-center gap-1 p-1 mt-8 rounded-full w-fit wz-glass-chip"
              >
                {LOCALES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={locale === l}
                    lang={l}
                    onClick={() => setLocale(l, true)}
                    className={`h-8 px-3.5 rounded-full text-xs font-semibold tracking-wide transition-colors duration-wz-fast wz-focus ${
                      locale === l ? "bg-ink text-paper" : "text-ink hover:bg-ink/5"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Link
                  href="https://www.instagram.com/woozclothing/"
                  target="_blank"
                >
                  <Instagram className="w-6 h-6 stroke-2" />
                </Link>
                <Link
                  href="https://www.facebook.com/Woozclothing"
                  target="_blank"
                >
                  <Facebook className="w-6 h-6 stroke-2" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div
        ref={modelRef}
        className="fixed z-30 inset-x-4 inset-y-24 md:inset-[120px] lg:inset-[160px] wz-glass rounded-wz-xl translate-y-[150%] opacity-0 overflow-y-auto wz-no-scrollbar"
      >
        <button
          type="button"
          aria-label={t("chrome.close")}
          className="absolute z-10 wz-icon-btn top-3 right-3"
          onClick={() => {
            setOpenModel(false);
          }}
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>

        <div className="flex flex-col h-full gap-2 text-ink">
          {modelInfo === "About" && (
            <div className="flex flex-col items-center justify-center h-full px-1 text-center md:px-24">
              <h1 className="mb-6 text-2xl sm:text-3xl md:text-5xl wz-display">
                {t("about.title")}
              </h1>
              <div className="text-sm md:text-lg max-w-prose mx-auto text-ink-soft">
                <p className="mb-4">{t("about.p1")}</p>
                <br />
                <p>{t("about.p2")}</p>{" "}
                <br />
                <p className="italic">
                  {t("about.quote")}
                </p>
                <p>
                  {" "}
                  <br />
                  {t("about.p3")} <br /> <br />
                  <span className="font-bold ">{t("about.love")}</span>
                </p>
              </div>
            </div>
          )}
          {modelInfo === "Sustainability" && (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center md:px-24">
              <h1 className="mb-6 text-2xl sm:text-3xl md:text-5xl wz-display">
                {t("sus.title")}
              </h1>
              <p className="text-sm md:text-lg max-w-prose mx-auto text-ink-soft">
                {t("sus.p1")}
              </p>

              <h1 className="mt-10 mb-6 text-2xl sm:text-3xl md:text-4xl wz-display">
                {t("sus.madeTitle")}
              </h1>
              <p className="text-sm md:text-lg max-w-prose mx-auto text-ink-soft">
                {t("sus.p2")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Menu;

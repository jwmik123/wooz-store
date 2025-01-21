"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import gsap from "gsap";

const Menu = ({ isNavOpen, toggleNav, navRef, navContainer }) => {
  const linkRefs = useRef([]);

  useEffect(() => {
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
  }, [isNavOpen]);

  return (
    <nav
      ref={navContainer}
      className={`fixed inset-0 z-40 w-full h-full transition-transform duration-500 text-white pointer-events-none ${
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
        className="fixed left-0 z-10 w-full md:w-[500px] h-full bg-primary"
      >
        <div className="flex flex-col justify-center h-full gap-5">
          <div className="flex flex-col">
            {["Home", "About", "Sustainability"].map((path, index) => (
              <Link
                key={path}
                href={`/${path.toLowerCase()}`}
                className="px-8 py-4 overflow-hidden text-4xl transition-all duration-200 hover:font-bold"
                onClick={() => {
                  toggleNav();
                }}
              >
                <div
                  ref={(el) => (linkRefs.current[index] = el)}
                  className="flex items-center justify-between w-full opacity-100"
                >
                  {path.charAt(0) + path.slice(1)}
                </div>
              </Link>
            ))}
          </div>
          <div
            ref={(el) => (linkRefs.current[4] = el)}
            className="flex flex-col gap-2 pt-16 mx-8 underline underline-offset-4"
          >
            <Link
              data-animation-link="no-animation"
              href="mailto:info@laansolutions.nl"
            >
              Disclaimer
            </Link>
            <Link
              data-animation-link="no-animation"
              href="https://wooz.store/"
              target="_blank"
            >
              2D Website
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Menu;

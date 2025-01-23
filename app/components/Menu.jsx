"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Instagram, Facebook, X } from "lucide-react";

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
              {["About", "Sustainability"].map((path, index) => (
                <div
                  key={path}
                  className="px-8 py-4 overflow-hidden text-4xl transition-all duration-200 hover:font-bold"
                >
                  <div
                    ref={(el) => (linkRefs.current[index] = el)}
                    className="flex items-center justify-between w-full opacity-100 cursor-pointer"
                    onClick={() => {
                      setIsNavOpen(false);
                      setOpenModel(true);
                      setModelInfo(path);
                    }}
                  >
                    {path.charAt(0) + path.slice(1)}
                  </div>
                </div>
              ))}
            </div>
            <div
              ref={(el) => (linkRefs.current[4] = el)}
              className="flex flex-col gap-2 pt-16 mx-8"
            >
              <Link
                data-animation-link="no-animation"
                className="transition-all duration-200 hover:font-bold"
                target="_blank"
                href="https://shop.wooz.store/policies/terms-of-service"
              >
                Terms of Service
              </Link>
              <Link
                data-animation-link="no-animation"
                className="transition-all duration-200 hover:font-bold"
                href="https://shop.wooz.store/"
                target="_blank"
              >
                2D Website
              </Link>
              <div className="flex items-center gap-2 mt-10">
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
        className={`fixed z-30 inset-x-4 inset-y-28 md:inset-[150px] lg:inset-[180px] bg-primary rounded-lg translate-y-[150%] opacity-0}`}
      >
        <X
          className="absolute w-6 h-6 text-white cursor-pointer stroke-2 top-4 right-4"
          onClick={() => {
            setOpenModel(false);
          }}
        />
        <div className="flex flex-col h-full gap-2 text-white">
          {modelInfo === "About" && (
            <div className="flex flex-col items-center justify-center h-full px-1 text-center md:px-24">
              <h1 className="mb-6 text-2xl font-bold sm:text-3xl md:text-5xl font-libre">
                {" "}
                Our Story
              </h1>
              <div className="text-sm prose md:text-lg max-w-none">
                <p className="mb-4">
                  Creating a community through our brand by sharing happy
                  moments together while wearing Wooz clothing. Let’s make the
                  world a happier and healthier place.
                </p>
                <br />
                <p>
                  Our mission is to create items that carry a happy message that
                  will inspire people to live a happier life so that they can
                  share it with others.
                </p>{" "}
                <br />
                <p className="italic">
                  'A smile from you can change someone else's day!'
                </p>
                <p>
                  {" "}
                  <br />
                  Aiming for a fair production process which creates premium
                  quality garments, Wooz' pieces are entirely hand made in the
                  Netherlands. The garments are made by experienced tailors
                  close to Wooz in the Netherlands. <br /> <br />
                  <span className="font-bold ">LOVE</span>
                </p>
              </div>
            </div>
          )}
          {modelInfo === "Sustainability" && (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center md:px-24">
              <h1 className="mb-6 text-2xl font-bold sm:text-3xl md:text-5xl font-libre">
                What sustainability means to Wooz
              </h1>
              <p className="text-sm prose md:text-lg max-w-none">
                Being sustainable is very important to us. We try to keep our
                footprint as small as possible. We will also continue to
                research and develop sustainable products to take the best care
                of planet earth.
              </p>

              <h1 className="mt-10 mb-6 text-2xl font-bold sm:text-3xl md:text-4xl font-libre">
                Made in Holland
              </h1>
              <p className="text-sm prose md:text-lg max-w-none">
                The clothing of Wooz is produced in a responsible way in the
                Netherlands. The production is close to 'home' so it doesn't
                have to travel far :)
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Menu;

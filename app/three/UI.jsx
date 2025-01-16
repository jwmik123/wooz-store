import { atom, useAtom } from "jotai";
import { useEffect } from "react";

const pictures = [
  "wz04",
  "wz05",
  "wz06",
  "wz07",
  "wz08",
  "wz10",
  "wz11",
  "wz12",
  "wz13",
  "wz14",
  "wz15",
  "wz16",
];

export const pageAtom = atom(0);
export const pages = [
  {
    front: "book-cover",
    back: pictures[0],
  },
];
for (let i = 1; i < pictures.length - 1; i += 2) {
  pages.push({
    front: pictures[i % pictures.length],
    back: pictures[(i + 1) % pictures.length],
  });
}

pages.push({
  front: pictures[pictures.length - 1],
  back: "book-back",
});

export const UI = () => {
  const [page, setPage] = useAtom(pageAtom);

  useEffect(() => {
    const audio = new Audio("/assets/sounds/page-flip-01a.mp3");
    audio.play();
  }, [page]);

  return (
    <>
      <main className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none select-none ">
        <a
          className="mt-10 ml-10 pointer-events-auto"
          href="https://lessons.wawasensei.dev/courses/react-three-fiber"
        >
          <img className="w-20" src="/images/wawasensei-white.png" />
        </a>
        <div className="flex justify-center w-full overflow-auto pointer-events-auto">
          <div className="flex items-center max-w-full gap-4 p-10 overflow-auto">
            {[...pages].map((_, index) => (
              <button
                key={index}
                className={`border-transparent hover:border-white transition-all duration-300  px-4 py-3 rounded-full  text-lg uppercase shrink-0 border ${
                  index === page
                    ? "bg-white/90 text-black"
                    : "bg-black/30 text-white"
                }`}
                onClick={() => setPage(index)}
              >
                {index === 0 ? "Cover" : `Page ${index}`}
              </button>
            ))}
            <button
              className={`border-transparent hover:border-white transition-all duration-300  px-4 py-3 rounded-full  text-lg uppercase shrink-0 border ${
                page === pages.length
                  ? "bg-white/90 text-black"
                  : "bg-black/30 text-white"
              }`}
              onClick={() => setPage(pages.length)}
            >
              Back Cover
            </button>
          </div>
        </div>
      </main>
    </>
  );
};

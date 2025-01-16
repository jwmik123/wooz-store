import { atom, useAtom } from "jotai";

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
  return null;
};

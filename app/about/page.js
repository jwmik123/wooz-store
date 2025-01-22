"use client";

export default function About() {
  return (
    <main className="min-h-screen px-4 py-8 text-center bg-white">
      <h1 className="mb-6 text-4xl font-bold font-libre"> Our Story</h1>
      <div className="prose max-w-none">
        <p className="mb-4">
          Creating a community through our brand by sharing happy moments
          together while wearing Wooz clothing. Let’s make the world a happier
          and healthier place.
        </p>
        <br />
        <p>
          Our mission is to create items that carry a happy message that will
          inspire people to live a happier life so that they can share it with
          others.
        </p>{" "}
        <br />
        <p>'A smile from you can change someone else's day!'</p>
        <p>
          {" "}
          <br />
          Aiming for a fair production process which creates premium quality
          garments, Wooz' pieces are entirely hand made in the Netherlands. The
          garments are made by experienced tailors close to Wooz in the
          Netherlands. <br />{" "}
          <span className="font-bold text-primary">LOVE</span>
        </p>
      </div>
    </main>
  );
}

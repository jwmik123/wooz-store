/*
 * renderer.compileAsync yields to the main thread ~3.5× per render object
 * (three's yieldToMain: scheduler.yield() where it exists, else
 * requestAnimationFrame). Safari has no scheduler.yield, so every yield waits a
 * whole frame: 414 yields ≈ 6 s of a 7 s warm-up on an iPhone 17 Pro Max for
 * ~0.9 s of real work.
 *
 * While the warm-up runs, this installs a stand-in scheduler.yield: a
 * MessageChannel task (no frame wait), and only once ~FRAME_BUDGET_MS of work
 * has piled up since the last frame a real requestAnimationFrame, so the CSS
 * loader keeps painting. No-op where scheduler.yield is native.
 */

const FRAME_BUDGET_MS = 10;

export function installFastYield() {
  if (typeof self === "undefined" || self.scheduler?.yield) return () => {};

  const channel = new MessageChannel();
  const queue = [];
  channel.port1.onmessage = () => queue.shift()?.();
  const task = () =>
    new Promise((resolve) => {
      queue.push(resolve);
      channel.port2.postMessage(0);
    });

  let sliceStart = performance.now();
  const yieldFn = () => {
    if (performance.now() - sliceStart < FRAME_BUDGET_MS) return task();
    return new Promise((resolve) =>
      requestAnimationFrame(() => {
        sliceStart = performance.now();
        resolve();
      })
    );
  };

  const had = "scheduler" in self;
  const prev = self.scheduler;
  try {
    if (prev) prev.yield = yieldFn;
    else self.scheduler = { yield: yieldFn };
  } catch {
    channel.port1.close();
    return () => {};
  }
  self.scheduler.__wzFastYield = true;

  return () => {
    try {
      if (prev) {
        delete prev.yield;
        delete prev.__wzFastYield;
      } else if (!had) delete self.scheduler;
      else self.scheduler = prev;
    } catch {
      /* best effort */
    }
    channel.port1.close();
  };
}

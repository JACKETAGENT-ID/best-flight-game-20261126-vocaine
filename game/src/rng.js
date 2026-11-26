// Night Mail Run — a small deterministic random-number generator.
// One clear job: reproducible streams, so the city, the rings and the
// screenshot demo mode are the same every time a seed is given.

// mulberry32: tiny, fast, good enough for procedural scenery.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a stream.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one item from an array.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

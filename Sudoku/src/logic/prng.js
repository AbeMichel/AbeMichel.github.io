export const createPRNG = (seed) => {
  let h = 0xdeadbeef;
  if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
    }
  } else if (typeof seed === 'number') {
    h = Math.imul(h ^ seed, 2654435761);
  } else {
    h = 123456789;
  }
  
  let state = (h ^ 2246822507) >>> 0;
  
  // Mulberry32 PRNG
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  
  const nextInt = (min, max) => {
    return Math.floor(next() * (max - min + 1)) + min;
  };

  const shuffle = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  return { next, nextInt, shuffle };
};

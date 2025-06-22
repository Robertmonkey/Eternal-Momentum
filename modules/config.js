// modules/config.js

export const THEMATIC_UNLOCKS = {
  2: { type: 'power', id: 'shield' },
  3: { type: 'power', id: 'speed' },
  4: { type: 'slot', id: 'queueSlot1' },
  5: { type: 'power', id: 'black_hole' },
  6: { type: 'power', id: 'orbitalStrike' },  // Was chain
  7: { type: 'power', id: 'decoy' },
  8: { type: 'power', id: 'chain' },          // Was orbitalStrike
  9: { type: 'power', id: 'stack' },
  10: { type: 'power', id: 'ricochetShot' },
  11: { type: 'slot', id: 'queueSlot2' },
  12: { type: 'power', id: 'repulsion' },
  13: { type: 'power', id: 'berserk' },
  14: { type: 'power', id: 'freeze' },
  15: { type: 'power', id: 'gravity' },
  16: { type: 'power', id: 'bulletNova' },
  17: { type: 'power', id: 'shockwave' },
  18: { type: 'power', id: 'score' },
  19: { type: 'bonus', value: 10 },
  20: { type: 'victory' },
};

export const SPAWN_WEIGHTS = {
    shield: 2, heal: 3, speed: 2, freeze: 1, decoy: 1, stack: 1, 
    score: 1, shockwave: 3, missile: 3, chain: 3, orbitalStrike: 2,
    ricochetShot: 2, bulletNova: 2, repulsion: 1, black_hole: 1,
    gravity: 1, berserk: 1
};

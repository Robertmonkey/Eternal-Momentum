// modules/config.js

export const THEMATIC_UNLOCKS = {
  2: { type: 'power', id: 'shield' },          // Defeating Stage 1
  3: { type: 'power', id: 'speed' },           // Defeating Stage 2
  4: { type: 'slot', id: 'queueSlot1' },       // Defeating Stage 3 - Unlocks first O/D queue slots
  5: { type: 'power', id: 'black_hole' },      // Defeating Stage 4
  6: { type: 'power', id: 'chain' },            // Defeating Stage 5
  7: { type: 'power', id: 'decoy' },            // Defeating Stage 6
  8: { type: 'power', id: 'orbitalStrike' },   // Defeating Stage 7
  9: { type: 'power', id: 'stack' },            // Defeating Stage 8
  10: { type: 'power', id: 'ricochetShot' },    // Defeating Stage 9
  11: { type: 'slot', id: 'queueSlot2' },      // Defeating Stage 10 - Unlocks second O/D queue slots
  12: { type: 'power', id: 'repulsion' },       // Defeating Stage 11
  13: { type: 'power', id: 'berserk' },         // Defeating Stage 12
  14: { type: 'power', id: 'freeze' },          // Defeating Stage 13
  15: { type: 'power', id: 'gravity' },         // Defeating Stage 14
  16: { type: 'power', id: 'bulletNova' },      // Defeating Stage 15
  17: { type: 'power', id: 'shockwave' },       // Defeating Stage 16
  18: { type: 'power', id: 'score' },           // Defeating Stage 17
  19: { type: 'bonus', value: 10 },             // Defeating Stage 18
  20: { type: 'victory' },                      // Defeating Stage 19
};

export const SPAWN_WEIGHTS = {
    shield: 2, heal: 3, speed: 2, freeze: 1, decoy: 1, stack: 1, 
    score: 1, shockwave: 3, missile: 3, chain: 3, orbitalStrike: 2,
    ricochetShot: 2, bulletNova: 2, repulsion: 1, black_hole: 1,
    gravity: 1, berserk: 1
};

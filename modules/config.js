// modules/config.js

export const THEMATIC_UNLOCKS = {
  // --- UNLOCKS FOR STAGES 1-5 ---
  2: { type: 'power', id: 'shield' },
  3: { type: 'power', id: 'speed' },
  4: { type: 'slot', id: 'queueSlot1' },
  5: { type: 'power', id: 'black_hole' },
  // MILESTONE 1: Clear Stage 5 to get Orbital Strike AND a Bonus
  6: [
    { type: 'power', id: 'orbitalStrike' },
    { type: 'bonus', value: 5 }
  ],

  // --- UNLOCKS FOR STAGES 6-10 ---
  7: { type: 'power', id: 'decoy' },
  8: { type: 'power', id: 'chain' },
  9: { type: 'power', id: 'stack' },
  10: { type: 'power', id: 'ricochetShot' },
  // MILESTONE 2: Clear Stage 10 to get a Slot AND a Bonus
  11: [
    { type: 'slot', id: 'queueSlot2' },
    { type: 'bonus', value: 10 }
  ],

  // --- UNLOCKS FOR STAGES 11-15 ---
  12: { type: 'power', id: 'repulsion' },
  13: { type: 'power', id: 'berserk' },
  14: { type: 'power', id: 'freeze' },
  15: { type: 'power', id: 'gravity' },
  // MILESTONE 3: Clear Stage 15 to get Bullet Nova AND a Bonus
  16: [
    { type: 'power', id: 'bulletNova' },
    { type: 'bonus', value: 15 }
  ],
  
  // --- UNLOCKS FOR STAGES 16-20 ---
  17: { type: 'power', id: 'shockwave' },
  18: { type: 'power', id: 'score' },
  19: { type: 'power', id: 'missile'}, // Restored missile power unlock
  20: { type: 'victory' },
  // MILESTONE 4: Clear Stage 20 to get a Bonus
  21: { type: 'bonus', value: 20 },

  // --- UNLOCKS FOR STAGES 21-25 ---
  // MILESTONE 5: Final bonus for clearing Stage 25
  26: { type: 'bonus', value: 33 }
};

export const SPAWN_WEIGHTS = {
    shield: 2, heal: 3, speed: 2, freeze: 1, decoy: 1, stack: 1, 
    score: 1, shockwave: 3, missile: 3, chain: 3, orbitalStrike: 2,
    ricochetShot: 2, bulletNova: 2, repulsion: 1, black_hole: 1,
    gravity: 1, berserk: 1
};

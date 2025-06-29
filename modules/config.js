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

// --- NEW: Master configuration for all stages ---
export const STAGE_CONFIG = [
    { stage: 1,  displayName: 'Splitter Sentinel',    bosses: ['splitter'] },
    { stage: 2,  displayName: 'Reflector Warden',     bosses: ['reflector'] },
    { stage: 3,  displayName: 'Vampire Veil',         bosses: ['vampire'] },
    { stage: 4,  displayName: 'Gravity Tyrant',       bosses: ['gravity'] },
    { stage: 5,  displayName: 'Swarm Link',           bosses: ['swarm'] },
    { stage: 6,  displayName: 'Mirror Mirage',        bosses: ['mirror'] },
    { stage: 7,  displayName: 'EMP Overload',         bosses: ['emp'] },
    { stage: 8,  displayName: 'The Architect',        bosses: ['architect'] },
    { stage: 9,  displayName: 'Aethel & Umbra',       bosses: ['aethel_and_umbra'] },
    { stage: 10, displayName: 'Looping Eye',          bosses: ['looper'] },
    { stage: 11, displayName: 'The Juggernaut',       bosses: ['juggernaut'] },
    { stage: 12, displayName: 'The Puppeteer',        bosses: ['puppeteer'] },
    { stage: 13, displayName: 'The Glitch',           bosses: ['glitch'] },
    { stage: 14, displayName: 'Sentinel Pair',        bosses: ['sentinel_pair'] },
    { stage: 15, displayName: 'The Basilisk',         bosses: ['basilisk'] },
    { stage: 16, displayName: 'The Annihilator',      bosses: ['annihilator'] },
    { stage: 17, displayName: 'The Parasite',         bosses: ['parasite'] },
    { stage: 18, displayName: 'Quantum Shadow',       bosses: ['quantum_shadow'] },
    { stage: 19, displayName: 'Time Eater',           bosses: ['time_eater'] },
    { stage: 20, displayName: 'The Singularity',      bosses: ['singularity'] },
    { stage: 21, displayName: 'The Miasma',           bosses: ['miasma'] },
    { stage: 22, displayName: 'The Temporal Paradox', bosses: ['temporal_paradox'] },
    { stage: 23, displayName: 'The Syphon',           bosses: ['syphon'] },
    { stage: 24, displayName: 'The Centurion',        bosses: ['centurion'] },
    { stage: 25, displayName: 'The Fractal Horror',   bosses: ['fractal_horror'] },
    { stage: 26, displayName: 'The Obelisk',          bosses: ['obelisk'] },
    { stage: 27, displayName: 'The Helix Weaver',     bosses: ['helix_weaver'] },
    { stage: 28, displayName: 'The Epoch-Ender',      bosses: ['epoch_ender'] },
    { stage: 29, displayName: 'The Shaper of Fate',   bosses: ['shaper_of_fate'] },
    { stage: 30, displayName: 'The Pantheon',         bosses: ['pantheon'] }
];

// modules/state.js
//
// This file defines the global game state and includes additional
// configuration for each aberration core.  The original project did not
// contain a `modules` directory in the working tree; during the rewrite we
// recreate the state module locally and extend it to support all of the
// aberration cores described in the specification.  In particular we add
// missing core state entries (vampire, glitch, fractal_horror, parasite,
// etc.) and update existing ones with sensible defaults.  When the game
// is reset the `resetGame` function reinitialises these fields so that
// passive cooldowns and flags do not leak across runs.

import { offensivePowers } from './powers.js';

// The central state object.  Most other modules import this to read or
// mutate game state.  New fields can be safely added here as long as
// they are replicated in resetGame.
export const state = {
  // Track mouse buttons for detecting LMB/RMB combos when activating cores
  LMB_down: false,
  RMB_down: false,
  player: {
    x: 0,
    y: 0,
    // Player hitbox radius.  Fractal Horror modifies this value on equip.
    r: 20,
    // Base movement speed multiplier.  Modified by talents and cores.
    speed: 1.0,
    maxHealth: 100,
    health: 100,
    shield: false,
    stunnedUntil: 0,
    berserkUntil: 0,
    controlsInverted: false,
    statusEffects: [],
    level: 1,
    essence: 0,
    essenceToNextLevel: 100,
    ascensionPoints: 0,
    // By default the player starts with two basic powers unlocked.
    unlockedPowers: new Set(['heal', 'missile']),
    // Talents purchased from the ascension interface.  A map from id → rank.
    purchasedTalents: new Map(),
    // The highest stage the player has beaten.  Used to pick the next stage
    // on reset.
    highestStageBeaten: 0,
    // Inventory capacity for offensive and defensive powers.  Additional
    // slots can be unlocked via thematic milestones.
    unlockedOffensiveSlots: 1,
    unlockedDefensiveSlots: 1,
    // Parasite infection on the player – these flags are separate from the
    // parasite core and indicate the player has been infected by an enemy.
    infected: false,
    infectionEnd: 0,
    lastSpore: 0,
    // Flags for single‑use contingencies (some talents consume these).
    contingencyUsed: false,
    preordinanceUsed: false,
    // Aberration core management.  `unlockedAberrationCores` tracks which
    // cores have been unlocked; `equippedAberrationCore` holds the id of
    // the currently equipped core; `activePantheonBuffs` stores temporary
    // buffs granted by the Pantheon core.
    unlockedAberrationCores: new Set(),
    equippedAberrationCore: null,
    activePantheonBuffs: [],
    // Talent modifiers modify base stats on the fly.  Each entry should be
    // treated as multiplicative.
    talent_modifiers: {
      damage_multiplier: 1.0,
      damage_taken_multiplier: 1.0,
      pickup_radius_bonus: 0,
      essence_gain_modifier: 1.0,
      power_spawn_rate_modifier: 1.0,
      pull_resistance_modifier: 0,
    },
    // `talent_states` stores per–talent and per–core timers and flags.  New
    // aberration cores must add an entry here so that their cooldowns and
    // internal counters persist between ticks and are reset correctly.  Each
    // entry should be treated as private state for that core.
    talent_states: {
      phaseMomentum: {
        active: false,
        lastDamageTime: 0,
      },
      reactivePlating: {
        cooldownUntil: 0,
      },
      core_states: {
        // Architect: last pillar spawn time (unused in the new design but
        // retained for backwards compatibility).
        architect: { lastPillarTime: 0 },
        mirror_mirage: { lastDecoyTime: 0 },
        puppeteer: { lastConversion: 0 },
        splitter: { cooldownUntil: 0 },
        swarm: { tail: [], enemiesForNextSegment: 0 },
        epoch_ender: { cooldownUntil: 0, history: [], lastSnapshotTime: 0 },
        pantheon: { lastCycleTime: 0 },
        syphon: { cooldownUntil: 0 },
        juggernaut: { cooldownUntil: 0 },
        miasma: { isPurifying: false, stillStartTime: null },
        annihilator: { cooldownUntil: 0 },
        shaper_of_fate: { isDisabled: false },
        helix_weaver: { lastBolt: 0 },
        temporal_paradox: { lastEcho: 0 },
        obelisk: {},
        gravity: { lastPulseTime: 0 },
        looper: { isShifting: false },
        // New aberration cores begin here
        vampire: { },
        glitch: { },
        fractal_horror: { applied: false, originalR: null, originalSpeed: null, killCount: 0 },
        parasite: { },
        // Gravity is already defined above but left here for clarity.
      },
    },
  },
  // Global collections for all active enemies, pickups, visual effects, and
  // transient particle systems.  Modules like powers.js or cores.js push
  // objects into these arrays to be rendered or processed by gameLoop.js.
  enemies: [],
  pickups: [],
  effects: [],
  particles: [],
  decoys: [],
  currentStage: 1,
  currentBoss: null,
  bossActive: false,
  bossHasSpawnedThisRun: false,
  gameOver: false,
  isPaused: false,
  gameLoopId: null,
  offensiveInventory: [null, null, null],
  defensiveInventory: [null, null, null],
  stacked: false,
  arenaMode: false,
  wave: 0,
  lastArenaSpawn: 0,
  gravityActive: false,
  gravityEnd: 0,
  bossSpawnCooldownEnd: 0,
  customOrreryBosses: [],
};

/**
 * Persist the player's essential data to localStorage.  Only a subset of
 * player fields need to be saved; transient values like positions or
 * cooldowns are deliberately omitted.  When the game is loaded the
 * complementary `loadPlayerState` function will restore these values.
 */
export function savePlayerState() {
  const persistentData = {
    level: state.player.level,
    essence: state.player.essence,
    essenceToNextLevel: state.player.essenceToNextLevel,
    ascensionPoints: state.player.ascensionPoints,
    unlockedPowers: [...state.player.unlockedPowers],
    purchasedTalents: [...state.player.purchasedTalents],
    highestStageBeaten: state.player.highestStageBeaten,
    unlockedOffensiveSlots: state.player.unlockedOffensiveSlots,
    unlockedDefensiveSlots: state.player.unlockedDefensiveSlots,
    unlockedAberrationCores: [...state.player.unlockedAberrationCores],
    equippedAberrationCore: state.player.equippedAberrationCore,
  };
  localStorage.setItem('eternalMomentumSave', JSON.stringify(persistentData));
}

/**
 * Load persisted player data from localStorage.  Any fields not present
 * in the saved record fall back to sensible defaults.  Complex data
 * structures like Sets or Maps are reconstructed from their serialised
 * representations.
 */
export function loadPlayerState() {
  const savedData = localStorage.getItem('eternalMomentumSave');
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    const playerData = {
      unlockedOffensiveSlots: 1,
      unlockedDefensiveSlots: 1,
      ...parsedData,
      unlockedPowers: new Set(parsedData.unlockedPowers || []),
      purchasedTalents: new Map(parsedData.purchasedTalents || []),
      unlockedAberrationCores: new Set(parsedData.unlockedAberrationCores || []),
      equippedAberrationCore: parsedData.equippedAberrationCore || null,
    };
    Object.assign(state.player, playerData);
  }
}

/**
 * Reset the game into a fresh state.  This function is called at the
 * beginning of a new run or when the player restarts after dying.  It
 * resets positions, clears arrays and reinitialises all core state
 * trackers.  The optional `isArena` flag forces the game to start at
 * stage 1 regardless of the highest stage beaten.
 */
export function resetGame(isArena = false) {
  const canvas = document.getElementById('gameCanvas');
  // Place the player at the centre of the screen and fully heal them.
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height / 2;
  state.player.health = state.player.maxHealth;
  state.player.statusEffects = [];
  state.player.activePantheonBuffs = [];
  state.player.shield = false;
  state.player.berserkUntil = 0;
  state.player.talent_states.phaseMomentum.lastDamageTime = Date.now();
  state.player.talent_states.reactivePlating.cooldownUntil = 0;
  state.player.infected = false;
  state.player.infectionEnd = 0;
  state.player.lastSpore = 0;
  state.player.contingencyUsed = false;
  state.player.preordinanceUsed = false;
  // Recreate the core state container to wipe out any lingering cooldowns.
  state.player.talent_states.core_states = {
    architect: { lastPillarTime: 0 },
    mirror_mirage: { lastDecoyTime: 0 },
    puppeteer: { lastConversion: 0 },
    splitter: { cooldownUntil: 0 },
    swarm: { tail: [], enemiesForNextSegment: 0 },
    epoch_ender: { cooldownUntil: 0, history: [], lastSnapshotTime: 0 },
    pantheon: { lastCycleTime: 0 },
    syphon: { cooldownUntil: 0 },
    juggernaut: { cooldownUntil: 0 },
    miasma: { isPurifying: false, stillStartTime: null },
    annihilator: { cooldownUntil: 0 },
    shaper_of_fate: { isDisabled: false },
    helix_weaver: { lastBolt: 0 },
    temporal_paradox: { lastEcho: 0 },
    obelisk: {},
    gravity: { lastPulseTime: 0 },
    looper: { isShifting: false },
    vampire: { },
    glitch: { },
    fractal_horror: { applied: false, originalR: null, originalSpeed: null, killCount: 0 },
    parasite: { },
  };
  // Reset collection arrays and other high‑level flags.
  Object.assign(state, {
    enemies: [],
    pickups: [],
    effects: [],
    particles: [],
    decoys: [],
    offensiveInventory: [null, null, null],
    defensiveInventory: [null, null, null],
    currentBoss: null,
    bossActive: false,
    stacked: false,
    gameOver: false,
    bossHasSpawnedThisRun: false,
    gravityActive: false,
    gravityEnd: 0,
    isPaused: false,
    currentStage: isArena ? 1 : (state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1),
  });
}

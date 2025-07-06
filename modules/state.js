// modules/state.js
import { offensivePowers } from './powers.js';

export const state = {
  player:{
    x:0, y:0, r:20, speed:1.0,
    maxHealth:100, health:100,
    shield:false, stunnedUntil: 0, berserkUntil: 0, 
    controlsInverted: false,
    statusEffects: [],
    level: 1,
    essence: 0,
    essenceToNextLevel: 100,
    ascensionPoints: 0,
    unlockedPowers: new Set(['heal', 'missile']),
    purchasedTalents: new Map(),
    highestStageBeaten: 0, 
    unlockedOffensiveSlots: 1,
    unlockedDefensiveSlots: 1,
    infected: false, infectionEnd: 0, lastSpore: 0,
    
    // --- NEW: Properties for new talents ---
    contingencyUsed: false,
    preordinanceUsed: false,
    
    // --- NEW: Properties for Aberration Cores ---
    unlockedAberrationCores: new Set(),
    equippedAberrationCore: null,
    
    talent_modifiers: {
        damage_multiplier: 1.0,
        damage_taken_multiplier: 1.0,
        pickup_radius_bonus: 0,
        essence_gain_modifier: 1.0,
        pull_resistance_modifier: 0,
        power_spawn_rate_modifier: 1.0, // For Resonant Frequencies
    },

    talent_states: {
        phaseMomentum: {
            active: false,
            lastDamageTime: 0,
        },
        reactivePlating: {
            cooldownUntil: 0,
        },
        // --- NEW: State for Aberration Cores ---
        core_states: {
            architect: {
                lastPillarTime: 0,
                pillars: [],
            },
            mirror_mirage: {
                cooldownUntil: 0,
            },
            puppeteer: {
                lastConversion: 0,
                puppets: [],
            },
            splitter: {
                cooldownUntil: 0,
            },
            swarm_link: {
                tail: [],
                enemiesForNextSegment: 0,
            },
            epoch_ender: {
                cooldownUntil: 0,
                history: [],
            },
            pantheon: {
                lastCycleTime: 0,
                activeCore: null,
            },
            syphon: {
                canUse: true,
            }
        }
    }
  },
  enemies:[], pickups:[], effects: [], particles: [], decoy:null, 
  currentStage: 1,
  currentBoss:null, 
  bossActive:false,
  bossHasSpawnedThisRun: false,
  gameOver:false,
  isPaused: false,
  gameLoopId: null,
  offensiveInventory:[null,null,null], 
  defensiveInventory:[null,null,null],
  stacked:false,
  arenaMode: false, 
  wave: 0, 
  lastArenaSpawn: 0,
  gravityActive:false, 
  gravityEnd:0,
  bossSpawnCooldownEnd: 0,
  customOrreryBosses: [],
};

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
        // --- NEW: Save Aberration Core data ---
        unlockedAberrationCores: [...state.player.unlockedAberrationCores],
        equippedAberrationCore: state.player.equippedAberrationCore,
    };
    localStorage.setItem('eternalMomentumSave', JSON.stringify(persistentData));
}

export function loadPlayerState() {
    const savedData = localStorage.getItem('eternalMomentumSave');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        const playerData = {
            unlockedOffensiveSlots: 1,
            unlockedDefensiveSlots: 1,
            ...parsedData,
            unlockedPowers: new Set(parsedData.unlockedPowers),
            purchasedTalents: new Map(parsedData.purchasedTalents),
            // --- NEW: Load Aberration Core data ---
            unlockedAberrationCores: new Set(parsedData.unlockedAberrationCores || []),
            equippedAberrationCore: parsedData.equippedAberrationCore || null,
        };
        Object.assign(state.player, playerData);
    }
}

export function resetGame(isArena = false) {
    const canvas = document.getElementById("gameCanvas");
    
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
    state.player.health = state.player.maxHealth;
    state.player.statusEffects = [];
    state.player.shield = false;
    state.player.berserkUntil = 0;
    state.player.talent_states.phaseMomentum.lastDamageTime = Date.now();
    state.player.talent_states.reactivePlating.cooldownUntil = 0;
    
    // --- NEW: Reset talent and core states ---
    state.player.contingencyUsed = false;
    state.player.preordinanceUsed = false;
    state.player.talent_states.core_states.architect.lastPillarTime = 0;
    state.player.talent_states.core_states.architect.pillars = [];
    state.player.talent_states.core_states.mirror_mirage.cooldownUntil = 0;
    state.player.talent_states.core_states.puppeteer.lastConversion = 0;
    state.player.talent_states.core_states.puppeteer.puppets = [];
    state.player.talent_states.core_states.splitter.cooldownUntil = 0;
    state.player.talent_states.core_states.swarm_link.tail = [];
    state.player.talent_states.core_states.swarm_link.enemiesForNextSegment = 0;
    state.player.talent_states.core_states.epoch_ender.cooldownUntil = 0;
    state.player.talent_states.core_states.epoch_ender.history = [];
    state.player.talent_states.core_states.pantheon.lastCycleTime = Date.now();
    state.player.talent_states.core_states.pantheon.activeCore = null;
    state.player.talent_states.core_states.syphon.canUse = true;
    
    Object.assign(state, {
        enemies: [], pickups: [], effects: [], particles: [], decoy: null,
        offensiveInventory: [null, null, null], 
        defensiveInventory: [null, null, null], 
        currentBoss: null, bossActive: false, stacked: false, gameOver: false, 
        bossHasSpawnedThisRun: false,
        gravityActive: false, gravityEnd: 0, 
        isPaused: false, 
        currentStage: isArena ? 1 : state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1,
        arenaMode: isArena, wave: 0, lastArenaSpawn: Date.now(),
        bossSpawnCooldownEnd: Date.now() + 3000, 
        customOrreryBosses: [],
    });
    
    delete state.fractalHorrorSharedHp;
    delete state.fractalHorrorSplits;
    delete state.fractalHorrorAi;

    if (state.player.purchasedTalents.has('temporal-echo')) {
        const unlocked = [...state.player.unlockedPowers];
        if (unlocked.length > 0) {
            const powerType = unlocked[Math.floor(Math.random() * unlocked.length)];
            const isOffensive = offensivePowers.includes(powerType);

            if (isOffensive && state.offensiveInventory[0] === null) {
                state.offensiveInventory[0] = powerType;
            } else if (!isOffensive && state.defensiveInventory[0] === null) {
                state.defensiveInventory[0] = powerType;
            } else { 
                if (state.offensiveInventory[0] === null) {
                    state.offensiveInventory[0] = powerType;
                } else if (state.defensiveInventory[0] === null) {
                    state.defensiveInventory[0] = powerType;
                }
            }
        }
    }
}

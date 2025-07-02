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
    
    contingencyUsed: false,
    preordinanceUsed: false,
    
    talent_modifiers: {
        damage_multiplier: 1.0,
        damage_taken_multiplier: 1.0,
        pickup_radius_bonus: 0,
        essence_gain_modifier: 1.0,
        pull_resistance_modifier: 0,
    },

    talent_states: {
        phaseMomentum: {
            active: false,
            lastDamageTime: 0,
        },
        reactivePlating: {
            cooldownUntil: 0,
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
  customOrreryBosses: [], // <<< NEW PROPERTY
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
    
    state.player.contingencyUsed = false;
    state.player.preordinanceUsed = false;
    
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
        customOrreryBosses: [], // <<< RESET THE CUSTOM BOSS LIST
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

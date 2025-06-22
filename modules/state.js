// modules/state.js
import { applyAllTalentEffects } from './ascension.js';

export const state = {
  player:{
    x:0, y:0, r:20, speed:1,
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
    essenceGainModifier: 1.0,
    highestStageBeaten: 0, 
    unlockedOffensiveSlots: 1,
    unlockedDefensiveSlots: 1,
    infected: false, infectionEnd: 0, lastSpore: 0,
  },
  enemies:[], pickups:[], effects: [], particles: [], decoy:null, 
  currentStage: 1,
  currentBoss:null, 
  bossActive:false,
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
        // We don't save maxHealth/speed directly, they are recalculated from talents
    };
    localStorage.setItem('eternalMomentumSave', JSON.stringify(persistentData));
}

export function loadPlayerState() {
    const savedData = localStorage.getItem('eternalMomentumSave');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Load all saved properties into the state.player object
        Object.assign(state.player, {
            ...parsedData,
            unlockedPowers: new Set(parsedData.unlockedPowers),
            purchasedTalents: new Map(parsedData.purchasedTalents),
        });
    }
}

export function resetGame(isArena = false) {
    const canvas = document.getElementById("gameCanvas");
    
    // Apply all permanent stat upgrades from the Ascension Grid
    applyAllTalentEffects();

    // Reset only the run-specific stats
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
    state.player.health = state.player.maxHealth; // Health resets to the new max
    state.player.statusEffects = [];
    state.player.shield = false;
    state.player.berserkUntil = 0;
    
    Object.assign(state, {
        enemies: [], pickups: [], effects: [], particles: [], decoy: null,
        offensiveInventory: [null, null, null], 
        defensiveInventory: [null, null, null], 
        currentBoss: null, bossActive: false, stacked: false, gameOver: false, 
        gravityActive: false, gravityEnd: 0, 
        isPaused: false, 
        currentStage: isArena ? 1 : state.player.highestStageBeaten + 1,
        arenaMode: isArena, wave: 0, lastArenaSpawn: Date.now(),
        bossSpawnCooldownEnd: Date.now() + 3000, 
    });
}

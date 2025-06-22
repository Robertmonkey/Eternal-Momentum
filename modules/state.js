// modules/state.js

// The single, central state object for the entire game.
export const state = {
  // Player-specific data
  player:{
    x:0, y:0, r:20, speed:1,
    maxHealth:100, health:100,
    shield:false, stunnedUntil: 0, berserkUntil: 0, 
    controlsInverted: false,
    statusEffects: [],
    
    // Progression System
    level: 1,
    essence: 0,
    essenceToNextLevel: 100,
    ascensionPoints: 0,
    unlockedPowers: new Set(['heal', 'missile']),
    
    // Infection mechanic
    infected: false, infectionEnd: 0, lastSpore: 0,
  },
  
  // Game world data
  enemies:[], 
  pickups:[], 
  effects: [],
  particles: [],
  decoy:null, 
  
  // Inventories and status
  offensiveInventory:[null,null,null], 
  defensiveInventory:[null,null,null],
  stacked:false, 
  
  // Game flow properties
  currentStage: 1, // <-- NEW: Tracks boss progression
  currentBoss:null, 
  bossActive:false,
  gameOver:false,
  isPaused: false,
  gameLoopId: null,

  // Arena mode properties
  arenaMode: false, 
  wave: 0, 
  lastArenaSpawn: 0,

  // Boss-specific states
  gravityActive:false, 
  gravityEnd:0,
  bossSpawnCooldownEnd: 0,
};

// This function resets the state for a new game.
export function resetGame(isArena = false) {
    const canvas = document.getElementById("gameCanvas");
    
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
    state.player.maxHealth = 100;
    state.player.health = 100;
    state.player.speed = 1;
    state.player.statusEffects = [];
    state.player.shield = false;
    state.player.berserkUntil = 0;
    
    state.player.level = 1;
    state.player.essence = 0;
    state.player.essenceToNextLevel = 100;
    state.player.ascensionPoints = 0;
    state.player.unlockedPowers = new Set(['heal', 'missile']);
    
    Object.assign(state, {
        enemies: [], pickups: [], effects: [], particles: [], decoy: null,
        offensiveInventory: [null, null, null], 
        defensiveInventory: [null, null, null], 
        currentBoss: null, bossActive: false, stacked: false, gameOver: false, 
        gravityActive: false, gravityEnd: 0, 
        isPaused: false, 
        currentStage: 1, // <-- NEW: Reset stage
        
        arenaMode: isArena, wave: 0, lastArenaSpawn: Date.now(),
        // Set a short cooldown at the start of a new game before the first boss spawns
        bossSpawnCooldownEnd: Date.now() + 3000, 
    });
}

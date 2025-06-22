// modules/state.js

export const state = {
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
    
    // Ascension Grid Data
    purchasedTalents: new Map(),
    essenceGainModifier: 1.0,

    infected: false, infectionEnd: 0, lastSpore: 0,
  },
  
  // Game world data
  enemies:[], pickups:[], effects: [], particles: [], decoy:null, 
  
  currentStage: 1,
  currentBoss:null, 
  bossActive:false,
  gameOver:false,
  isPaused: false,
  gameLoopId: null,
  
  // ... rest of state
};

export function resetGame(isArena = false) {
    const canvas = document.getElementById("gameCanvas");
    
    // Non-persistent stats are reset here
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
    state.player.health = state.player.maxHealth; // Reset health to the potentially upgraded maxHealth
    state.player.speed = 1; // Base speed, talents will modify this
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
        currentStage: 1,
        
        arenaMode: isArena, wave: 0, lastArenaSpawn: Date.now(),
        bossSpawnCooldownEnd: Date.now() + 3000, 
    });

    // Re-apply all purchased talent effects
    // This part will be more complex later, for now we reset stats that are affected by talents
    let baseMaxHealth = 100;
    state.player.purchasedTalents.forEach((rank, id) => {
        const talent = findTalentById(id);
        if (talent && talent.id === 'core-health') {
             baseMaxHealth += [10, 15, 25][rank-1];
        }
    });
    state.player.maxHealth = baseMaxHealth;
    state.player.health = state.player.maxHealth;

}

// Helper function to find a talent by ID across all constellations
function findTalentById(talentId) {
    for (const constellation in TALENT_GRID_CONFIG) {
        if (TALENT_GRID_CONFIG[constellation][talentId]) {
            return TALENT_GRID_CONFIG[constellation][talentId];
        }
    }
    return null;
}

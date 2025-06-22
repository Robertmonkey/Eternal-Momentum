// modules/state.js
import { TALENT_GRID_CONFIG } from './talents.js';

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

function findTalentById(talentId) {
    for (const constellation in TALENT_GRID_CONFIG) {
        if (TALENT_GRID_CONFIG[constellation][talentId]) {
            return TALENT_GRID_CONFIG[constellation][talentId];
        }
    }
    return null;
}

export function resetGame(isArena = false) {
    const canvas = document.getElementById("gameCanvas");
    
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
    state.player.speed = 1; 
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

    // Re-apply persistent talent effects
    let baseMaxHealth = 100;
    let baseSpeed = 1.0;
    
    state.player.purchasedTalents.forEach((rank, id) => {
        const talent = findTalentById(id);
        if (talent && talent.effects) {
            // A simplified way to re-apply stat-based talents
             if (id === 'core-health') {
                baseMaxHealth += [10, 15, 25].slice(0, rank).reduce((a, b) => a + b, 0);
            }
             if (id === 'core-speed') {
                for(let i = 0; i < rank; i++) baseSpeed *= [1.02, 1.03, 1.05][i];
            }
        }
    });

    state.player.maxHealth = baseMaxHealth;
    state.player.health = state.player.maxHealth;
    state.player.speed = baseSpeed;
}

// modules/state.js
import { TALENT_GRID_CONFIG } from './talents.js';

export const state = { /* ... (state object is the same) ... */ };

// Helper function to find talent data by its ID
function findTalentById(talentId) {
    for (const constellation in TALENT_GRID_CONFIG) {
        if (TALENT_GRID_CONFIG[constellation][talentId]) {
            return TALENT_GRID_CONFIG[constellation][talentId];
        }
    }
    return null;
}

export function savePlayerState() { /* ... (same as before) ... */ }

export function loadPlayerState() { /* ... (same as before) ... */ }

export function resetGame(isArena = false) {
    const canvas = document.getElementById("gameCanvas");
    
    // Reset run-specific stats
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
    state.player.statusEffects = [];
    state.player.shield = false;
    state.player.berserkUntil = 0;
    
    // Apply persistent stats from talents
    let baseMaxHealth = 100;
    let baseSpeed = 1.0;
    let baseEssenceGain = 1.0;

    state.player.purchasedTalents.forEach((rank, id) => {
        const talent = findTalentById(id);
        if (talent) {
            for (let i = 1; i <= rank; i++) {
                if (id === 'core-health') baseMaxHealth += [15, 15, 20][i-1];
                if (id === 'core-speed') baseSpeed *= (1 + [0.03, 0.03, 0.04][i-1]);
                if (id === 'core-essence') baseEssenceGain += [0.05, 0.10, 0.15][i-1];
            }
        }
    });

    state.player.maxHealth = baseMaxHealth;
    state.player.speed = baseSpeed;
    state.player.essenceGainModifier = baseEssenceGain;
    state.player.health = state.player.maxHealth;

    // Reset other game state properties
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

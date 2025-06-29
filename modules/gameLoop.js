// modules/gameLoop.js
import { state, savePlayerState } from './state.js';
import { THEMATIC_UNLOCKS, SPAWN_WEIGHTS, STAGE_CONFIG } from './config.js';
import { powers, offensivePowers } from './powers.js';
import { bossData } from './bosses.js';
import { updateUI, showBossBanner, showUnlockNotification } from './ui.js';
import * as utils from './utils.js';
import { AudioManager } from './audio.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function play(soundId) {
    AudioManager.playSfx(soundId);
}

function playLooping(soundId) {
    AudioManager.playLoopingSfx(soundId);
}

function stopLoopingSfx(soundId) {
    AudioManager.stopLoopingSfx(soundId);
}

const gameHelpers = { addStatusEffect, spawnEnemy, spawnPickup, play, stopLoopingSfx, playLooping, addEssence };
const spawnParticlesCallback = (x, y, c, n, spd, life, r) => utils.spawnParticles(state.particles, x, y, c, n, spd, life, r);

export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();
    
    if (name === 'Stunned' || name === 'Petrified' || name === 'Slowed') {
        const isBerserk = state.player.berserkUntil > now;
        const hasTalent = state.player.purchasedTalents.has('unstoppable-frenzy');
        if (isBerserk && hasTalent) {
            return; 
        }
    }

    state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== name);
    state.player.statusEffects.push({ name, emoji, startTime: now, endTime: now + duration });
}

export function handleThematicUnlock(stageJustCleared) {
    const unlockLevel = stageJustCleared + 1;
    const unlockData = THEMATIC_UNLOCKS[unlockLevel];
    if (!unlockData) return;

    const unlocks = Array.isArray(unlockData) ? unlockData : [unlockData];

    for (const unlock of unlocks) {
        const isAlreadyUnlocked = unlock.type === 'power' && state.player.unlockedPowers.has(unlock.id);
        if (isAlreadyUnlocked) continue;
        
        if (unlock.type === 'power') {
            state.player.unlockedPowers.add(unlock.id);
            const powerName = powers[unlock.id]?.desc || unlock.id;
            showUnlockNotification(`Power Unlocked: ${powers[unlock.id].emoji} ${powerName}`);
        } else if (unlock.type === 'slot') {
            if (unlock.id === 'queueSlot1') {
                if (state.player.unlockedOffensiveSlots < 2) state.player.unlockedOffensiveSlots++;
                if (state.player.unlockedDefensiveSlots < 2) state.player.unlockedDefensiveSlots++;
            } else if (unlock.id === 'queueSlot2') {
                if (state.player.unlockedOffensiveSlots < 3) state.player.unlockedOffensiveSlots++;
                if (state.player.unlockedDefensiveSlots < 3) state.player.unlockedDefensiveSlots++;
            }
            showUnlockNotification(`Inventory Slot Unlocked!`);
        } else if (unlock.type === 'bonus') {
            state.player.ascensionPoints += unlock.value;
            showUnlockNotification(`Bonus: +${unlock.value} Ascension Points!`);
        }
    }
}

function levelUp() {
    state.player.level++;
    state.player.essence -= state.player.essenceToNextLevel;
    state.player.essenceToNextLevel = Math.floor(state.player.essenceToNextLevel * 1.5);
    state.player.ascensionPoints += 1;
    utils.spawnParticles(state.particles, state.player.x, state.player.y, '#00ffff', 80, 6, 50, 5);
    savePlayerState();
}

export function addEssence(amount) {
    if (state.gameOver) return;
    state.player.essence += Math.floor(amount * state.player.talent_modifiers.essence_gain_modifier);
    while (state.player.essence >= state.player.essenceToNextLevel) {
        levelUp();
    }
}

function getSafeSpawnLocation() {
    const edgeMargin = 100;
    let x, y;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: // Top
            x = Math.random() * canvas.width;
            y = edgeMargin;
            break;
        case 1: // Bottom
            x = Math.random() * canvas.width;
            y = canvas.height - edgeMargin;
            break;
        case 2: // Left
            x = edgeMargin;
            y = Math.random() * canvas.height;
            break;
        case 3: // Right
            x = canvas.width - edgeMargin;
            y = Math.random() * canvas.height;
            break;
    }
    return { x, y };
}

export function spawnBossesForStage(stageNum) {
    // --- CHANGE: Use the new STAGE_CONFIG to determine which bosses to spawn ---
    const stageData = STAGE_CONFIG.find(s => s.stage === stageNum);

    if (stageData && stageData.bosses) {
        stageData.bosses.forEach(bossId => {
            spawnEnemy(true, bossId, getSafeSpawnLocation());
        });
    } else if (stageNum > 30) {
         // Placeholder for the intelligent infinite scaling algorithm
        const hardBosses = bossData.filter(b => b.maxHP >= 400 && b.id !== 'obelisk_conduit');
        const bossCount = Math.min(3, Math.floor((stageNum - 30) / 5) + 1);
        const bossIdsToSpawn = [];
        for(let i=0; i < bossCount; i++) {
            const randomBoss = hardBosses[Math.floor(Math.random() * hardBosses.length)];
            if (!bossIdsToSpawn.includes(randomBoss.id)) {
                bossIdsToSpawn.push(randomBoss.id);
            }
        }
        bossIdsToSpawn.forEach(bossId => {
            spawnEnemy(true, bossId, getSafeSpawnLocation());
        });
    } else {
        console.error(`No boss configuration found for stage ${stageNum}`);
    }
}

export function spawnEnemy(isBoss = false, bossId = null, location = null) {
    const e = { x: location ? location.x : Math.random() * canvas.width, y: location ? location.y : Math.random() * canvas.height, dx: (Math.random() - 0.5) * 0.75, dy: (Math.random() - 0.5) * 0.75, r: isBoss ? 50 : 15, hp: isBoss ? 200 : 1, maxHP: isBoss ? 200 : 1, boss: isBoss, frozen: false, targetBosses: false };
    if (isBoss) {
        const bd = bossData.find(b => b.id === bossId);
        if (!bd) { console.error("Boss data not found for id", bossId); return null; }
        
        Object.assign(e, bd);
        
        const baseHp = bd.maxHP || 200;
        const bossIndex = (state.currentStage - 1);
        
        const scalingFactor = 12;
        const finalHp = baseHp + (Math.pow(bossIndex, 1.5) * scalingFactor);
        e.maxHP = Math.round(finalHp);
        e.hp = e.maxHP;

        state.enemies.push(e);
        if (bd.init) bd.init(e, state, spawnEnemy, canvas);
        
        if (!state.bossActive) {
            const stageInfo = STAGE_CONFIG.find(s => s.stage === state.currentStage);
            showBossBanner(stageInfo ? {name: stageInfo.displayName} : e);
            AudioManager.playSfx('bossSpawnSound');
            AudioManager.crossfadeToNextTrack();
        }
        state.bossActive = true;

    } else {
        state.enemies.push(e);
    }
    if (state.arenaMode) { e.target = null; e.lastTargetCheck = 0; }
    return e;
}

export function spawnPickup() {
    const available = [...state.player.unlockedPowers];
    if (available.length === 0) return;
    const types = [];
    for (const type of available) {
        const weight = SPAWN_WEIGHTS[type] || 1;
        for (let i = 0; i < weight; i++) types.push(type);
    }
    const type = types[Math.floor(Math.random() * types.length)];
    
    let life = 10000;
    const anomalyRank = state.player.purchasedTalents.get('temporal-anomaly');
    if (anomalyRank) {
        life *= (1 + [0.25, 0.5][anomalyRank - 1]);
    }

    state.pickups.push({ 
        x: Math.random() * canvas.width, 
        y: Math.random() * canvas.height, 
        r: 12, 
        type, 
        vx: 0, 
        vy: 0,
        lifeEnd: Date.now() + life
    });
}

// ... (The rest of gameLoop.js from the previous turn would go here, unchanged)
// To save space, I will only include the changed effect processing logic at the end.
// Assume all code from lines 208 to 1100 is identical to the previous response.

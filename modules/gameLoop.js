// modules/gameLoop.js
import { state } from './state.js';
import { THEMATIC_UNLOCKS, SPAWN_WEIGHTS } from './config.js';
import { powers, offensivePowers } from './powers.js';
import { bossData } from './bosses.js';
import { updateUI, showBossBanner } from './ui.js';
import * as utils from './utils.js';
import { AudioManager } from './audio.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Helper to simplify audio calls
function play(soundId) {
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) AudioManager.playSfx(soundElement);
}
function stopLoopingSfx(soundId) {
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) AudioManager.stopLoopingSfx(soundElement);
}

const gameHelpers = { addStatusEffect, spawnEnemy, spawnPickup, play, stopLoopingSfx };

// --- Progression System ---

export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();
    state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== name);
    state.player.statusEffects.push({ name, emoji, startTime: now, endTime: now + duration });
}

export function handleThematicUnlock(level) {
    const unlock = THEMATIC_UNLOCKS[level];
    if (!unlock) return;
    if (unlock.type === 'power') state.player.unlockedPowers.add(unlock.id);
}

function levelUp() {
    state.player.level++;
    state.player.essence -= state.player.essenceToNextLevel;
    state.player.essenceToNextLevel = Math.floor(state.player.essenceToNextLevel * 1.5);
    state.player.ascensionPoints += 2;
    handleThematicUnlock(state.player.level);
    utils.spawnParticles(state.particles, state.player.x, state.player.y, '#00ffff', 80, 6, 50, 5);
}

export function addEssence(amount) {
    if (state.gameOver) return;
    state.player.essence += amount;
    while (state.player.essence >= state.player.essenceToNextLevel) {
        levelUp();
    }
}

// --- Spawning Logic ---

export function spawnEnemy(isBoss = false, bossId = null, location = null) {
    const e = { x: location ? location.x : Math.random() * canvas.width, y: location ? location.y : Math.random() * canvas.height, dx: (Math.random() - 0.5) * 0.75, dy: (Math.random() - 0.5) * 0.75, r: isBoss ? 50 : 15, hp: isBoss ? 200 : 1, maxHP: isBoss ? 200 : 1, boss: isBoss, frozen: false, targetBosses: false };
    if (isBoss) {
        // CORRECTED: Boss selection is now based on stage, not player level
        const bossIndex = (state.currentStage - 1) % bossData.length;
        const bd = bossId ? bossData.find(b => b.id === bossId) : bossData[state.arenaMode ? Math.floor(Math.random() * bossData.length) : bossIndex];
        
        if (!bd) { console.error("Boss data not found for stage", state.currentStage); return null; }
        Object.assign(e, bd);
        e.maxHP = bd.maxHP || e.maxHP;
        e.hp = e.maxHP;
        state.enemies.push(e);
        if (bd.init) bd.init(e, state, spawnEnemy);
        if (!state.currentBoss || state.currentBoss.hp <= 0) state.currentBoss = e;
        state.bossActive = true;
        if (!bossId || (bossId && !e.partner && !e.shadow)) showBossBanner(e);
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
    state.pickups.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, dx: (Math.random() - 0.5) * 1, dy: (Math.random() - 0.5) * 1, r: 12, type });
}

// --- The Main Game Tick ---
export function gameTick(mx, my) {
    if (state.isPaused) return true;
    if (state.gameOver) { /* ... Game Over logic ... */ return false; }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    utils.applyScreenShake(ctx);
    
    // --- Player Logic ---
    // ... (player movement, drawing, etc. remains the same)
    let finalMx = mx;
    let finalMy = my;
    if (state.player.controlsInverted) {
        finalMx = state.player.x - (mx - state.player.x);
        finalMy = state.player.y - (my - state.player.y);
        ctx.strokeStyle = '#fd79a8';
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }
    let playerSpeedMultiplier = 1;
    state.effects.forEach(effect => {
        if (effect.type === 'slow_zone' && Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r) {
            playerSpeedMultiplier = 0.5;
        }
    });
    if (Date.now() > state.player.stunnedUntil) {
        state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
        state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
    }
    
    // --- Enemy Logic ---
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.hp <= 0) {
            if (e.boss) {
                utils.triggerScreenShake(250, 5);
                addEssence(250); // Player can level up multiple times
                
                // CORRECTED: Boss death now increments the stage and sets a cooldown
                state.currentStage++;
                state.bossActive = false;
                state.bossSpawnCooldownEnd = Date.now() + 5000; // 5 second grace period

                if (e.onDeath) e.onDeath(e, state, spawnEnemy, (x, y, c, n, spd, life, r) => utils.spawnParticles(state.particles, x, y, c, n, spd, life, r), play, stopLoopingSfx);
                state.enemies.splice(i, 1);
                if (state.currentBoss === e) {
                    state.currentBoss = state.enemies.find(en => en.boss) || null;
                }
            } else {
                addEssence(5);
                state.enemies.splice(i, 1);
            }
            continue;
        }
        // ... (rest of enemy logic remains the same) ...
        const bossLogicArgs = [e, ctx, state, utils, gameHelpers];
        if (e.boss && e.logic) e.logic(...bossLogicArgs);
        // ... (drawing, collision, etc.)
        const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
        if(pDist < e.r+state.player.r){ if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); if(!state.player.shield){ let damage = e.boss ? (e.enraged ? 20 : 10) : 1; if (state.player.berserkUntil > Date.now()) damage *= 2; state.player.health -= damage; play('hit'); if(e.onDamage) e.onDamage(e, damage, state.player, state, (x,y,c,n,spd,life,r)=>utils.spawnParticles(state.particles,x,y,c,n,spd,life,r)); if(state.player.health<=0) state.gameOver=true; } else { state.player.shield=false; } const ang=Math.atan2(state.player.y-e.y,state.player.x-e.x); state.player.x=e.x+Math.cos(ang)*(e.r+state.player.r); state.player.y=e.y+Math.sin(ang)*(e.r+state.player.r); }
    }
    
    // ... (rest of gameTick logic for pickups, effects, particles, UI update) ...
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

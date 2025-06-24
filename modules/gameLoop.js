// modules/gameLoop.js
import { state, savePlayerState } from './state.js';
import { THEMATIC_UNLOCKS, SPAWN_WEIGHTS } from './config.js';
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
    
    // --- FIX: Checks for correct talent ID ---
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
    const unlock = THEMATIC_UNLOCKS[unlockLevel];
    if (!unlock) return;

    const isAlreadyUnlocked = unlock.type === 'power' && state.player.unlockedPowers.has(unlock.id);
    if (isAlreadyUnlocked) return;
    
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
        case 0: x = Math.random() * canvas.width; y = edgeMargin; break;
        case 1: x = Math.random() * canvas.width; y = canvas.height - edgeMargin; break;
        case 2: x = edgeMargin; y = Math.random() * canvas.height; break;
        case 3: x = canvas.width - edgeMargin; y = Math.random() * canvas.height; break;
    }
    return { x, y };
}

export function spawnBossesForStage(stageNum) {
    if (stageNum <= 20) {
        const bossIndex = stageNum - 1;
        if (bossIndex < bossData.length) {
            spawnEnemy(true, bossData[bossIndex].id, getSafeSpawnLocation());
        }
    } else {
        const bossNum1 = ((stageNum - 1) % 10) + 1;
        const bossNum2 = bossNum1 + 10;
        const count1 = 1 + Math.floor((stageNum - 11) / 20);
        const count2 = 1 + Math.floor((stageNum - 21) / 20);
        const bossId1 = bossData[bossNum1 - 1]?.id;
        const bossId2 = bossData[bossNum2 - 1]?.id;
        
        if (bossId1) for (let i = 0; i < count1; i++) spawnEnemy(true, bossId1, getSafeSpawnLocation());
        if (bossId2 && count2 > 0) for (let i = 0; i < count2; i++) spawnEnemy(true, bossId2, getSafeSpawnLocation());
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
            showBossBanner(e);
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

    state.pickups.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 12, type, vx: 0, vy: 0, lifeEnd: Date.now() + life });
}

export function gameTick(mx, my) {
    if (state.isPaused) return true;

    if (!state.gameOver) {
        if (state.arenaMode) {
            const spawnInterval = Math.max(1000, 8000 * Math.pow(0.95, state.wave));
            if (Date.now() - state.lastArenaSpawn > spawnInterval) {
                state.lastArenaSpawn = Date.now();
                state.wave++;
                spawnEnemy(true, null, {x: canvas.width/2, y: 100});
            }
        } else {
            if (!state.bossActive && state.bossSpawnCooldownEnd > 0 && Date.now() > state.bossSpawnCooldownEnd) {
                state.bossSpawnCooldownEnd = 0;
                spawnBossesForStage(state.currentStage);
            }
        }
        if (state.bossActive && Math.random() < (0.007 + state.player.level * 0.001)) spawnEnemy(false);
        if (Math.random() < (0.02 + state.player.level * 0.0002)) spawnPickup();
    }
    
    if (state.gameOver) {
        stopLoopingSfx("beamHumSound");
        const gameOverMenu = document.getElementById('gameOverMenu');
        if (gameOverMenu.style.display !== 'flex') gameOverMenu.style.display = 'flex';
        return false;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    utils.applyScreenShake(ctx);
    
    let finalMx = mx;
    let finalMy = my;
    if (state.player.controlsInverted) {
        finalMx = state.player.x - (mx - state.player.x);
        finalMy = state.player.y - (my - state.player.y);
    }
    
    if (state.player.purchasedTalents.get('phase-momentum')) {
        state.player.talent_states.phaseMomentum.active = Date.now() - state.player.talent_states.phaseMomentum.lastDamageTime > 8000;
    } else {
        state.player.talent_states.phaseMomentum.active = false;
    }
    
    let playerSpeedMultiplier = state.player.talent_states.phaseMomentum.active ? 1.10 : 1.0;
    const isBerserkImmune = state.player.berserkUntil > Date.now() && state.player.purchasedTalents.has('unstoppable-frenzy');
    if (state.player.statusEffects.some(e => e.name === 'Slowed') && !isBerserkImmune) playerSpeedMultiplier *= 0.5;
    
    // ... (logic for various effects, no changes here) ...

    if (Date.now() > state.player.stunnedUntil) {
        state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
        state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
    }

    // ... (decoy, gravity, collision logic, no changes here) ...

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.hp <= 0) {
            if (e.boss) {
                if (e.onDeath) e.onDeath(e, state, spawnEnemy, spawnParticlesCallback, play, stopLoopingSfx);
                state.enemies.splice(i, 1);
                if (!state.enemies.some(en => en.boss)) {
                    state.bossActive = false;
                    AudioManager.playSfx('bossDefeatSound');
                    AudioManager.fadeOutMusic();
                    state.bossSpawnCooldownEnd = Date.now() + 4000;
                    if (state.currentStage > state.player.highestStageBeaten) {
                        state.player.highestStageBeaten = state.currentStage;
                        state.player.ascensionPoints += 1;
                        showUnlockNotification("Stage Cleared! +1 AP", `Level ${state.currentStage + 1} Unlocked`);
                    }
                    if (THEMATIC_UNLOCKS[state.currentStage + 1]) handleThematicUnlock(state.currentStage);
                    addEssence(300);
                    state.currentStage++;
                    savePlayerState();
                }
            } else {
                addEssence(10);
                // --- FIX: Checks for correct, restored talent ID ---
                const scavengerRank = state.player.purchasedTalents.get('power-scavenger');
                if (scavengerRank && Math.random() < [0.01, 0.025][scavengerRank-1]) {
                    state.pickups.push({ x: e.x, y: e.y, r: 12, type: 'score', vx: 0, vy: 0, lifeEnd: Date.now() + 10000 });
                }
                // --- FIX: Checks for correct talent ID ---
                const cryoRank = state.player.purchasedTalents.get('cryo-shatter');
                if (cryoRank && e.wasFrozen && Math.random() < [0.25, 0.5][cryoRank-1]) {
                    utils.spawnParticles(state.particles, e.x, e.y, '#ADD8E6', 40, 4, 30, 2);
                    state.effects.push({ type: 'shockwave', caster: state.player, x: e.x, y: e.y, radius: 0, maxRadius: 100, speed: 500, startTime: Date.now(), hitEnemies: new Set(), damage: 5 * state.player.talent_modifiers.damage_multiplier, color: 'rgba(0, 200, 255, 0.5)' });
                }
                state.enemies.splice(i, 1);
            }
            continue;
        }

        // ... (enemy movement and other logic, no changes) ...

        const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
        if(pDist < e.r+state.player.r){
            if (!state.player.talent_states.phaseMomentum.active || e.boss) {
                // ... (damage taking logic)
                if(!state.player.shield){
                    // ...
                    play('hitSound'); 
                    if(e.onDamage) e.onDamage(e, damage, state.player, state, spawnParticlesCallback, play); 
                    if(state.player.health<=0) state.gameOver=true; 
                } else { 
                    state.player.shield=false; 
                    play('shieldBreak');
                    if(state.player.purchasedTalents.has('aegis-retaliation')) state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 250, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: 0, color: 'rgba(255, 255, 255, 0.5)' });
                }
            }
        }
    }

    // ... (pickup logic, no changes) ...

    state.effects.forEach((effect, index) => {
        if (effect.type === 'shockwave') {
            // ...
            targets.forEach(target => {
                // ...
                if (target.onDamage) target.onDamage(target, dmg, effect.caster, state, spawnParticlesCallback, play);
            });
            // ...
        } else if (effect.type === 'chain_lightning') {
            // ...
            if (!effect.links.includes(to)) {
                // ...
                if (to.onDamage) to.onDamage(to, dmg, effect.caster, state, spawnParticlesCallback, play);
                // --- FIX: Checks for correct, restored talent ID ---
                if (state.player.purchasedTalents.has('volatile-finish') && i === effect.targets.length - 1) {
                     state.effects.push({ type: 'shockwave', caster: state.player, x: to.x, y: to.y, radius: 0, maxRadius: 150, speed: 600, startTime: Date.now(), hitEnemies: new Set(), damage: 15 * state.player.talent_modifiers.damage_multiplier });
                }
            }
            // ...
        } else if (effect.type === 'ricochet_projectile') { 
            // --- FIX: Checks for correct, restored talent ID ---
            const hasPayload = state.player.purchasedTalents.has('unstable-payload');
            if(hasPayload) { const bouncesSoFar = effect.initialBounces - effect.bounces; effect.r = 8 + bouncesSoFar * 2; effect.damage = 10 + bouncesSoFar * 5; }
            // ...
        } else if (effect.type === 'nova_controller') { 
            if (Date.now() > effect.startTime + effect.duration) { state.effects.splice(index, 1); return; } 
            if(Date.now() - effect.lastShot > 50) { 
                effect.lastShot = Date.now(); const speed = 5; 
                // --- FIX: Checks for correct, restored talent ID ---
                if (state.player.purchasedTalents.has('nova-pulsar')) {
                    const angles = [effect.angle, effect.angle + (2 * Math.PI / 3), effect.angle - (2 * Math.PI / 3)];
                    angles.forEach(angle => { state.effects.push({ type: 'nova_bullet', x: state.player.x, y: state.player.y, r: 4, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed }); });
                } else {
                    state.effects.push({ type: 'nova_bullet', x: state.player.x, y: state.player.y, r: 4, dx: Math.cos(effect.angle) * speed, dy: Math.sin(effect.angle) * speed }); 
                }
                effect.angle += 0.5; 
            }
        } else if (effect.type === 'orbital_target') {
            // --- FIX: Checks for correct, restored talent ID ---
            const hasTracking = state.player.purchasedTalents.has('targeting-algorithm');
            if(hasTracking && effect.target && effect.target.hp > 0) { effect.x = effect.target.x; effect.y = effect.target.y; }
            const duration = 1500; const progress = (Date.now() - effect.startTime) / duration; 
            if (progress >= 1) { 
                spawnParticlesCallback(effect.x, effect.y, '#e67e22', 100, 8, 40); 
                const explosionRadius = 150; 
                state.enemies.forEach(e => { 
                    if (Math.hypot(e.x-effect.x, e.y-effect.y) < explosionRadius) { 
                        let damage = ((state.player.berserkUntil > Date.now()) ? 50 : 25)  * state.player.talent_modifiers.damage_multiplier; 
                        e.hp -= e.boss ? damage : 1000; 
                        if(e.onDamage) e.onDamage(e, damage, effect.caster, state, spawnParticlesCallback, play); 
                    } 
                }); 
                state.effects.splice(index, 1); 
                return; 
            } 
            // ...
        } else if (effect.type === 'singularity_beam') {
            // ...
            if (L2 !== 0) {
                // ...
                if (Math.hypot(p3.x - closestX, p3.y - closestY) < p3.r + 5) { if (state.player.shield) { state.player.shield = false; play('shieldBreak'); } else { state.player.health -= 2; play('hitSound'); } }
            }
        }
        // ... (all other effects logic)
    });
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

// modules/gameLoop.js
import { state, savePlayerState } from './state.js';
import { THEMATIC_UNLOCKS, SPAWN_WEIGHTS, STAGE_CONFIG } from './config.js';
import { powers, offensivePowers, usePower } from './powers.js';
import { bossData } from './bosses.js';
import { updateUI, showBossBanner, showUnlockNotification } from './ui.js';
import * as utils from './utils.js';
import { AudioManager } from './audio.js';
import * as Cores from './cores.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Helper Function ---
function playerHasCore(coreId) {
    if (state.player.equippedAberrationCore === coreId) return true;
    return state.player.activePantheonBuffs.some(buff => buff.coreId === coreId);
}

// --- Audio Helpers ---
function play(soundId) { AudioManager.playSfx(soundId); }
function playLooping(soundId) { AudioManager.playLoopingSfx(soundId); }
function stopLoopingSfx(soundId) { AudioManager.stopLoopingSfx(soundId); }
function stopAllLoopingSounds() {
    AudioManager.stopLoopingSfx('beamHumSound');
    AudioManager.stopLoopingSfx('wallShrink');
    AudioManager.stopLoopingSfx('obeliskHum');
    AudioManager.stopLoopingSfx('paradoxTrailHum');
    AudioManager.stopLoopingSfx('dilationField');
}

// --- Game Logic Helpers ---
const spawnParticlesCallback = (x, y, c, n, spd, life, r) => utils.spawnParticles(state.particles, x, y, c, n, spd, life, r);
const gameHelpers = {
    addStatusEffect, spawnEnemy, spawnPickup, play, stopLoopingSfx, playLooping, addEssence,
};
window.gameHelpers = gameHelpers;


export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();
    if (name === 'Stunned' || name === 'Petrified' || name === 'Slowed' || name === 'Epoch-Slow') {
        const isBerserk = state.player.berserkUntil > now;
        const hasTalent = state.player.purchasedTalents.has('unstoppable-frenzy');
        if (isBerserk && hasTalent) return;
    }
    const existing = state.player.statusEffects.find(e => e.name === name);
    if(existing) {
        if (name === 'Conduit Charge') {
            existing.count = Math.min(3, (existing.count || 1) + 1);
            existing.emoji = '⚡'.repeat(existing.count);
        }
        existing.endTime = now + duration;
        return;
    }
    const effect = { name, emoji, startTime: now, endTime: now + duration };
    if (name === 'Conduit Charge') effect.count = 1;
    state.player.statusEffects.push(effect);
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

function handleCoreUnlocks(newLevel) {
    const coreData = bossData.find(b => b.unlock_level === newLevel);
    if (coreData && !state.player.unlockedAberrationCores.has(coreData.id)) {
        state.player.unlockedAberrationCores.add(coreData.id);
        showUnlockNotification(`Aberration Core Unlocked: ${coreData.name}`, 'New Attunement Possible');
        play('finalBossPhaseSound');
    }
}

function levelUp() {
    state.player.level++;
    state.player.essence -= state.player.essenceToNextLevel;
    state.player.essenceToNextLevel = Math.floor(state.player.essenceToNextLevel * 1.12);
    state.player.ascensionPoints += 1;
    utils.spawnParticles(state.particles, state.player.x, state.player.y, '#00ffff', 80, 6, 50, 5);
    if (state.player.level === 10 && state.player.unlockedAberrationCores.size === 0) {
        showUnlockNotification("SYSTEM ONLINE", "Aberration Core Socket Unlocked");
    }
    handleCoreUnlocks(state.player.level);
    savePlayerState();
}

export function addEssence(amount) {
    if (state.gameOver) return;
    let modifiedAmount = Math.floor(amount * state.player.talent_modifiers.essence_gain_modifier);
    if (state.player.purchasedTalents.has('essence-transmutation')) {
        const essenceBefore = state.player.essence % 50;
        const healthGain = Math.floor((essenceBefore + modifiedAmount) / 50);
        if (healthGain > 0) {
            state.player.maxHealth += healthGain;
            state.player.health += healthGain;
        }
    }
    state.player.essence += modifiedAmount;
    while (state.player.essence >= state.player.essenceToNextLevel) {
        levelUp();
    }
}

function getSafeSpawnLocation() {
    const edgeMargin = 100;
    let x, y;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -edgeMargin; break;
        case 1: x = Math.random() * canvas.width; y = canvas.height + edgeMargin; break;
        case 2: x = -edgeMargin; y = Math.random() * canvas.height; break;
        case 3: x = canvas.width + edgeMargin; y = Math.random() * canvas.height; break;
    }
    return { x, y };
}

export function getBossesForStage(stageNum) {
    if (stageNum <= 30) {
        const stageData = STAGE_CONFIG.find(s => s.stage === stageNum);
        return stageData ? stageData.bosses : [];
    }
    const proceduralBossData = bossData.filter(b => b.difficulty_tier);
    const bossPools = {
        tier1: proceduralBossData.filter(b => b.difficulty_tier === 1),
        tier2: proceduralBossData.filter(b => b.difficulty_tier === 2),
        tier3: proceduralBossData.filter(b => b.difficulty_tier === 3)
    };
    let difficultyBudget = Math.floor((stageNum - 31) / 2) + 4;
    const bossesToSpawn = new Set();
    const keystoneBossIndex = (stageNum - 31) % proceduralBossData.length;
    const keystoneBoss = proceduralBossData[keystoneBossIndex];
    if (keystoneBoss) {
        bossesToSpawn.add(keystoneBoss.id);
        difficultyBudget -= keystoneBoss.difficulty_tier;
    }
    const availableTiers = [bossPools.tier3, bossPools.tier2, bossPools.tier1].filter(pool => pool.length > 0);
    let emergencyBreak = 0;
    while (difficultyBudget > 0 && emergencyBreak < 10) {
        let bossSelectedInLoop = false;
        for (const pool of availableTiers) {
            const tierCost = pool[0].difficulty_tier;
            if (difficultyBudget >= tierCost) {
                let candidateBoss = null;
                for (let i = 0; i < pool.length; i++) {
                    const bossIndex = (stageNum + bossesToSpawn.size + i) % pool.length;
                    if (!bossesToSpawn.has(pool[bossIndex].id)) {
                        candidateBoss = pool[bossIndex];
                        break;
                    }
                }
                if (candidateBoss) {
                    bossesToSpawn.add(candidateBoss.id);
                    difficultyBudget -= tierCost;
                    bossSelectedInLoop = true;
                    break;
                }
            }
        }
        if (!bossSelectedInLoop) break;
        emergencyBreak++;
    }
    return Array.from(bossesToSpawn);
}

export function spawnBossesForStage(stageNum) {
    let bossIdsToSpawn = state.arenaMode && state.customOrreryBosses.length > 0
        ? state.customOrreryBosses
        : getBossesForStage(stageNum);
    if (bossIdsToSpawn && bossIdsToSpawn.length > 0) {
        bossIdsToSpawn.forEach(bossId => {
            spawnEnemy(true, bossId, getSafeSpawnLocation());
        });
        if (playerHasCore('centurion')) {
            const corners = [
                {x: 100, y: 100}, {x: canvas.width - 100, y: 100},
                {x: 100, y: canvas.height - 100}, {x: canvas.width - 100, y: canvas.height - 100}
            ];
            corners.forEach(pos => {
                state.effects.push({ type: 'containment_pylon', x: pos.x, y: pos.y, r: 25, endTime: Infinity });
            });
            play('architectBuild');
        }
    } else {
        console.error(`No boss configuration found for stage ${stageNum}`);
    }
}

export function spawnEnemy(isBoss = false, bossId = null, location = null) {
    const e = {
        x: location ? location.x : Math.random() * canvas.width,
        y: location ? location.y : Math.random() * canvas.height,
        dx: (Math.random() - 0.5) * 0.75,
        dy: (Math.random() - 0.5) * 0.75,
        r: isBoss ? 50 : 15,
        hp: isBoss ? 200 : 1,
        maxHP: isBoss ? 200 : 1,
        boss: isBoss,
        frozen: false,
        targetBosses: false,
        instanceId: Date.now() + Math.random(),
    };
    if (isBoss) {
        const bd = bossData.find(b => b.id === bossId);
        if (!bd) { console.error("Boss data not found for id", bossId); return null; }
        Object.assign(e, bd);
        const baseHp = bd.maxHP || 200;
        let difficultyIndex = state.arenaMode
            ? state.customOrreryBosses.reduce((sum, bId) => sum + (bossData.find(b => b.id === bId)?.difficulty_tier || 0), 0) * 2.5
            : (state.currentStage - 1);
        const scalingFactor = 12;
        const finalHp = baseHp + (Math.pow(difficultyIndex, 1.5) * scalingFactor);
        e.maxHP = Math.round(finalHp);
        e.hp = e.maxHP;
        state.enemies.push(e);
        if (bd.init) bd.init(e, state, spawnEnemy, canvas);
        if (!state.bossActive) {
            const stageInfo = STAGE_CONFIG.find(s => s.stage === state.currentStage);
            let bannerName = state.arenaMode ? "Forged Timeline" : (stageInfo?.displayName || e.name || "Custom Encounter");
            showBossBanner({ name: bannerName });
            AudioManager.playSfx('bossSpawnSound');
            AudioManager.crossfadeToNextTrack();
        }
        state.bossActive = true;
    } else {
        state.enemies.push(e);
    }
    return e;
}

export function spawnPickup() {
    if (playerHasCore('shaper_of_fate') && state.player.talent_states.core_states.shaper_of_fate?.isDisabled) return;
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
    if (anomalyRank) life *= (1 + [0.25, 0.5][anomalyRank - 1]);
    state.pickups.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 12, type, vx: 0, vy: 0,
        lifeEnd: Date.now() + life
    });
}

export function gameTick(mx, my) {
    if (state.isPaused) return true;
    const now = Date.now();
    let dynamicDamageMultiplier = 1.0;
    if (playerHasCore('aethel_and_umbra') && state.player.health <= state.player.maxHealth * 0.5) {
        dynamicDamageMultiplier = 1.10;
    }
    const timeEater = state.enemies.find(e => e.id === 'time_eater');
    const timeEaterZones = timeEater && timeEater.effects ? timeEater.effects : [];
    const otherSlowZones = state.effects.filter(e => e.type === 'slow_zone' || e.type === 'dilation_field');
    const allSlowZones = [...timeEaterZones, ...otherSlowZones];

    if (!state.gameOver) {
        if (state.arenaMode) {
            if (!state.bossHasSpawnedThisRun) {
                spawnBossesForStage(state.currentStage);
                state.bossHasSpawnedThisRun = true;
            }
        } else {
            if (!state.bossActive && state.bossSpawnCooldownEnd > 0 && now > state.bossSpawnCooldownEnd) {
                state.bossSpawnCooldownEnd = 0;
                spawnBossesForStage(state.currentStage);
                if (playerHasCore('shaper_of_fate') && !state.player.talent_states.core_states.shaper_of_fate.isDisabled) {
                     for(let i=0; i < 3; i++) {
                         state.pickups.push({
                            x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
                            y: Math.random() * canvas.height * 0.8 + canvas.height * 0.1,
                            r: 12, type: 'rune_of_fate', lifeEnd: now + 999999
                         });
                    }
                    state.player.talent_states.core_states.shaper_of_fate.isDisabled = true;
                }
            }
        }
        if (state.bossActive) {
            if (Math.random() < (0.007 + state.player.level * 0.001)) spawnEnemy(false);
            const baseSpawnChance = 0.02 + state.player.level * 0.0002;
            const finalSpawnChance = baseSpawnChance * state.player.talent_modifiers.power_spawn_rate_modifier;
            if (Math.random() < finalSpawnChance) spawnPickup();
        }
    }
    
    if (state.gameOver) {
        stopAllLoopingSounds();
        const gameOverMenu = document.getElementById('gameOverMenu');
        const aberrationBtn = document.getElementById('aberrationCoreMenuBtn');
        aberrationBtn.style.display = state.player.level >= 10 ? 'block' : 'none';
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
    
    const phaseMomentumTalent = state.player.purchasedTalents.get('phase-momentum');
    if (phaseMomentumTalent) {
        state.player.talent_states.phaseMomentum.active = now - state.player.talent_states.phaseMomentum.lastDamageTime > 8000;
    } else {
        state.player.talent_states.phaseMomentum.active = false;
    }
    
    let playerSpeedMultiplier = state.player.talent_states.phaseMomentum.active ? 1.10 : 1.0;
    const isBerserkImmune = state.player.berserkUntil > now && state.player.purchasedTalents.has('unstoppable-frenzy');
    if (state.player.statusEffects.some(e => e.name === 'Slowed' || e.name === 'Epoch-Slow') && !isBerserkImmune) {
        playerSpeedMultiplier *= 0.5;
    }
    if (playerHasCore('aethel_and_umbra')) {
        if (state.player.health > state.player.maxHealth * 0.5) playerSpeedMultiplier *= 1.10;
    }
    allSlowZones.forEach(zone => {
        if (Math.hypot(state.player.x - zone.x, state.player.y - zone.y) < zone.r && !isBerserkImmune) {
            playerSpeedMultiplier *= 0.5;
        }
    });

    state.effects.forEach(effect => { 
        if (effect.type === 'black_hole' && effect.caster !== state.player) {
            const dist = Math.hypot(state.player.x - effect.x, state.player.y - effect.y);
            const elapsed = now - effect.startTime;
            const progress = Math.min(1, elapsed / effect.duration);
            const currentPullRadius = effect.maxRadius * progress;
            if (dist < currentPullRadius) {
                let pullStrength = 0.08;
                state.player.x += (effect.x - state.player.x) * pullStrength;
                state.player.y += (effect.y - state.player.y) * pullStrength;
            }
        }
    });

    if (now > state.player.stunnedUntil) {
        const juggernautCharge = state.effects.find(e => e.type === 'juggernaut_player_charge');
        if (!juggernautCharge) {
            state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
            state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
        }
    }
    
    state.player.x = Math.max(state.player.r, Math.min(canvas.width - state.player.r, state.player.x));
    state.player.y = Math.max(state.player.r, Math.min(canvas.height - state.player.r, state.player.y));

    if (playerHasCore('epoch_ender') && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
        const history = state.player.talent_states.core_states.epoch_ender.history;
        history.push({ x: state.player.x, y: state.player.y, health: state.player.health });
        if(history.length > 120) history.shift();
    }

    Cores.applyCoreTickEffects(gameHelpers);

    for (let i = state.decoys.length - 1; i >= 0; i--) {
        const decoy = state.decoys[i];
        if (decoy.hp <= 0 || (decoy.expires && now > decoy.expires)) {
            utils.spawnParticles(state.particles, decoy.x, decoy.y, '#a55eea', 30, 2);
            state.decoys.splice(i, 1);
            continue;
        }
        if (decoy.isMobile) {
            let closestEnemy = null;
            let minDist = Infinity;
            for (const enemy of state.enemies) {
                if (!enemy.isFriendly) {
                    const dist = Math.hypot(decoy.x - enemy.x, decoy.y - enemy.y);
                    if (dist < minDist) {
                        minDist = dist;
                        closestEnemy = enemy;
                    }
                }
            }
            if (closestEnemy) {
                const angle = Math.atan2(closestEnemy.y - decoy.y, closestEnemy.x - decoy.x);
                decoy.x += Math.cos(angle) * 2;
                decoy.y += Math.sin(angle) * 2;
            }
        }
    }
    
    if(playerHasCore('sentinel_pair') && state.decoys.length > 0) {
        const decoy = state.decoys[0];
        for(const enemy of state.enemies) {
            if(!enemy.isFriendly && utils.lineCircleCollision(state.player.x, state.player.y, decoy.x, decoy.y, enemy.x, enemy.y, enemy.r)) {
                enemy.hp -= 0.5 * state.player.talent_modifiers.damage_multiplier;
                Cores.handleCoreOnDamageDealt(enemy);
            }
        }
    }

    if (state.gravityActive && now > state.gravityEnd) {
        state.gravityActive = false;
        if (state.player.purchasedTalents.has('temporal-collapse')) {
            state.effects.push({ type: 'slow_zone', x: canvas.width / 2, y: canvas.height / 2, r: 250, endTime: Date.now() + 4000 });
        }
    }

    if (state.player.infected) {
        if (now > state.player.infectionEnd) {
            state.player.infected = false;
        } else if (now - state.player.lastSpore > 2000) {
            state.player.lastSpore = now;
            const spore = spawnEnemy(false, null, {x: state.player.x, y: state.player.y});
            if(spore){
                spore.r = 8; spore.hp = 2; spore.dx = (Math.random() - 0.5) * 8;
                spore.dy = (Math.random() - 0.5) * 8; spore.ignoresPlayer = true;
            }
        }
    }
    
    if (state.player.talent_states.phaseMomentum.active) {
        ctx.globalAlpha = 0.3;
        utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r + 5, 'rgba(0, 255, 255, 0.5)');
        utils.spawnParticles(state.particles, state.player.x, state.player.y, 'rgba(0, 255, 255, 0.5)', 1, 0.5, 10, state.player.r * 0.5);
        ctx.globalAlpha = 1.0;
    }

    if (state.player.shield) {
        ctx.strokeStyle = "rgba(241,196,15,0.7)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(state.player.x, state.player.y, Math.max(0, state.player.r + 8), 0, 2 * Math.PI);
        ctx.stroke();
    }
    
    let playerColor = state.player.shield ? "#f1c40f" : ((state.player.berserkUntil > now) ? '#e74c3c' : (state.player.infected ? '#55efc4' : "#3498db"));
    let playerAlpha = 1.0;
    const isPhased = playerHasCore('quantum_shadow') && state.player.statusEffects.some(e => e.name === 'Phased');
    if (isPhased) {
        playerColor = '#00ecec';
        playerAlpha = 0.5;
    }
    ctx.globalAlpha = playerAlpha;
    utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r, playerColor);
    ctx.globalAlpha = 1.0;

    const juggernautCharge = state.effects.find(e => e.type === 'juggernaut_player_charge');
    if (juggernautCharge) {
        const progress = (now - juggernautCharge.startTime) / juggernautCharge.duration;
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#636e72', 3, 2, 20, 5);
        const afterImageX = state.player.x - Math.cos(juggernautCharge.angle) * 20 * progress;
        const afterImageY = state.player.y - Math.sin(juggernautCharge.angle) * 20 * progress;
        ctx.globalAlpha = 0.5 * (1 - progress);
        utils.drawCircle(ctx, afterImageX, afterImageY, state.player.r, '#636e72');
        ctx.globalAlpha = 1.0;
    }
    
    if (equippedCoreId && !isPhased && !juggernautCharge) {
        const coreData = bossData.find(b => b.id === equippedCoreId);
        if (coreData) {
            const pulse = 0.4 + (Math.sin(now / 400) * 0.2);
            ctx.globalAlpha = pulse;
            const glowColor = equippedCoreId === 'pantheon' ? `hsl(${(now / 20) % 360}, 100%, 70%)` : coreData.color;
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.arc(state.player.x, state.player.y, state.player.r + 10, 0, 2 * Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
    
    state.decoys.forEach(decoy => {
        utils.drawCircle(ctx, decoy.x, decoy.y, decoy.r, "#9b59b6");
    });
    if(playerHasCore('sentinel_pair') && state.decoys.length > 0) {
        utils.drawLightning(ctx, state.player.x, state.player.y, state.decoys[0].x, state.decoys[0].y, '#f1c40f');
    }

    let totalPlayerPushX = 0;
    let totalPlayerPushY = 0;
    let playerCollisions = 0;

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.hp <= 0) {
            if (e.boss) {
                Cores.handleCoreOnEnemyDeath(e, gameHelpers);
                if (e.onDeath) e.onDeath(e, state, spawnEnemy, spawnParticlesCallback, play, stopLoopingSfx);
                state.enemies.splice(i, 1);
                if (!state.enemies.some(en => en.boss)) {
                    state.bossActive = false;
                    AudioManager.playSfx('bossDefeatSound');
                    AudioManager.fadeOutMusic();
                    if (state.arenaMode) {
                        showUnlockNotification("Timeline Forged!", "Victory");
                        setTimeout(() => { state.gameOver = true; }, 2000);
                    } else {
                        state.bossSpawnCooldownEnd = now + 4000;
                        if (state.currentStage > state.player.highestStageBeaten) {
                            state.player.highestStageBeaten = state.currentStage;
                            state.player.ascensionPoints += 1;
                            showUnlockNotification("Stage Cleared! +1 AP", `Stage ${state.currentStage + 1} Unlocked`);
                        }
                        if (THEMATIC_UNLOCKS[state.currentStage + 1]) handleThematicUnlock(state.currentStage);
                        addEssence(300);
                        state.currentStage++;
                        savePlayerState();
                    }
                }
            } else {
                addEssence(75);
                Cores.handleCoreOnEnemyDeath(e, gameHelpers);
                if (state.player.purchasedTalents.has('thermal-runaway') && state.player.berserkUntil > now) {
                    state.player.berserkUntil += 100;
                }
                const scavengerRank = state.player.purchasedTalents.get('power-scavenger');
                if (scavengerRank && Math.random() < [0.01, 0.025][scavengerRank-1]) {
                    state.pickups.push({ x: e.x, y: e.y, r: 12, type: 'score', vx: 0, vy: 0, lifeEnd: now + 10000 });
                }
                const cryoRank = state.player.purchasedTalents.get('cryo-shatter');
                if (cryoRank && e.wasFrozen && Math.random() < [0.25, 0.5][cryoRank-1]) {
                    utils.spawnParticles(state.particles, e.x, e.y, '#ADD8E6', 40, 4, 30, 2);
                    state.effects.push({ type: 'shockwave', caster: state.player, x: e.x, y: e.y, radius: 0, maxRadius: 100, speed: 500, startTime: now, hitEnemies: new Set(), damage: 5 * state.player.talent_modifiers.damage_multiplier, color: 'rgba(0, 200, 255, 0.5)' });
                    if (state.player.purchasedTalents.has('glacial-propagation')) {
                        state.effects.push({ type: 'small_freeze', x: e.x, y: e.y, radius: 100, endTime: now + 200 });
                    }
                }
                state.enemies.splice(i, 1);
            }
            continue;
        }

        if(e.lifeEnd && now > e.lifeEnd) { state.enemies.splice(i, 1); continue; }
        if (e.frozenUntil && now > e.frozenUntil) {
            e.frozen = false; e.frozenUntil = null; e.dx = e._dx; e.dy = e._dy;
        }
        if (e.isInfected && !e.boss) {
            if (now > e.infectionEnd) e.isInfected = false;
            else if (now - (e.lastSpore || 0) > 3000) {
                e.lastSpore = now;
                const spore = spawnEnemy(false, null, { x: e.x, y: e.y });
                if (spore) {
                    spore.r = 6; spore.hp = 1; spore.dx = (Math.random() - 0.5) * 8;
                    spore.dy = (Math.random() - 0.5) * 8; spore.ignoresPlayer = true;
                }
            }
        }
        
        const isRepulsionTarget = !e.boss || e.id === 'fractal_horror';
        if (isRepulsionTarget && state.effects.filter(eff => eff.type === 'repulsion_field').length > 0) {
            state.effects.filter(eff => eff.type === 'repulsion_field').forEach(field => {
                const dist = Math.hypot(e.x - field.x, e.y - field.y);
                if (dist < field.radius + e.r) {
                    const angle = Math.atan2(e.y - field.y, e.x - field.x);
                    if (field.isOverloaded && !field.hitEnemies.has(e)) {
                        e.knockbackDx = Math.cos(angle) * 20; e.knockbackDy = Math.sin(angle) * 20;
                        e.knockbackUntil = now + 2000;
                        field.hitEnemies.add(e);
                    }
                    e.x += Math.cos(angle) * 5; e.y += Math.sin(angle) * 5;
                }
            });
        }
        
        if (e.id === 'time_eater' && e.effects) {
            for (let j = e.effects.length - 1; j >= 0; j--) {
                const zone = e.effects[j];
                if (now > zone.endTime) e.effects.splice(j, 1);
            }
        }

        if (e.eatenBy) {
            const pullX = e.eatenBy.x - e.x, pullY = e.eatenBy.y - e.y;
            const pullDist = Math.hypot(pullX, pullY) || 1;
            e.x += (pullX / pullDist) * 3; e.y += (pullY / pullDist) * 3;
            e.r *= 0.95;
            if (e.r < 2) {
                if (timeEater) timeEater.hp -= 10;
                utils.spawnParticles(state.particles, e.x, e.y, "#d63031", 10, 2, 15);
                state.enemies.splice(i, 1);
                continue;
            }
        } else if (e.knockbackUntil && e.knockbackUntil > now) {
            e.x += e.knockbackDx; e.y += e.knockbackDy;
            e.knockbackDx *= 0.98; e.knockbackDy *= 0.98;
            if (e.x < e.r || e.x > canvas.width - e.r) {
                e.x = Math.max(e.r, Math.min(canvas.width - e.r, e.x)); e.knockbackDx *= -0.8;
            }
            if (e.y < e.r || e.y > canvas.height - e.r) {
                e.y = Math.max(e.r, Math.min(canvas.height - e.r, e.y)); e.knockbackDy *= -0.8;
            }
        } else if(!e.frozen && !e.hasCustomMovement){ 
             let tgt = e.isFriendly ? null : (state.decoys.length > 0 ? state.decoys[0] : state.player);
            if (e.isFriendly) {
                let closestEnemy = null, minDist = Infinity;
                state.enemies.forEach(other => {
                    if (!other.isFriendly && !other.boss) {
                        const dist = Math.hypot(e.x - other.x, e.y - other.y);
                        if (dist < minDist) { minDist = dist; closestEnemy = other; }
                    }
                });
                tgt = closestEnemy;
            }
            
            let enemySpeedMultiplier = 1;
            if (state.gravityActive && now < state.gravityEnd && !e.boss) {
                e.x += ((canvas.width / 2) - e.x) * 0.05; e.y += ((canvas.height / 2) - e.y) * 0.05;
            }
            allSlowZones.forEach(zone => {
                if(Math.hypot(e.x - zone.x, e.y - zone.y) < zone.r) enemySpeedMultiplier = 0.5;
            });
            
            if (e.glitchedUntil > now) {
                if (!e.glitchMoveTarget || now > e.glitchMoveTarget.until) {
                    e.glitchMoveTarget = { x: e.x + (Math.random() - 0.5) * 200, y: e.y + (Math.random() - 0.5) * 200, until: now + 300 };
                }
                const gdx = e.glitchMoveTarget.x - e.x;
                const gdy = e.glitchMoveTarget.y - e.y;
                const gmag = Math.hypot(gdx, gdy);
                if(gmag > 1) {
                    e.x += (gdx / gmag) * e.speed * enemySpeedMultiplier;
                    e.y += (gdy / gmag) * e.speed * enemySpeedMultiplier;
                }
            } else {
                state.effects.forEach(effect => {
                    if (effect.type === 'architect_pillar' || effect.type === 'containment_pylon') {
                        const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                        if (dist < e.r + effect.r) {
                            const angle = Math.atan2(e.y - effect.y, e.x - effect.x);
                            e.x = effect.x + Math.cos(angle) * (e.r + effect.r);
                            e.y = effect.y + Math.sin(angle) * (e.r + effect.r);
                        }
                    }
                    if (effect.type === 'black_hole' && e.id !== 'fractal_horror') {
                        const elapsed = now - effect.startTime, progress = Math.min(1, elapsed / effect.duration);
                        const currentPullRadius = effect.maxRadius * progress, dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                        if (dist < currentPullRadius) {
                            let pullStrength = e.boss ? 0.03 : 0.1;
                            e.x += (effect.x - e.x) * pullStrength; e.y += (effect.y - e.y) * pullStrength;
                            if (state.player.purchasedTalents.has('unstable-singularity') && dist < effect.radius + e.r && now - (effect.lastDamage.get(e) || 0) > effect.damageRate) {
                                let finalDmg = (e.boss ? effect.damage : 15) * state.player.talent_modifiers.damage_multiplier * dynamicDamageMultiplier;
                                e.hp -= finalDmg;
                                Cores.handleCoreOnDamageDealt(e);
                                effect.lastDamage.set(e, now);
                            }
                        }
                    }
                });
                if (tgt) {
                  const vx = (tgt.x - e.x) * 0.005 * enemySpeedMultiplier; const vy = (tgt.y - e.y) * 0.005 * enemySpeedMultiplier; 
                  e.x += vx; e.y += vy; 
                }
                e.x += e.dx * enemySpeedMultiplier; e.y += e.dy * enemySpeedMultiplier;
                if(e.x<e.r || e.x>canvas.width-e.r) e.dx*=-1; 
                if(e.y<e.r || e.y>canvas.height-e.r) e.dy*=-1;
            }
        }
        
        if (e.boss && e.logic) e.logic(e, ctx, state, utils, gameHelpers);
        
        let color = e.customColor || (e.boss ? e.color : "#c0392b"); 
        if(e.isInfected) color = '#55efc4'; 
        if(e.frozen) color = '#add8e6';
        if(e.petrifiedUntil > now) color = '#95a5a6';
        
        ctx.save();
        if (e.glitchedUntil > now) ctx.filter = `blur(1px) hue-rotate(${Math.random() * 90}deg)`;
        if(!e.hasCustomDraw) utils.drawCircle(ctx, e.x,e.y,e.r, color);
        ctx.restore();

        if(e.enraged) { ctx.strokeStyle = "yellow"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x,e.y,Math.max(0, e.r+5),0,2*Math.PI); ctx.stroke(); }
        
        Cores.handleCoreOnCollision(e, gameHelpers);

        if(!e.isFriendly) {
            const hasPhased = playerHasCore('quantum_shadow') && state.player.statusEffects.some(eff => eff.name === 'Phased');
            const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
            const juggernautCharging = state.effects.some(eff => eff.type === 'juggernaut_player_charge');
            if(pDist < e.r+state.player.r && !hasPhased && !juggernautCharging){
                if (state.player.talent_states.phaseMomentum.active && !e.boss) {
                    // No collision damage
                } else {
                    state.player.talent_states.phaseMomentum.lastDamageTime = now;
                    state.player.talent_states.phaseMomentum.active = false;
                    if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); 
                    
                    let damage = Cores.handleCoreOnPlayerDamage(e.boss ? (e.enraged ? 20 : 10) : 1, e, gameHelpers);
                    damage *= state.player.talent_modifiers.damage_taken_multiplier;

                    if(!state.player.shield && damage > 0){ 
                        const wouldBeFatal = (state.player.health - damage) <= 0;
                        if (wouldBeFatal && Cores.handleCoreOnFatalDamage(e, gameHelpers)) {
                            // Death prevented by core
                        } else if(wouldBeFatal && state.player.purchasedTalents.has('contingency-protocol') && !state.player.contingencyUsed) {
                            state.player.contingencyUsed = true; state.player.health = 1;
                            addStatusEffect('Contingency Protocol', '🛡️', 3000);
                            const invulnShieldEndTime = now + 3000;
                            state.player.shield = true;
                            state.player.shield_end_time = invulnShieldEndTime;
                            setTimeout(()=> { if(state.player.shield_end_time <= invulnShieldEndTime) state.player.shield = false; }, 3000);
                        } else {
                            state.player.health -= damage; 
                        }
                        play('hitSound'); 
                        if(e.onDamage) e.onDamage(e, damage, state.player, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                        if(state.player.health<=0) state.gameOver=true; 
                    } else if (state.player.shield && damage > 0) { 
                        state.player.shield=false; 
                        play('shieldBreak');
                        Cores.handleCoreOnShieldBreak();
                        if(state.player.purchasedTalents.has('aegis-retaliation')) state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 250, speed: 1000, startTime: now, hitEnemies: new Set(), damage: 0, color: 'rgba(255, 255, 255, 0.5)' });
                    }
                    const overlap = (e.r + state.player.r) - pDist;
                    const ang=Math.atan2(state.player.y-e.y,state.player.x-e.x); 
                    totalPlayerPushX += Math.cos(ang) * overlap;
                    totalPlayerPushY += Math.sin(ang) * overlap;
                    playerCollisions++;
                }
            }
        } else {
            state.enemies.forEach(other => {
                if(!other.isFriendly && Math.hypot(e.x - other.x, e.y - other.y) < e.r + other.r) {
                    other.hp -= 0.5; e.hp -= 0.5;
                }
            });
        }
    }

    if (playerCollisions > 0) {
        state.player.x += totalPlayerPushX / playerCollisions;
        state.player.y += totalPlayerPushY / playerCollisions;
    }

    for (let i = state.pickups.length - 1; i >= 0; i--) {
        const p = state.pickups[i];
        if (p.lifeEnd && now > p.lifeEnd) { state.pickups.splice(i, 1); continue; }
        let eaten = false;
        allSlowZones.forEach(zone => {
            if (Math.hypot(p.x - zone.x, p.y - zone.y) < zone.r) {
                p.eatenBy = zone; eaten = true;
            }
        });
        if (!eaten) p.eatenBy = null;
        if (p.eatenBy) {
            const pullX = p.eatenBy.x - p.x; const pullY = p.eatenBy.y - p.y;
            p.vx = (pullX / (Math.hypot(pullX, pullY) || 1)) * 3; p.vy = (pullY / (Math.hypot(pullX, pullY) || 1)) * 3;
            p.r *= 0.95;
            if (p.r < 2) {
                if (timeEater) timeEater.hp = Math.min(timeEater.maxHP, timeEater.hp + 10);
                utils.spawnParticles(state.particles, p.x, p.y, "#fff", 10, 2, 15);
                state.pickups.splice(i, 1);
                continue;
            }
        } else {
            const pickupRadius = 75 + state.player.talent_modifiers.pickup_radius_bonus;
            const d = Math.hypot(state.player.x - p.x, state.player.y - p.y);
            if (p.isSeeking || d < pickupRadius) {
                 const pullStrength = p.isSeeking ? 1.2 : 0.5;
                 const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
                 p.vx += Math.cos(angle) * pullStrength; p.vy += Math.sin(angle) * pullStrength;
            }
            p.vx *= 0.95; p.vy *= 0.95;
        }
        p.x += p.vx; p.y += p.vy;

        let pickupColor = p.emoji === '🩸' ? '#800020' : '#2ecc71';
        if (p.type === 'rune_of_fate') pickupColor = '#f1c40f';
        utils.drawCircle(ctx, p.x, p.y, p.r, pickupColor);
        ctx.fillStyle="#fff"; ctx.font="16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.type === 'rune_of_fate' ? '⭐' : (p.emoji || powers[p.type]?.emoji || '?'), p.x, p.y+6);
        ctx.textAlign = "left";
        
        if(Math.hypot(state.player.x - p.x, state.player.y - p.y) < state.player.r + p.r){
            play('pickupSound'); 
            if (p.type === 'rune_of_fate') {
                 addStatusEffect('Shaper\'s Boon', '⭐', 999999);
                 state.player.talent_modifiers.damage_multiplier *= 1.05;
                 state.player.talent_modifiers.pickup_radius_bonus += 20;
                 play('shaperAttune');
                 state.pickups.splice(i, 1);
                 continue;
            }
            if (state.player.purchasedTalents.has('essence-weaving')) {
                state.player.health = Math.min(state.player.maxHealth, state.player.health + state.player.maxHealth * 0.02);
            }
            Cores.handleCoreOnPickup(gameHelpers);
            if (p.customApply) { p.customApply(); state.pickups.splice(i,1); continue; }
            const isOffensive = offensivePowers.includes(p.type);
            const targetInventory = isOffensive ? state.offensiveInventory : state.defensiveInventory;
            const maxSlots = isOffensive ? state.player.unlockedOffensiveSlots : state.player.unlockedDefensiveSlots;
            const idx = targetInventory.indexOf(null);
            if(idx !== -1 && idx < maxSlots){
                targetInventory[idx]=p.type; 
                state.pickups.splice(i,1);
            } else {
                if(state.player.purchasedTalents.has('overload-protocol')) {
                    addStatusEffect('Auto-Used', powers[p.type]?.emoji || '?', 2000);
                    usePower(p.type, true);
                    state.pickups.splice(i, 1);
                } else {
                    utils.spawnParticles(state.particles, p.x, p.y, "#f00", 15, 2, 20); 
                    state.pickups.splice(i,1);
                }
            }
        }
    }

    for (let i = state.effects.length - 1; i >= 0; i--) {
        const effect = state.effects[i];
        if (now > (effect.endTime || Infinity)) {
            if (effect.type === 'shrinking_box') stopLoopingSfx('wallShrink');
            if (effect.type === 'black_hole' && state.player.purchasedTalents.has('unstable-singularity')) {
                state.effects.push({ type: 'shockwave', caster: state.player, x: effect.x, y: effect.y, radius: 0, maxRadius: 200, speed: 800, startTime: now, hitEnemies: new Set(), damage: 25 * state.player.talent_modifiers.damage_multiplier * dynamicDamageMultiplier, color: 'rgba(155, 89, 182, 0.7)' });
            }
            state.effects.splice(i, 1);
            continue;
        }

        const hasReflectiveWard = playerHasCore('reflector') && state.player.statusEffects.some(eff => eff.name === 'Reflective Ward');
        if (effect.type === 'nova_bullet' || effect.type === 'ricochet_projectile' || effect.type === 'seeking_shrapnel' || effect.type === 'helix_bolt' || effect.type === 'player_fragment') {
            let speedMultiplier = 1.0;
            allSlowZones.forEach(zone => {
                if (Math.hypot(effect.x - zone.x, effect.y - zone.y) < zone.r) speedMultiplier = 0.2;
            });
            state.effects.forEach(eff => {
                if (eff.type === 'dilation_field') {
                    if (eff.shape === 'horseshoe') {
                        if (Math.hypot(effect.x - eff.x, effect.y - eff.y) < eff.r) {
                             let projAngle = Math.atan2(effect.y - eff.y, effect.x - eff.x);
                             let diff = Math.atan2(Math.sin(projAngle - eff.angle), Math.cos(projAngle - eff.angle));
                             if (Math.abs(diff) > (Math.PI / 4)) speedMultiplier = 0.2;
                        }
                    }
                }
            });

            if (hasReflectiveWard && effect.caster !== state.player && effect.caster !== 'reflected') {
                const distToPlayer = Math.hypot(state.player.x - effect.x, state.player.y - effect.y);
                if (distToPlayer < state.player.r + effect.r) {
                    const nearestEnemy = state.enemies.filter(e => !e.isFriendly).sort((a,b) => Math.hypot(a.x - effect.x, a.y - effect.y) - Math.hypot(b.x - effect.x, b.y - effect.y))[0];
                    if (nearestEnemy) {
                        const angleToEnemy = Math.atan2(nearestEnemy.y - effect.y, nearestEnemy.x - effect.x);
                        effect.dx = Math.cos(angleToEnemy) * Math.hypot(effect.dx, effect.dy);
                        effect.dy = Math.sin(angleToEnemy) * Math.hypot(effect.dx, effect.dy);
                    } else {
                        effect.dx *= -1;
                        effect.dy *= -1;
                    }
                    effect.caster = 'reflected'; 
                    effect.color = '#2ecc71'; 
                    play('reflectorOnHit');
                }
            }
            effect.x += effect.dx * speedMultiplier;
            effect.y += effect.dy * speedMultiplier;
        }

        if (effect.type === 'shockwave') {
            const elapsed = (now - effect.startTime) / 1000; effect.radius = elapsed * effect.speed;
            ctx.strokeStyle = effect.color || `rgba(255, 255, 255, ${1-(effect.radius/effect.maxRadius)})`; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(effect.x, effect.y, Math.max(0, effect.radius), 0, 2 * Math.PI); ctx.stroke();
            let targets = (effect.caster === state.player || effect.caster === 'reflected') ? state.enemies.filter(e => !e.isFriendly) : [state.player];
            targets.forEach(target => {
                if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) {
                    if (effect.damage > 0) {
                        let dmg = (target.isPuppet && (effect.caster === state.player || effect.caster === 'reflected')) ? target.maxHP / 2 : (target.boss || target === state.player) ? effect.damage : 1000;
                        if (target === state.player) {
                            if (!target.shield) {
                                target.health -= dmg;
                                if (target.health <= 0) state.gameOver = true;
                            } else target.shield = false;
                        } else {
                            if (playerHasCore('basilisk')) {
                                target.petrifiedUntil = now + 3000;
                                target.wasFrozen = true;
                            }
                            let finalDmg = dmg * dynamicDamageMultiplier;
                            if(target.petrifiedUntil > now) finalDmg *= 1.20;
                            target.hp -= finalDmg;
                            Cores.handleCoreOnDamageDealt(target);
                        }
                        if (target.onDamage) target.onDamage(target, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    }
                    effect.hitEnemies.add(target);
                }
            });
            if (effect.radius >= effect.maxRadius) state.effects.splice(i, 1);
        }
        else if (effect.type === 'chain_lightning') {
            const linkIndex = Math.floor((now - effect.startTime) / effect.durationPerLink); if (linkIndex >= effect.targets.length) { state.effects.splice(i, 1); continue; }
            for (let j = 0; j <= linkIndex; j++) {
                const from = j === 0 ? effect.caster : effect.targets[j - 1];
                const to = effect.targets[j];
                if (!from || typeof from.x !== 'number' || !to || typeof to.x !== 'number') continue;
                utils.drawLightning(ctx, from.x, from.y, to.x, to.y, effect.color || '#00ffff', 4);
                if (!effect.links.includes(to)) {
                    utils.spawnParticles(state.particles, to.x, to.y, '#ffffff', 30, 5, 20);
                    let dmg = (to.boss ? effect.damage : 50) * state.player.talent_modifiers.damage_multiplier;
                    if (effect.caster !== state.player) dmg = effect.damage;
                    else {
                        dmg *= dynamicDamageMultiplier;
                        Cores.handleCoreOnDamageDealt(to);
                    }
                    to.hp -= dmg; 
                    if (to.onDamage) to.onDamage(to, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    effect.links.push(to);
                    if (state.player.purchasedTalents.has('volatile-finish') && j === effect.targets.length - 1) {
                         state.effects.push({ type: 'shockwave', caster: state.player, x: to.x, y: to.y, radius: 0, maxRadius: 150, speed: 600, startTime: now, hitEnemies: new Set(), damage: 15 * state.player.talent_modifiers.damage_multiplier * dynamicDamageMultiplier });
                    }
                }
            }
        }
        else if (effect.type === 'ricochet_projectile') { 
            const hasPayload = state.player.purchasedTalents.has('unstable-payload');
            if(hasPayload) { const bouncesSoFar = effect.initialBounces - effect.bounces; effect.r = 8 + bouncesSoFar * 2; effect.damage = 10 + bouncesSoFar * 5; }
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, effect.color || '#f1c40f'); 
            if(effect.x < effect.r || effect.x > canvas.width - effect.r) { effect.dx *= -1; effect.bounces--; } 
            if(effect.y < effect.r || effect.y > canvas.height - effect.r) { effect.dy *= -1; effect.bounces--; } 
            if (effect.caster === state.player || effect.caster === 'reflected') {
                state.enemies.forEach(e => { if (!e.isFriendly && !effect.hitEnemies.has(e) && Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { let damage = ((state.player.berserkUntil > now) ? effect.damage * 2 : effect.damage) * dynamicDamageMultiplier; e.hp -= damage; Cores.handleCoreOnDamageDealt(e); effect.bounces--; const angle = Math.atan2(e.y - effect.y, e.x - effect.x); effect.dx = -Math.cos(angle) * 10; effect.dy = -Math.sin(angle) * 10; effect.hitEnemies.add(e); setTimeout(()=>effect.hitEnemies.delete(e), 200); } }); 
            }
            if (effect.bounces <= 0) state.effects.splice(i, 1);
        }
        else if (effect.type === 'nova_controller') { 
            if (now > effect.startTime + effect.duration) { state.effects.splice(i, 1); continue; } 
            if(now - effect.lastShot > 50) { 
                effect.lastShot = now; const speed = 5;
                const caster = effect.caster || state.player;
                if (state.player.purchasedTalents.has('nova-pulsar') && caster === state.player) {
                    const angles = [effect.angle, effect.angle + (2 * Math.PI / 3), effect.angle - (2 * Math.PI / 3)];
                    angles.forEach(angle => { state.effects.push({ type: 'nova_bullet', x: caster.x, y: caster.y, r: effect.r || 4, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, color: effect.color, caster: caster }); });
                } else {
                    state.effects.push({ type: 'nova_bullet', x: caster.x, y: caster.y, r: effect.r || 4, dx: Math.cos(effect.angle) * speed, dy: Math.sin(effect.angle) * speed, color: effect.color, caster: caster, damage: effect.damage }); 
                }
                effect.angle += 0.5; 
            }
        }
        else if (effect.type === 'nova_bullet') { 
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, effect.color || '#fff'); 
            if(effect.x < 0 || effect.x > canvas.width || effect.y < 0 || effect.y > canvas.height) { state.effects.splice(i, 1); continue; }
            if (effect.caster === state.player || effect.caster === 'reflected') {
                state.enemies.forEach(e => { if (e !== effect.caster && !e.isFriendly && Math.hypot(e.x-effect.x, e.y-effect.y) < e.r + effect.r) { let damage = ((state.player.berserkUntil > now) ? 6 : 3) * state.player.talent_modifiers.damage_multiplier * dynamicDamageMultiplier; e.hp -= damage; Cores.handleCoreOnDamageDealt(e); state.effects.splice(i, 1); } }); 
            } else {
                const hasPhased = playerHasCore('quantum_shadow') && state.player.statusEffects.some(e => e.name === 'Phased');
                const pDist = Math.hypot(state.player.x - effect.x, state.player.y - effect.y);
                if (pDist < state.player.r + effect.r && !hasPhased) {
                    if (!state.player.shield) {
                        state.player.health -= (effect.damage || 40);
                        if(state.player.health <= 0) state.gameOver = true;
                    } else state.player.shield = false;
                    state.effects.splice(i, 1);
                } else {
                    for(const decoy of state.decoys) {
                        if (Math.hypot(decoy.x - effect.x, decoy.y - effect.y) < decoy.r + effect.r) {
                            decoy.hp -= (effect.damage || 40);
                            state.effects.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }
        else if (effect.type === 'orbital_target') {
            const hasTracking = state.player.purchasedTalents.has('targeting-algorithm');
            if(hasTracking && effect.target && effect.target.hp > 0) { effect.x = effect.target.x; effect.y = effect.target.y; }
            const duration = 1500; const progress = (now - effect.startTime) / duration; 
            if (progress >= 1) { 
                spawnParticlesCallback(effect.x, effect.y, '#e67e22', 100, 8, 40); 
                const explosionRadius = effect.radius || 150; 
                const targets = (effect.caster === state.player) ? state.enemies : [state.player];
                targets.forEach(e => { 
                    if (Math.hypot(e.x-effect.x, e.y-effect.y) < explosionRadius) { 
                        let damage = ((state.player.berserkUntil > now && effect.caster === state.player) ? 50 : 25)  * state.player.talent_modifiers.damage_multiplier; 
                        if(effect.caster !== state.player) damage = effect.damage; else damage *= dynamicDamageMultiplier;
                        if(e.health) {
                            if (!e.shield) { e.health -= damage; if(e.health <= 0) state.gameOver = true; }
                            else { e.shield = false; }
                        } else { e.hp -= damage; if (effect.caster === state.player) Cores.handleCoreOnDamageDealt(e); }
                        if(e.onDamage) e.onDamage(e, damage, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers); 
                    } 
                }); 
                state.effects.splice(i, 1); 
                continue; 
            } 
            ctx.strokeStyle = effect.color || 'rgba(230, 126, 34, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            const warningRadius = 50 * (1 - progress);
            ctx.arc(effect.x, effect.y, Math.max(0, warningRadius), 0, Math.PI*2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(effect.x-10, effect.y); ctx.lineTo(effect.x+10, effect.y);
            ctx.moveTo(effect.x, effect.y-10); ctx.lineTo(effect.x, effect.y+10);
            ctx.stroke();
        }
        else if (effect.type === 'black_hole') { 
            const elapsed = now - effect.startTime, progress = Math.min(1, elapsed / effect.duration);
            const currentPullRadius = effect.maxRadius * progress; 
            utils.drawCircle(ctx, effect.x, effect.y, effect.radius, effect.color || "#000"); 
            ctx.strokeStyle = effect.color ? `rgba(${effect.color.slice(1).match(/.{1,2}/g).map(v => parseInt(v, 16)).join(',')}, ${0.6 * progress})` : `rgba(155, 89, 182, ${0.6 * progress})`;
            ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, Math.max(0, currentPullRadius), 0, 2*Math.PI); ctx.stroke();
        }
        else if (effect.type === 'seeking_shrapnel' || effect.type === 'player_fragment') {
            let closest = null; 
            const sortedEnemies = [...state.enemies].filter(e => !e.isFriendly).sort((a,b) => Math.hypot(a.x-effect.x, a.y-effect.y) - Math.hypot(b.x-effect.x, b.y-effect.y));
            if(sortedEnemies[effect.targetIndex]) closest = sortedEnemies[effect.targetIndex]; else if (sortedEnemies.length > 0) closest = sortedEnemies[0];
            if(closest){ const angle = Math.atan2(closest.y - effect.y, closest.x - effect.x); const turnSpeed = 0.1; effect.dx = effect.dx * (1-turnSpeed) + (Math.cos(angle) * effect.speed) * turnSpeed; effect.dy = effect.dy * (1-turnSpeed) + (Math.sin(angle) * effect.speed) * turnSpeed; }
            if(effect.type === 'player_fragment') utils.drawCrystal(ctx, effect.x, effect.y, effect.r, '#ff4500');
            else utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#ff9944');
            state.enemies.forEach(e => { if(!e.isFriendly && Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { e.hp -= (effect.damage * dynamicDamageMultiplier); Cores.handleCoreOnDamageDealt(e); state.effects.splice(i, 1); }});
            if(now > effect.startTime + effect.life) state.effects.splice(i, 1);
        }
        else if (effect.type === 'small_freeze') {
            state.enemies.forEach(e => {
                if (!e.isFriendly && !e.frozen && Math.hypot(e.x - effect.x, e.y - effect.y) < effect.radius) {
                    if (Math.random() < 0.5) {
                        e.frozen = true; e.wasFrozen = true; e._dx = e.dx; e._dy = e.dy; e.dx = e.dy = 0;
                        e.frozenUntil = now + 1000;
                    }
                }
            });
            state.effects.splice(i, 1);
        }
        else if (effect.type === 'player_pull_pulse') {
            const progress = (now - effect.startTime) / effect.duration;
            if (progress >= 1) { state.effects.splice(i, 1); continue; }
            const currentRadius = effect.maxRadius * progress;
            ctx.strokeStyle = `rgba(155, 89, 182, ${1-progress})`;
            ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(effect.x, effect.y, currentRadius, 0, 2 * Math.PI); ctx.stroke();
            state.enemies.forEach(e => {
                const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                if (!e.boss && dist < currentRadius && dist > 0) {
                    const angle = Math.atan2(e.y - effect.y, e.x - effect.x);
                    e.x += Math.cos(angle) * 12; e.y += Math.sin(angle) * 12;
                    e.stunnedUntil = now + 250;
                }
            });
            state.pickups.forEach(p => {
                const dist = Math.hypot(p.x - effect.x, p.y - effect.y);
                if (dist < currentRadius) {
                    const angle = Math.atan2(effect.y - p.y, effect.x - p.x);
                    p.vx += Math.cos(angle) * 2.5; p.vy += Math.sin(angle) * 2.5;
                }
            });
        }
        else if (effect.type === 'architect_pillar' || effect.type === 'containment_pylon') {
            const color = effect.type === 'architect_pillar' ? '#7f8c8d' : '#d35400';
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, color);
            if (effect.type === 'containment_pylon') {
                 state.enemies.forEach(e => {
                    if(!e.isFriendly && Math.hypot(e.x - effect.x, e.y - effect.y) < 150) {
                         utils.drawLightning(ctx, effect.x, effect.y, e.x, e.y, '#d35400');
                    }
                 });
            }
        }
        else if (effect.type === 'repulsion_field') {
            if (Date.now() > effect.endTime) { state.effects.splice(i, 1); continue; }
            effect.x = state.player.x; effect.y = state.player.y;
            const isOverloaded = effect.isOverloaded && Date.now() < effect.startTime + 2000;
            if (isOverloaded) { const pulseAlpha = 0.8 * (1 - (Date.now() - effect.startTime) / 2000); ctx.strokeStyle = `rgba(0, 255, 255, ${pulseAlpha})`; ctx.lineWidth = 6;
            } else { const alpha = (effect.endTime - Date.now()) / 5000 * 0.4; ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineWidth = 4; }
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2*Math.PI); ctx.stroke();
        }
        else if (effect.type === 'glitch_zone') {
            if (Date.now() > effect.endTime) { state.player.controlsInverted = false; state.effects.splice(i, 1); continue; }
            const alpha = (effect.endTime - Date.now()) / 5000 * 0.3; ctx.fillStyle = `rgba(253, 121, 168, ${alpha})`; utils.drawCircle(ctx, effect.x, effect.y, effect.r, ctx.fillStyle);
            if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r + state.player.r) { if (!state.player.controlsInverted) { play('systemErrorSound'); addStatusEffect('Controls Inverted', '🔀', 3000); } state.player.controlsInverted = true; setTimeout(() => state.player.controlsInverted = false, 3000); }
        }
        else if (effect.type === 'dilation_field') {
            if (now > effect.endTime) { stopLoopingSfx('dilationField'); state.effects.splice(i, 1); continue; }
            playLooping('dilationField');
            const pulse = 0.2 + Math.sin(now/500) * 0.1;
            ctx.fillStyle = `rgba(0, 204, 255, ${pulse})`;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI);
            ctx.fill();
        }
        else if (effect.type === 'annihilator_beam') {
            if (Date.now() > effect.endTime) { state.effects.splice(i, 1); continue; }
            const { source, pillar } = effect; if(!source || !pillar || source.hp <= 0) { state.effects.splice(i, 1); continue; }
            
            const alpha = (effect.endTime - Date.now()) / 1200; 
            
            ctx.save();
            ctx.fillStyle = `rgba(214, 48, 49, ${alpha * 0.7})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const distToPillar = Math.hypot(pillar.x - source.x, pillar.y - source.y);
            if (distToPillar > pillar.r) {
                const angleToPillar = Math.atan2(pillar.y - source.y, pillar.x - source.x);
                const angleToTangent = Math.asin(pillar.r / distToPillar);
                const angle1 = angleToPillar - angleToTangent;
                const angle2 = angleToPillar + angleToTangent;
        
                const distToTangentPoint = Math.sqrt(distToPillar**2 - pillar.r**2);
                const t1x = source.x + distToTangentPoint * Math.cos(angle1);
                const t1y = source.y + distToTangentPoint * Math.sin(angle1);
                const t2x = source.x + distToTangentPoint * Math.cos(angle2);
                const t2y = source.y + distToTangentPoint * Math.sin(angle2);

                const maxDist = Math.hypot(canvas.width, canvas.height) * 2;
                const p1x = t1x + maxDist * Math.cos(angle1);
                const p1y = t1y + maxDist * Math.sin(angle1);
                const p2x = t2x + maxDist * Math.cos(angle2);
                const p2y = t2y + maxDist * Math.sin(angle2);
                
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(pillar.x, pillar.y, pillar.r, 0, 2 * Math.PI);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(t1x, t1y);
                ctx.lineTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
                ctx.lineTo(t2x, t2y);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();

            const allTargets = [state.player, ...state.enemies.filter(t => t !== source)];
            allTargets.forEach(target => {
                const distToPillarCheck = Math.hypot(pillar.x - source.x, pillar.y - source.y);
                if (distToPillarCheck <= pillar.r) return;

                const angleToPillarCheck = Math.atan2(pillar.y - source.y, pillar.x - source.x);
                const angleToTangentCheck = Math.asin(pillar.r / distToPillarCheck);
                const targetAngle = Math.atan2(target.y - source.y, target.x - source.x);
                let angleDiff = (targetAngle - angleToPillarCheck + Math.PI * 3) % (Math.PI * 2) - Math.PI;

                const isSafe = Math.abs(angleDiff) < angleToTangentCheck && Math.hypot(target.x - source.x, target.y - source.y) > distToPillarCheck;
                
                if (!isSafe && (target.health > 0 || target.hp > 0)) {
                    if (target === state.player) {
                        if (state.player.shield) return;
                        target.health -= 999;
                        if (target.health <= 0) state.gameOver = true;
                    } else {
                        if (target.boss) target.hp -= 500;
                        else target.hp -= 999;
                    }
                }
            });
        }
        else if (effect.type === 'player_annihilation_beam') {
             const progress = (now - effect.startTime) / (effect.endTime - effect.startTime);
             if (progress < 0.75) {
                const pulse = Math.abs(Math.sin(progress * Math.PI * 4));
                ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.1})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                state.enemies.filter(e => e.boss).forEach(e => {
                    utils.drawShadowCone(ctx, state.player.x, state.player.y, e, 'rgba(0,0,0,0.1)');
                });
             } else {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                state.enemies.filter(e => e.boss).forEach(e => {
                    utils.drawShadowCone(ctx, state.player.x, state.player.y, e, 'white');
                });
                ctx.restore();
                state.enemies.forEach(enemy => {
                    if (enemy.isFriendly) return;
                    let isSafe = false;
                    for (const boss of state.enemies.filter(e => e.boss)) {
                        if (utils.isPointInShadow(boss, enemy, state.player.x, state.player.y)) {
                            isSafe = true;
                            break;
                        }
                    }
                    if (!isSafe) {
                        if (enemy.boss) enemy.hp -= 500;
                        else enemy.hp = 0;
                    }
                });
             }
        }
        else if (effect.type === 'paradox_player_echo') {
             const progress = (now - effect.startTime) / 1000;
             if (progress >= 1) {
                 if (!state.gameOver) {
                     const copiedPower = powers[effect.powerKey];
                     if (copiedPower) {
                         const echoOrigin = { x: effect.x, y: effect.y };
                         usePower(effect.powerKey, true, { mx: effect.mx, my: effect.my, damageModifier: 0.5, origin: echoOrigin });
                         play('mirrorSwap');
                     }
                 }
                 state.effects.splice(i, 1);
                 continue;
             }
             ctx.globalAlpha = 1.0 - progress;
             utils.drawPlayer(ctx, { ...state.player, x: effect.x, y: effect.y }, '#81ecec');
             ctx.globalAlpha = 1.0;
        }
        else if (effect.type === 'transient_lightning') {
            utils.drawLightning(ctx, effect.x1, effect.y1, effect.x2, effect.y2, effect.color, 5);
        }
        else if (effect.type === 'miasma_gas') {
            if(playerHasCore('miasma')) { /* Immune */ }
            else {
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = '#6ab04c';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1.0;
                if (!state.player.shield) {
                    state.player.health -= 0.25; 
                    if (state.player.health <= 0) state.gameOver = true;
                }
            }
        }
        else if (effect.type === 'juggernaut_player_charge') {
            const progress = (now - effect.startTime) / effect.duration;
            if (progress >= 1) { state.effects.splice(i, 1); continue; }
            const chargeSpeed = 25;
            state.player.x += Math.cos(effect.angle) * chargeSpeed;
            state.player.y += Math.sin(effect.angle) * chargeSpeed;
            state.enemies.forEach(e => {
                if (!e.isFriendly && !effect.hitEnemies.has(e) && Math.hypot(state.player.x - e.x, state.player.y - e.y) < state.player.r + e.r) {
                    if (e.boss) {
                        e.hp -= 200;
                        const knockbackStrength = 25;
                        e.knockbackDx = Math.cos(effect.angle) * knockbackStrength;
                        e.knockbackDy = Math.sin(effect.angle) * knockbackStrength;
                        e.knockbackUntil = now + 500;
                    } else {
                        e.hp = 0;
                    }
                    effect.hitEnemies.add(e);
                    utils.triggerScreenShake(150, 8);
                    play('chargeDashSound');
                }
            });
        }
        else if (effect.type === 'teleport_indicator') {
            if (now > effect.endTime) { state.effects.splice(i, 1); continue; }
            const progress = 1 - ((effect.endTime - now) / 1000);
            ctx.strokeStyle = `rgba(255, 0, 0, ${1 - progress})`;
            ctx.lineWidth = 5 + (10 * progress);
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, Math.max(0, effect.r * (1.5 - progress)), 0, 2 * Math.PI);
            ctx.stroke();
        }
        else if (effect.type === 'slow_zone') {
            if (Date.now() > effect.endTime) { state.effects.splice(i, 1); continue; }
            const alpha = (effect.endTime - Date.now()) / 6000 * 0.4;
            for(let j=0; j<3; j++) {
                ctx.strokeStyle = `rgba(223, 230, 233, ${alpha * (0.5 + Math.sin(now/200 + j*2)*0.5)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.r * (0.6 + j*0.2), 0, Math.PI*2);
                ctx.stroke();
            }
        }
        else if (effect.type === 'paradox_echo') {
            const elapsed = Date.now() - effect.startTime;
            const progress = elapsed / 5000;
            if (progress >= 1) {
                stopLoopingSfx('paradoxTrailHum');
                effect.endTime = Date.now();
                continue;
            }
            const currentIndex = Math.floor(effect.history.length * progress);
            const currentPos = effect.history[currentIndex];
            if (currentPos) {
                 utils.drawCircle(ctx, currentPos.x, currentPos.y, effect.playerR, 'rgba(129, 236, 236, 0.4)');
                 if (Math.random() < 0.7) {
                     effect.trail.push({x: currentPos.x, y: currentPos.y, lifeEnd: Date.now() + 3000});
                 }
            }
            effect.trail.forEach((p, j) => {
                if (Date.now() > p.lifeEnd) { effect.trail.splice(j, 1); return; }
                const lifeProgress = (p.lifeEnd - Date.now()) / 3000;
                ctx.fillStyle = `rgba(231, 76, 60, ${0.4 * lifeProgress})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI); ctx.fill();
                if(Math.random() < 0.2) spawnParticlesCallback(p.x, p.y, 'rgba(231, 76, 60, 0.7)', 1, 1, 15, Math.random() * 3 + 1);
                if (Math.hypot(state.player.x - p.x, state.player.y - p.y) < state.player.r + 10) {
                     if (!state.player.shield) {
                         play('magicDispelSound');
                         state.player.health = 0;
                         if(state.player.health <= 0) state.gameOver = true;
                     }
                }
            });
        }
        else if (effect.type === 'syphon_cone') {
            const progress = (now - effect.startTime) / effect.duration;
            if (progress >= 1) { state.effects.splice(i, 1); continue; }
            const coneLength = 500;
            const coneWidth = 150;
            ctx.save();
            ctx.translate(effect.source.x, effect.source.y);
            ctx.rotate(effect.angle);
            ctx.fillStyle = `rgba(155, 89, 182, ${0.5 * (1 - progress)})`;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(coneLength, -coneWidth / 2);
            ctx.lineTo(coneLength, coneWidth / 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            state.pickups.forEach(p => {
                const distToLine = Math.abs(
                    (Math.cos(effect.angle) * (effect.source.y - p.y)) -
                    (Math.sin(effect.angle) * (effect.source.x - p.x))
                );
                const projectedDist = (p.x - effect.source.x) * Math.cos(effect.angle) + (p.y - effect.source.y) * Math.sin(effect.angle);
                if (projectedDist > 0 && projectedDist < coneLength && distToLine < coneWidth / 2) {
                    const pullStrength = 3;
                    const angleToPlayer = Math.atan2(state.player.y - p.y, state.player.x - p.x);
                    p.vx += Math.cos(angleToPlayer) * pullStrength;
                    p.vy += Math.sin(angleToPlayer) * pullStrength;
                }
            });
        }
        else if (effect.type === 'shrinking_box') {
            playLooping('wallShrink');
            const progress = (Date.now() - effect.startTime) / effect.duration;
            const currentSize = effect.initialSize * (1 - progress);
            if(currentSize <= 0) {
                stopLoopingSfx('wallShrink');
                effect.endTime = Date.now();
                continue;
            }
            const halfSize = currentSize / 2;
            const left = effect.x - halfSize; const right = effect.x + halfSize;
            const top = effect.y - halfSize; const bottom = effect.y + halfSize;
            const gapSize = 80; const wallThickness = 5;
            ctx.fillStyle = 'rgba(211, 84, 0, 0.5)';
            const gapStart = effect.gapPosition * (currentSize - gapSize);
            const playerIsInsideBounds = state.player.x >= left && state.player.x <= right && state.player.y >= top && state.player.y <= bottom;
            if (playerIsInsideBounds) {
                if (state.player.y - state.player.r < top && (effect.gapSide !== 0 || state.player.x < left + gapStart || state.player.x > left + gapStart + gapSize)) state.player.y = top + state.player.r;
                if (state.player.y + state.player.r > bottom && (effect.gapSide !== 2 || state.player.x < left + gapStart || state.player.x > left + gapStart + gapSize)) state.player.y = bottom - state.player.r;
                if (state.player.x - state.player.r < left && (effect.gapSide !== 3 || state.player.y < top + gapStart || state.player.y > top + gapStart + gapSize)) state.player.x = left + state.player.r;
                if (state.player.x + state.player.r > right && (effect.gapSide !== 1 || state.player.y < top + gapStart || state.player.y > top + gapStart + gapSize)) state.player.x = right - state.player.r;
            }
            if (effect.gapSide === 0) {
                ctx.fillRect(left, top, gapStart, wallThickness);
                ctx.fillRect(left + gapStart + gapSize, top, currentSize - gapStart - gapSize, wallThickness);
            } else { ctx.fillRect(left, top, currentSize, wallThickness); }
            if (effect.gapSide === 1) {
                ctx.fillRect(right - wallThickness, top, wallThickness, gapStart);
                ctx.fillRect(right - wallThickness, top + gapStart + gapSize, wallThickness, currentSize - gapStart - gapSize);
            } else { ctx.fillRect(right - wallThickness, top, wallThickness, currentSize); }
            if (effect.gapSide === 2) {
                ctx.fillRect(left, bottom - wallThickness, gapStart, wallThickness);
                ctx.fillRect(left + gapStart + gapSize, bottom - wallThickness, currentSize - gapStart - gapSize, wallThickness);
            } else { ctx.fillRect(left, bottom - wallThickness, currentSize, wallThickness); }
            if (effect.gapSide === 3) {
                ctx.fillRect(left, top, wallThickness, gapStart);
                ctx.fillRect(left, top + gapStart + gapSize, wallThickness, currentSize - gapStart - gapSize);
            } else { ctx.fillRect(left, top, wallThickness, currentSize); }
        }
        else if (effect.type === 'shaper_rune') {
            const runeSymbols = { nova: '💫', shockwave: '💥', lasers: '☄️', heal: '❤️', speed_buff: '🚀' };
            ctx.font = `${effect.r * 0.8}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, 2*Math.PI); ctx.fill();
            ctx.fillStyle = 'rgba(241, 196, 15, 0.9)';
            ctx.fillText(runeSymbols[effect.runeType] || '?', effect.x, effect.y);
            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
        else if (effect.type === 'shaper_zone') {
            const colors = { reckoning: 'rgba(231, 76, 60, 0.3)', alacrity: 'rgba(52, 152, 219, 0.3)', ruin: 'rgba(142, 68, 173, 0.3)' };
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, colors[effect.zoneType]);
            const dist = Math.hypot(state.player.x - effect.x, state.player.y - effect.y);
            if (dist < effect.r) {
                if (effect.playerInsideTime === null) effect.playerInsideTime = Date.now();
                const timeInside = Date.now() - effect.playerInsideTime;
                const attuneProgress = timeInside / effect.attuneTime;
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * attuneProgress)); ctx.stroke();
                if (attuneProgress >= 1) {
                    play('shaperAttune');
                    switch(effect.zoneType) {
                        case 'reckoning': addStatusEffect('Reckoning', '⚔️', 8000); state.player.berserkUntil = Date.now() + 8000; break;
                        case 'alacrity': addStatusEffect('Alacrity', '🚀', 8000); state.player.speed *= 1.5; setTimeout(() => state.player.speed /= 1.5, 8000); break;
                        case 'ruin': if(effect.boss && effect.boss.hp > 0) effect.boss.hp -= effect.boss.maxHP * 0.15; state.player.health -= 30; if (state.player.health <= 0) state.gameOver = true; break;
                    }
                    state.effects = state.effects.filter(e => e.type !== 'shaper_zone');
                    effect.boss.zonesActive = false;
                }
            } else {
                effect.playerInsideTime = null;
            }
        }
        else if (effect.type === 'aspect_summon_ring') {
            const elapsed = Date.now() - effect.startTime;
            const progress = elapsed / effect.duration;
            if (progress >= 1) { state.effects.splice(i, 1); continue; }
            const currentRadius = effect.maxRadius * progress;
            const alpha = 1 - progress;
            ctx.strokeStyle = effect.color; ctx.globalAlpha = alpha;
            ctx.lineWidth = 10 * (1 - progress);
            ctx.beginPath(); ctx.arc(effect.source.x, effect.source.y, currentRadius, 0, 2 * Math.PI); ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        else if (effect.type === 'charge_indicator') {
            const progress = (Date.now() - effect.startTime) / effect.duration;
            ctx.fillStyle = effect.color || 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(effect.source.x, effect.source.y, Math.max(0, effect.radius * progress), 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

// modules/gameLoop.js
import { state, savePlayerState } from './state.js';
import { THEMATIC_UNLOCKS, SPAWN_WEIGHTS, STAGE_CONFIG } from './config.js';
import { powers, offensivePowers } from './powers.js';
import { bossData } from './bosses.js';
import { updateUI, showBossBanner, showUnlockNotification } from './ui.js';
import * as utils from './utils.js';
import { AudioManager } from './audio.js';
import * as Cores from './cores.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Audio Helpers ---
function play(soundId) {
    AudioManager.playSfx(soundId);
}

function playLooping(soundId) {
    AudioManager.playLoopingSfx(soundId);
}

function stopLoopingSfx(soundId) {
    AudioManager.stopLoopingSfx(soundId);
}

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
    addStatusEffect,
    spawnEnemy,
    spawnPickup,
    play,
    stopLoopingSfx,
    playLooping,
    addEssence,
    useSyphonCore: (mx, my) => Cores.handleCoreOnEmptySlot(mx, my, gameHelpers),
    useLoopingEyeCore: (mx, my) => Cores.handleCoreOnDefensivePower(mx, my, gameHelpers)
};


export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();

    if (name === 'Stunned' || name === 'Petrified' || name === 'Slowed' || name === 'Epoch-Slow') {
        const isBerserk = state.player.berserkUntil > now;
        const hasTalent = state.player.purchasedTalents.has('unstoppable-frenzy');
        if (isBerserk && hasTalent) {
            return;
        }
    }

    if (name === 'Conduit Charge') {
        const existing = state.player.statusEffects.find(e => e.name === name);
        if(existing) {
            existing.count = Math.min(3, (existing.count || 1) + 1);
            existing.emoji = '⚡'.repeat(existing.count);
            existing.endTime = now + duration;
            return;
        } else {
            const effect = { name, emoji, startTime: now, endTime: now + duration, count: 1 };
            state.player.statusEffects.push(effect);
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
    state.player.essenceToNextLevel = Math.floor(state.player.essenceToNextLevel * 1.18);
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
        case 0: x = Math.random() * canvas.width; y = edgeMargin; break;
        case 1: x = Math.random() * canvas.width; y = canvas.height - edgeMargin; break;
        case 2: x = edgeMargin; y = Math.random() * canvas.height; break;
        case 3: x = canvas.width - edgeMargin; y = canvas.height - edgeMargin; break;
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
        if (state.player.equippedAberrationCore === 'centurion') {
            const corners = [
                {x: 100, y: 100}, {x: canvas.width - 100, y: 100},
                {x: 100, y: canvas.height - 100}, {x: canvas.width - 100, y: canvas.height - 100}
            ];
            corners.forEach(pos => {
                state.effects.push({ type: 'containment_pylon', x: pos.x, y: pos.y, r: 25, endTime: Infinity });
            });
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
    if (state.player.talent_states.core_states.shaper_of_fate?.isDisabled) return;
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

    const timeEater = state.enemies.find(e => e.id === 'time_eater');

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
                if (state.player.equippedAberrationCore === 'shaper_of_fate') {
                    const positions = [{x: -50, y: 0}, {x: 50, y: 0}, {x: 0, y: -50}];
                    ['damage', 'defense', 'utility'].forEach((type, i) => {
                        state.effects.push({type: 'shaper_rune_pickup', runeType: type, x: state.player.x + positions[i].x, y: state.player.y + positions[i].y, r: 20});
                    });
                    state.player.talent_states.core_states.shaper_of_fate.isDisabled = true;
                }
            }
        }
        
        if (state.bossActive) {
            if (Math.random() < (0.007 + state.player.level * 0.001)) {
                spawnEnemy(false);
            }
    
            const baseSpawnChance = 0.02 + state.player.level * 0.0002;
            const finalSpawnChance = baseSpawnChance * state.player.talent_modifiers.power_spawn_rate_modifier;
            if (Math.random() < finalSpawnChance) {
                spawnPickup();
            }
        }
    }
    
    if (state.gameOver) {
        stopAllLoopingSounds();
        const gameOverMenu = document.getElementById('gameOverMenu');
        const aberrationBtn = document.getElementById('aberrationCoreMenuBtn');
        
        aberrationBtn.style.display = state.player.level >= 10 ? 'block' : 'none';

        if (gameOverMenu.style.display !== 'flex') {
            gameOverMenu.style.display = 'flex';
        }
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
    
    if (state.player.equippedAberrationCore === 'aethel_and_umbra') {
        if (state.player.health > state.player.maxHealth * 0.5) playerSpeedMultiplier *= 1.10;
    }
    
    state.effects.forEach(effect => { 
        if(effect.type === 'slow_zone' && Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r && !isBerserkImmune) {
            playerSpeedMultiplier *= 0.5;
        }
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

    if (state.player.equippedAberrationCore === 'juggernaut') {
        const moveDist = Math.hypot( (finalMx - state.player.x), (finalMy - state.player.y));
        if (moveDist > state.player.r) {
            if (!state.player.talent_states.core_states.juggernaut.lastMoveTime) {
                state.player.talent_states.core_states.juggernaut.lastMoveTime = now;
            }
            if(now - state.player.talent_states.core_states.juggernaut.lastMoveTime > 3000) {
                state.player.talent_states.core_states.juggernaut.isCharging = true;
            }
        } else {
            state.player.talent_states.core_states.juggernaut.lastMoveTime = 0;
        }
    }

    if (now > state.player.stunnedUntil) {
        state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
        state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
    }

    if (state.player.equippedAberrationCore === 'epoch_ender' && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
        const history = state.player.talent_states.core_states.epoch_ender.history;
        history.push({ x: state.player.x, y: state.player.y, health: state.player.health });
        if(history.length > 120) history.shift();
    }

    Cores.applyCoreTickEffects(gameHelpers);

    if (state.decoy && state.decoy.isMobile) {
        const decoySpeed = 2;
        const angle = Math.atan2(state.decoy.y - state.player.y, state.decoy.x - state.player.x);
        state.decoy.x += Math.cos(angle) * decoySpeed;
        state.decoy.y += Math.sin(angle) * decoySpeed;
        state.decoy.x = Math.max(state.decoy.r, Math.min(canvas.width - state.decoy.r, state.decoy.x));
        state.decoy.y = Math.max(state.decoy.r, Math.min(canvas.height - state.decoy.r, state.decoy.y));
    }

    if (state.gravityActive && now > state.gravityEnd) {
        state.gravityActive = false;
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
        ctx.arc(state.player.x, state.player.y, state.player.r + 8, 0, 2 * Math.PI);
        ctx.stroke();
    }
    utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r, state.player.shield ? "#f1c40f" : ((state.player.berserkUntil > now) ? '#e74c3c' : (state.player.infected ? '#55efc4' : "#3498db")));
    
    if (state.decoy) {
        utils.drawCircle(ctx, state.decoy.x, state.decoy.y, state.decoy.r, "#9b59b6");
        if (now > state.decoy.expires) state.decoy = null;
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
                addEssence(10);
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

        if (e.isInfected && !e.boss) {
            if (now > e.infectionEnd) {
                e.isInfected = false;
            } else if (now - (e.lastSpore || 0) > 3000) {
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
        
        if (timeEater && !e.boss && !e.eatenBy) {
            for (const zone of timeEater.effects.filter(eff => eff.type === 'slow_zone')) {
                if (Math.hypot(e.x - zone.x, e.y - zone.y) < zone.r) {
                    e.eatenBy = zone; break;
                }
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
            let tgt = e.isFriendly ? null : (state.decoy ? state.decoy : state.player);
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
            state.effects.forEach(effect => { 
                if(effect.type === 'slow_zone' && Math.hypot(e.x - effect.x, e.y - effect.y) < effect.r) enemySpeedMultiplier = 0.5;
                if (effect.type === 'black_hole' && e.id !== 'fractal_horror') {
                    const elapsed = now - effect.startTime, progress = Math.min(1, elapsed / effect.duration);
                    const currentPullRadius = effect.maxRadius * progress, dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                    if (dist < currentPullRadius) {
                        let pullStrength = e.boss ? 0.03 : 0.1;
                        e.x += (effect.x - e.x) * pullStrength; e.y += (effect.y - e.y) * pullStrength;
                        if (state.player.purchasedTalents.has('unstable-singularity') && dist < effect.radius + e.r && now - (effect.lastDamage.get(e) || 0) > effect.damageRate) {
                            e.hp -= (e.boss ? effect.damage : 15) - 5 * state.player.talent_modifiers.damage_multiplier;
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
        
        if (e.boss && e.logic) e.logic(e, ctx, state, utils, gameHelpers);
        
        let color = e.customColor || (e.boss ? e.color : "#c0392b"); if(e.isInfected) color = '#55efc4'; if(e.frozen) color = '#add8e6';
        if(!e.hasCustomDraw) utils.drawCircle(ctx, e.x,e.y,e.r, color);
        if(e.enraged) { ctx.strokeStyle = "yellow"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x,e.y,e.r+5,0,2*Math.PI); ctx.stroke(); }
        
        Cores.handleCoreOnCollision(e, gameHelpers);

        if(!e.isFriendly) {
            const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
            if(pDist < e.r+state.player.r){
                if (state.player.talent_states.phaseMomentum.active && !e.boss) {
                    // No collision damage
                } else {
                    state.player.talent_states.phaseMomentum.lastDamageTime = now;
                    state.player.talent_states.phaseMomentum.active = false;
                    if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); 

                    if(!state.player.shield){ 
                        let damage = e.boss ? (e.enraged ? 20 : 10) : 1; 
                        damage *= state.player.talent_modifiers.damage_taken_multiplier;
                        const wouldBeFatal = (state.player.health - damage) <= 0;

                        if (wouldBeFatal && Cores.handleCoreOnFatalDamage(e, gameHelpers)) {
                            // Death prevented by core
                        } else if(wouldBeFatal && state.player.purchasedTalents.has('contingency-protocol') && !state.player.contingencyUsed) {
                            state.player.contingencyUsed = true; state.player.health = 1;
                            addStatusEffect('Contingency Protocol', '🛡️', 3000);
                            const invulnShieldEndTime = now + 3000;
                            state.player.shield = true; state.player.shield_end_time = invulnShieldEndTime;
                            setTimeout(()=> { if(state.player.shield_end_time <= invulnShieldEndTime) state.player.shield = false; }, 3000);
                        } else {
                            state.player.health -= damage; 
                        }

                        Cores.handleCoreOnPlayerDamage(e, gameHelpers);
                        play('hitSound'); 
                        if(e.onDamage) e.onDamage(e, damage, state.player, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                        if(state.player.health<=0) state.gameOver=true; 
                    } else { 
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
        
        const slowZones = timeEater ? state.effects.filter(eff => eff.type === 'slow_zone') : [];
        if (timeEater && !p.eatenBy) {
            for (const zone of slowZones) {
                if (Math.hypot(p.x - zone.x, p.y - zone.y) < zone.r) { p.eatenBy = zone; break; }
            }
        }
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
            if (d < pickupRadius) {
                const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
                p.vx += Math.cos(angle) * 0.5; p.vy += Math.sin(angle) * 0.5;
            }
            p.vx *= 0.95; p.vy *= 0.95;
        }
        p.x += p.vx; p.y += p.vy;
        utils.drawCircle(ctx, p.x, p.y, p.r, p.emoji === '🩸' ? '#800020' : '#2ecc71');
        ctx.fillStyle="#fff"; ctx.font="16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.emoji || powers[p.type]?.emoji || '?', p.x, p.y+6);
        ctx.textAlign = "left";
        if(Math.hypot(state.player.x - p.x, state.player.y - p.y) < state.player.r + p.r){
            play('pickupSound'); 
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
                    const power = powers[p.type];
                    if (power && power.apply) {
                        addStatusEffect('Auto-Used', p.emoji || powers[p.type]?.emoji || '?', 2000);
                        power.apply(utils, gameHelpers, mx, my);
                        state.pickups.splice(i, 1);
                    }
                } else {
                    utils.spawnParticles(state.particles, p.x, p.y, "#f00", 15, 2, 20); 
                    state.pickups.splice(i,1);
                }
            }
        }
    }

    for (let i = state.effects.length - 1; i >= 0; i--) {
        const effect = state.effects[i];
        
        if (effect.type === 'black_hole') {
             if (now > effect.endTime) { 
                if (state.player.purchasedTalents.has('unstable-singularity')) { 
                    state.effects.push({ type: 'shockwave', caster: state.player, x: effect.x, y: effect.y, radius: 0, maxRadius: effect.maxRadius, speed: 800, startTime: now, hitEnemies: new Set(), damage: 25 * state.player.talent_modifiers.damage_multiplier }); 
                } 
                if (state.player.equippedAberrationCore === 'time_eater') {
                    state.effects.push({ type: 'dilation_field', x: effect.x, y: effect.y, r: effect.maxRadius, endTime: now + 30000 });
                }
                state.effects.splice(i, 1); 
                continue; 
            } 
        } else if (now > (effect.endTime || Infinity)) {
            if (effect.type === 'paradox_echo') stopLoopingSfx('paradoxTrailHum');
            if (effect.type === 'shrinking_box') stopLoopingSfx('wallShrink');
            state.effects.splice(i, 1);
            continue;
        }

        if (effect.type === 'nova_bullet' || effect.type === 'ricochet_projectile' || effect.type === 'seeking_shrapnel' || effect.type === 'helix_bolt') {
            let speedMultiplier = 1.0;
            state.effects.forEach(eff => {
                if (eff.type === 'dilation_field' || eff.type === 'slow_zone') {
                    if (eff.shape === 'horseshoe') {
                        if (Math.hypot(effect.x - eff.x, effect.y - eff.y) < eff.r) {
                             let projAngle = Math.atan2(effect.y - eff.y, effect.x - eff.x);
                             let diff = Math.atan2(Math.sin(projAngle - eff.angle), Math.cos(projAngle - eff.angle));
                             if (Math.abs(diff) > (Math.PI / 4)) speedMultiplier = 0.2;
                        }
                    } else if (Math.hypot(effect.x - eff.x, effect.y - eff.y) < eff.r) {
                        speedMultiplier = 0.2;
                    }
                }
            });
            effect.x += effect.dx * speedMultiplier;
            effect.y += effect.dy * speedMultiplier;
        }


        if (effect.type === 'shockwave') {
            const elapsed = (now - effect.startTime) / 1000; effect.radius = elapsed * effect.speed;
            ctx.strokeStyle = effect.color || `rgba(255, 255, 255, ${1-(effect.radius/effect.maxRadius)})`; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI); ctx.stroke();
            let targets = (effect.caster === state.player) ? state.enemies.filter(e => !e.isFriendly) : [state.player];
            targets.forEach(target => {
                if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) {
                    if (effect.damage > 0) {
                        let dmg = (target.isPuppet && effect.caster === state.player) ? target.maxHP / 2 : (target.boss || target === state.player) ? effect.damage : 1000;
                        if (target === state.player) {
                            if (!target.shield) {
                                target.health -= dmg;
                                if (target.health <= 0) state.gameOver = true;
                            } else target.shield = false;
                        } else {
                            target.hp -= dmg;
                            if (state.player.equippedAberrationCore === 'basilisk') addStatusEffect.call(target, 'Petrified', '🗿', 3000);
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
                    to.hp -= dmg; 
                    if (to.onDamage) to.onDamage(to, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    effect.links.push(to);
                    if (state.player.purchasedTalents.has('volatile-finish') && j === effect.targets.length - 1) {
                         state.effects.push({ type: 'shockwave', caster: state.player, x: to.x, y: to.y, radius: 0, maxRadius: 150, speed: 600, startTime: now, hitEnemies: new Set(), damage: 15 * state.player.talent_modifiers.damage_multiplier });
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
            state.enemies.forEach(e => { if (!effect.hitEnemies.has(e) && Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { let damage = (state.player.berserkUntil > now) ? effect.damage * 2 : effect.damage; e.hp -= damage; effect.bounces--; const angle = Math.atan2(e.y - effect.y, e.x - effect.x); effect.dx = -Math.cos(angle) * 10; effect.dy = -Math.sin(angle) * 10; effect.hitEnemies.add(e); setTimeout(()=>effect.hitEnemies.delete(e), 200); } }); 
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
            if (effect.caster === state.player) {
                state.enemies.forEach(e => { if (e !== effect.caster && !e.isFriendly && Math.hypot(e.x-effect.x, e.y-effect.y) < e.r + effect.r) { let damage = ((state.player.berserkUntil > now) ? 6 : 3) * state.player.talent_modifiers.damage_multiplier; e.hp -= damage; state.effects.splice(i, 1); } }); 
            } else {
                if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < state.player.r + effect.r) {
                    if (!state.player.shield) {
                        state.player.health -= (effect.damage || 40);
                        if(state.player.health <= 0) state.gameOver = true;
                    } else state.player.shield = false;
                    state.effects.splice(i, 1);
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
                        if(effect.caster !== state.player) damage = effect.damage;
                        if(e.health) {
                            if (!e.shield) { e.health -= damage; if(e.health <= 0) state.gameOver = true; }
                            else { e.shield = false; }
                        } else { e.hp -= damage; }
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
            ctx.moveTo(effect.x-10, effect.y);
            ctx.lineTo(effect.x+10, effect.y);
            ctx.moveTo(effect.x, effect.y-10);
            ctx.lineTo(effect.x, effect.y+10);
            ctx.stroke();
        }
        else if (effect.type === 'black_hole') { 
            const elapsed = now - effect.startTime, progress = Math.min(1, elapsed / effect.duration);
            const currentPullRadius = effect.maxRadius * progress; 
            utils.drawCircle(ctx, effect.x, effect.y, effect.radius, effect.color || "#000"); 
            ctx.strokeStyle = effect.color ? `rgba(${effect.color.slice(1).match(/.{1,2}/g).map(v => parseInt(v, 16)).join(',')}, ${0.6 * progress})` : `rgba(155, 89, 182, ${0.6 * progress})`;
            ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, currentPullRadius, 0, 2*Math.PI); ctx.stroke();
        }
        else if (effect.type === 'seeking_shrapnel') {
            let closest = null; const sortedEnemies = [...state.enemies].sort((a,b) => Math.hypot(a.x-effect.x, a.y-effect.y) - Math.hypot(b.x-effect.x, b.y-effect.y));
            if(sortedEnemies[effect.targetIndex]) closest = sortedEnemies[effect.targetIndex]; else if (sortedEnemies.length > 0) closest = sortedEnemies[0];
            if(closest){ const angle = Math.atan2(closest.y - effect.y, closest.x - effect.x); const turnSpeed = 0.1; effect.dx = effect.dx * (1-turnSpeed) + (Math.cos(angle) * effect.speed) * turnSpeed; effect.dy = effect.dy * (1-turnSpeed) + (Math.sin(angle) * effect.speed) * turnSpeed; }
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#ff9944');
            state.enemies.forEach(e => { if(Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { e.hp -= effect.damage; state.effects.splice(i, 1); }});
            if(now > effect.startTime + effect.life) state.effects.splice(i, 1);
        }
        else if (effect.type === 'teleport_indicator') {
            if (now > effect.endTime) { state.effects.splice(i, 1); continue; }
            const progress = 1 - ((effect.endTime - now) / 1000);
            const warningRadius = effect.r * (1.5 - progress);
            ctx.strokeStyle = `rgba(255, 0, 0, ${1 - progress})`;
            ctx.lineWidth = 5 + (10 * progress);
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, Math.max(0, warningRadius), 0, 2 * Math.PI);
            ctx.stroke();
        }
        else if (effect.type === 'glitch_zone') {
            if (now > effect.endTime) { state.player.controlsInverted = false; state.effects.splice(i, 1); continue; }
            const alpha = (effect.endTime - now) / 5000 * 0.3; ctx.fillStyle = `rgba(253, 121, 168, ${alpha})`; utils.drawCircle(ctx, effect.x, effect.y, effect.r, ctx.fillStyle);
            if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r + state.player.r) { if (!state.player.controlsInverted) { play('systemErrorSound'); addStatusEffect('Controls Inverted', '🔀', 3000); } state.player.controlsInverted = true; setTimeout(() => state.player.controlsInverted = false, 3000); }
        }
        else if (effect.type === 'shrinking_box') {
            playLooping('wallShrink');
            const progress = (now - effect.startTime) / effect.duration;
            const currentSize = effect.initialSize * (1 - progress);
            const halfSize = currentSize / 2;
            const left = effect.x - halfSize, right = effect.x + halfSize, top = effect.y - halfSize, bottom = effect.y + halfSize;
            ctx.strokeStyle = 'rgba(211, 84, 0, 0.8)'; ctx.lineWidth = 10; ctx.shadowColor = '#d35400'; ctx.shadowBlur = 20;
            const gapSize = 150 * (1 - progress);
            const walls = [{x1:left,y1:top,x2:right,y2:top},{x1:right,y1:top,x2:right,y2:bottom},{x1:right,y1:bottom,x2:left,y2:bottom},{x1:left,y1:bottom,x2:left,y2:top}];
            walls.forEach((wall, index) => {
                const wallLength = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                let hit = false;
                if (index === effect.gapSide) {
                    const gapStart = (wallLength - gapSize) * effect.gapPosition, gapEnd = gapStart + gapSize;
                    const p1 = {x:wall.x1+(wall.x2-wall.x1)*(gapStart/wallLength),y:wall.y1+(wall.y2-wall.y1)*(gapStart/wallLength)};
                    const p2 = {x:wall.x1+(wall.x2-wall.x1)*(gapEnd/wallLength),y:wall.y1+(wall.y2-wall.y1)*(gapEnd/wallLength)};
                    ctx.beginPath(); ctx.moveTo(wall.x1,wall.y1); ctx.lineTo(p1.x, p1.y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(p2.x,p2.y); ctx.lineTo(wall.x2, wall.y2); ctx.stroke();
                    if(utils.lineCircleCollision(wall.x1,wall.y1,p1.x,p1.y,state.player.x,state.player.y,state.player.r) || utils.lineCircleCollision(p2.x,p2.y,wall.x2,wall.y2,state.player.x,state.player.y,state.player.r)) hit=true;
                } else {
                    ctx.beginPath(); ctx.moveTo(wall.x1,wall.y1); ctx.lineTo(wall.x2, wall.y2); ctx.stroke();
                    if(utils.lineCircleCollision(wall.x1,wall.y1,wall.x2,wall.y2,state.player.x,state.player.y,state.player.r)) hit=true;
                }
                if(hit && !state.player.shield) { state.player.health-=1; if(state.player.health<=0)state.gameOver=true;} else if (hit) { state.player.shield=false; }
            });
            ctx.shadowBlur = 0;
        }
        else if (effect.type === 'paradox_echo') {
            if (!effect.trail[0] || now - effect.trail[0].time > 1000) {
                if (effect.history.length > 0) {
                    effect.trail.unshift(effect.history.shift());
                } else if (effect.trail.length === 0) {
                    stopLoopingSfx('paradoxTrailHum');
                    state.effects.splice(i, 1);
                    continue;
                }
            }
            effect.trail.forEach((p, index) => {
                const alpha = 1 - (index / effect.trail.length);
                utils.drawCircle(ctx, p.x, p.y, effect.playerR, `rgba(129, 236, 236, ${alpha * 0.5})`);
                if (Math.hypot(state.player.x - p.x, state.player.y - p.y) < state.player.r + effect.playerR && !state.player.shield) {
                    state.player.health -= 0.5; if (state.player.health <= 0) state.gameOver = true;
                }
            });
            effect.trail = effect.trail.slice(0, 50);
        }
        else if (effect.type === 'syphon_cone') {
            const coneWidth = Math.PI / 4;
            ctx.fillStyle = `rgba(155, 89, 182, 0.3)`;
            ctx.beginPath();
            ctx.moveTo(effect.source.x, effect.source.y);
            ctx.arc(effect.source.x, effect.source.y, 800, effect.angle - coneWidth/2, effect.angle + coneWidth/2);
            ctx.closePath();
            ctx.fill();
        }
        else if(effect.type === 'dilation_field') {
            playLooping('dilationField');
            ctx.save();
            ctx.translate(effect.x, effect.y);
            ctx.rotate(effect.angle);
            ctx.fillStyle = 'rgba(189, 195, 199, 0.2)';
            ctx.beginPath();
            ctx.arc(0, 0, effect.r, -Math.PI/2, Math.PI/2, false);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}
I am so sorry I grabbed the wrong file the last time, please check this one against my current file system.

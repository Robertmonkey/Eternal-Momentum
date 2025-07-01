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
    
    if (name === 'Stunned' || name === 'Petrified' || name === 'Slowed' || name === 'Epoch-Slow') {
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
    const stageData = STAGE_CONFIG.find(s => s.stage === stageNum);

    if (stageData && stageData.bosses) {
        stageData.bosses.forEach(bossId => {
            spawnEnemy(true, bossId, getSafeSpawnLocation());
        });
    } else if (stageNum > 30) {
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
        if (state.bossActive && Math.random() < (0.007 + state.player.level * 0.001)) {
            spawnEnemy(false);
        }
        if (Math.random() < (0.02 + state.player.level * 0.0002)) {
            spawnPickup();
        }
    }
    
    if (state.gameOver) {
        stopLoopingSfx("beamHumSound");
        stopLoopingSfx('wallShrink');
        const gameOverMenu = document.getElementById('gameOverMenu');
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
        if (Date.now() - state.player.talent_states.phaseMomentum.lastDamageTime > 8000) {
            state.player.talent_states.phaseMomentum.active = true;
        }
    } else {
        state.player.talent_states.phaseMomentum.active = false;
    }
    
    let playerSpeedMultiplier = state.player.talent_states.phaseMomentum.active ? 1.10 : 1.0;
    
    const isBerserkImmune = state.player.berserkUntil > Date.now() && state.player.purchasedTalents.has('unstoppable-frenzy');
    
    if (state.player.statusEffects.some(e => e.name === 'Slowed' || e.name === 'Epoch-Slow') && !isBerserkImmune) {
        playerSpeedMultiplier *= 0.5;
    }
    
    const timeEater = state.enemies.find(e => e.id === 'time_eater');
    
    state.effects.forEach(effect => { 
        if(effect.type === 'slow_zone' && Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r && !isBerserkImmune) {
            playerSpeedMultiplier *= 0.5;
        }
        if (effect.type === 'black_hole' && effect.caster !== state.player) {
            const dist = Math.hypot(state.player.x - effect.x, state.player.y - effect.y);
            const elapsed = Date.now() - effect.startTime;
            const progress = Math.min(1, elapsed / effect.duration);
            const currentPullRadius = effect.maxRadius * progress;
            if (dist < currentPullRadius) {
                let pullStrength = 0.08;
                state.player.x += (effect.x - state.player.x) * pullStrength;
                state.player.y += (effect.y - state.player.y) * pullStrength;
            }
        }
    });

    if (Date.now() > state.player.stunnedUntil) {
        state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
        state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
    }

    if (state.decoy && state.decoy.isMobile) {
        const decoySpeed = 2;
        const angle = Math.atan2(state.decoy.y - state.player.y, state.decoy.x - state.player.x);
        state.decoy.x += Math.cos(angle) * decoySpeed;
        state.decoy.y += Math.sin(angle) * decoySpeed;
        state.decoy.x = Math.max(state.decoy.r, Math.min(canvas.width - state.decoy.r, state.decoy.x));
        state.decoy.y = Math.max(state.decoy.r, Math.min(canvas.height - state.decoy.y, state.decoy.y));
    }

    if (state.gravityActive && Date.now() > state.gravityEnd) {
        state.gravityActive = false;
        if (state.player.purchasedTalents.has('temporal-collapse')) {
            state.effects.push({ type: 'slow_zone', x: canvas.width / 2, y: canvas.height / 2, r: 250, endTime: Date.now() + 4000 });
        }
    }

    const architect = state.enemies.find(e => e.id === 'architect');
    if(architect && architect.pillars) {
        architect.pillars.forEach(pillar => {
            const dist = Math.hypot(state.player.x - pillar.x, state.player.y - pillar.y);
            if (dist < state.player.r + pillar.r) {
                const angle = Math.atan2(state.player.y - pillar.y, state.player.x - pillar.x);
                state.player.x = pillar.x + Math.cos(angle) * (state.player.r + pillar.r);
                state.player.y = pillar.y + Math.sin(angle) * (state.player.r + pillar.r);
            }
        });
    }

    const annihilator = state.enemies.find(e => e.id === 'annihilator' && e.pillar);
    if (annihilator) {
        const pillar = annihilator.pillar;
        const dx = state.player.x - pillar.x;
        const dy = state.player.y - pillar.y;
        const dist = Math.hypot(dx, dy);
        if (dist < state.player.r + pillar.r) {
            const angle = Math.atan2(dy, dx);
            state.player.x = pillar.x + Math.cos(angle) * (state.player.r + pillar.r);
            state.player.y = pillar.y + Math.sin(angle) * (state.player.r + pillar.r);
        }
    }

    if (state.player.infected) {
        if (Date.now() > state.player.infectionEnd) {
            state.player.infected = false;
        } else if (Date.now() - state.player.lastSpore > 2000) {
            state.player.lastSpore = Date.now();
            const spore = spawnEnemy(false, null, {x: state.player.x, y: state.player.y});
            if(spore){
                spore.r = 8;
                spore.hp = 2;
                spore.dx = (Math.random() - 0.5) * 8;
                spore.dy = (Math.random() - 0.5) * 8;
                spore.ignoresPlayer = true;
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
    utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r, state.player.shield ? "#f1c40f" : ((state.player.berserkUntil > Date.now()) ? '#e74c3c' : (state.player.infected ? '#55efc4' : "#3498db")));
    
    if (state.decoy) {
        utils.drawCircle(ctx, state.decoy.x, state.decoy.y, state.decoy.r, "#9b59b6");
        if (Date.now() > state.decoy.expires) {
            state.decoy = null;
        }
    }

    let totalPlayerPushX = 0;
    let totalPlayerPushY = 0;
    let playerCollisions = 0;

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
                const scavengerRank = state.player.purchasedTalents.get('power-scavenger');
                if (scavengerRank && Math.random() < [0.01, 0.025][scavengerRank-1]) {
                    state.pickups.push({ x: e.x, y: e.y, r: 12, type: 'score', vx: 0, vy: 0, lifeEnd: Date.now() + 10000 });
                }
                const cryoRank = state.player.purchasedTalents.get('cryo-shatter');
                if (cryoRank && e.wasFrozen && Math.random() < [0.25, 0.5][cryoRank-1]) {
                    utils.spawnParticles(state.particles, e.x, e.y, '#ADD8E6', 40, 4, 30, 2);
                    state.effects.push({ type: 'shockwave', caster: state.player, x: e.x, y: e.y, radius: 0, maxRadius: 100, speed: 500, startTime: Date.now(), hitEnemies: new Set(), damage: 5 * state.player.talent_modifiers.damage_multiplier, color: 'rgba(0, 200, 255, 0.5)' });
                }
                state.enemies.splice(i, 1);
            }
            continue;
        }

        if (annihilator && annihilator.pillar) {
            const pillar = annihilator.pillar;
            const dist = Math.hypot(e.x - pillar.x, e.y - pillar.y);
            if (dist < e.r + pillar.r) {
                const angle = Math.atan2(e.y - pillar.y, e.x - pillar.x);
                e.x = pillar.x + Math.cos(angle) * (e.r + pillar.r);
                e.y = pillar.y + Math.sin(angle) * (e.r + pillar.r);
            }
        }
        
        if (e.isInfected && !e.boss) {
            if (Date.now() > e.infectionEnd) {
                e.isInfected = false;
            } else if (Date.now() - (e.lastSpore || 0) > 3000) {
                e.lastSpore = Date.now();
                const spore = spawnEnemy(false, null, { x: e.x, y: e.y });
                if (spore) {
                    spore.r = 6;
                    spore.hp = 1;
                    spore.dx = (Math.random() - 0.5) * 8;
                    spore.dy = (Math.random() - 0.5) * 8;
                    spore.ignoresPlayer = true;
                }
            }
        }

        const slowZones = timeEater ? state.effects.filter(eff => eff.type === 'slow_zone') : [];
        
        const isRepulsionTarget = !e.boss || e.id === 'fractal_horror';
        if (isRepulsionTarget && state.effects.filter(eff => eff.type === 'repulsion_field').length > 0) {
            state.effects.filter(eff => eff.type === 'repulsion_field').forEach(field => {
                const dist = Math.hypot(e.x - field.x, e.y - field.y);
                if (dist < field.radius + e.r) {
                    if (field.isOverloaded) {
                        if (!field.hitEnemies.has(e)) {
                            const knockbackVelocity = 20;
                            const angle = Math.atan2(e.y - field.y, e.x - field.x);
                            e.knockbackDx = Math.cos(angle) * knockbackVelocity;
                            e.knockbackDy = Math.sin(angle) * knockbackVelocity;
                            e.knockbackUntil = Date.now() + 2000;
                            field.hitEnemies.add(e);
                        }
                    } else {
                        const knockbackForce = 5;
                        const angle = Math.atan2(e.y - field.y, e.x - field.x);
                        e.x += Math.cos(angle) * knockbackForce;
                        e.y += Math.sin(angle) * knockbackForce;
                    }
                }
            });
        }
        
        if (timeEater && !e.boss && !e.eatenBy) {
            for (const zone of slowZones) {
                if (Math.hypot(e.x - zone.x, e.y - zone.y) < zone.r) {
                    e.eatenBy = zone;
                    break;
                }
            }
        }
        
        if (e.eatenBy) {
            const pullX = e.eatenBy.x - e.x;
            const pullY = e.eatenBy.y - e.y;
            const pullDist = Math.hypot(pullX, pullY) || 1;
            e.dx = (pullX / pullDist) * 3;
            e.dy = (pullY / pullDist) * 3;
            e.x += e.dx;
            e.y += e.dy;
            e.r *= 0.95;
            if (e.r < 2) {
                if (timeEater) timeEater.hp -= 10;
                utils.spawnParticles(state.particles, e.x, e.y, "#d63031", 10, 2, 15);
                state.enemies.splice(i, 1);
                continue;
            }
        } else if (e.knockbackUntil && e.knockbackUntil > Date.now()) {
            e.x += e.knockbackDx;
            e.y += e.knockbackDy;
            e.knockbackDx *= 0.98;
            e.knockbackDy *= 0.98;
            if (e.x < e.r || e.x > canvas.width - e.r) {
                e.x = Math.max(e.r, Math.min(canvas.width - e.r, e.x));
                e.knockbackDx *= -0.8;
            }
            if (e.y < e.r || e.y > canvas.height - e.r) {
                e.y = Math.max(e.r, Math.min(canvas.height - e.r, e.y));
                e.knockbackDy *= -0.8;
            }
        } else if(!e.frozen && !e.hasCustomMovement){ 
            let tgt = state.decoy ? state.decoy : state.player;
            let enemySpeedMultiplier = 1;
            if (state.gravityActive && Date.now() < state.gravityEnd) {
                if (!e.boss) {
                    const pullX = (canvas.width / 2) - e.x;
                    const pullY = (canvas.height / 2) - e.y;
                    e.x += pullX * 0.05;
                    e.y += pullY * 0.05;
                }
            }
            state.effects.forEach(effect => { 
                if(effect.type === 'slow_zone' && Math.hypot(e.x - effect.x, e.y - effect.y) < effect.r) enemySpeedMultiplier = 0.5;
                if (effect.type === 'black_hole') {
                    const elapsed = Date.now() - effect.startTime;
                    const progress = Math.min(1, elapsed / effect.duration);
                    const currentPullRadius = effect.maxRadius * progress;
                    const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                    if (dist < currentPullRadius) {
                        let pullStrength = e.boss ? 0.03 : 0.1;
                        if (e.id === 'fractal_horror') {
                            pullStrength = 0.1;
                        }
                        e.x += (effect.x - e.x) * pullStrength;
                        e.y += (effect.y - e.y) * pullStrength;
                        if (dist < effect.radius + e.r && Date.now() - (effect.lastDamage.get(e) || 0) > effect.damageRate) {
                             e.hp -= e.boss ? effect.damage : 15;
                             if(state.player.purchasedTalents.has('unstable-singularity')) e.hp -= 5 * state.player.talent_modifiers.damage_multiplier;
                             effect.lastDamage.set(e, Date.now());
                        }
                    }
                }
            });
            if (tgt) {
              const vx = (tgt.x - e.x) * 0.005 * enemySpeedMultiplier; 
              const vy = (tgt.y - e.y) * 0.005 * enemySpeedMultiplier; 
              e.x += vx; e.y += vy; 
            }
            e.x += e.dx * enemySpeedMultiplier; 
            e.y += e.dy * enemySpeedMultiplier;
            if(e.x<e.r || e.x>canvas.width-e.r) e.dx*=-1; 
            if(e.y<e.r || e.y>canvas.height-e.r) e.dy*=-1;
        }
        
        const bossLogicArgs = [e, ctx, state, utils, gameHelpers];
        if (e.boss && e.logic) e.logic(...bossLogicArgs);
        
        let color = e.customColor || (e.boss ? e.color : "#c0392b"); if(e.isInfected) color = '#55efc4'; if(e.frozen) color = '#add8e6';
        if(!e.hasCustomDraw) utils.drawCircle(ctx, e.x,e.y,e.r, color);
        if(e.enraged) { ctx.strokeStyle = "yellow"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x,e.y,e.r+5,0,2*Math.PI); ctx.stroke(); }
        
        if (e.id === 'obelisk_conduit' && e.hp > 0) {
            const distToPlayer = Math.hypot(state.player.x - e.x, state.player.y - e.y);
            const auraRadius = 250;
            switch(e.conduitType) {
                case 'lightning':
                    if (distToPlayer < auraRadius) {
                        if (!state.player.shield) state.player.health -= 0.5;
                        else state.player.shield = false;
                    }
                    break;
                case 'gravity':
                    if (distToPlayer < auraRadius) {
                        const pullStrength = 0.04;
                        state.player.x += (e.x - state.player.x) * pullStrength;
                        state.player.y += (e.y - state.player.y) * pullStrength;
                    }
                    break;
            }
        }
        if (e.id === 'obelisk' && e.isFiringBeam) {
            const beamThickness = 10;
            const beamLength = Math.hypot(canvas.width, canvas.height);
            const beamEndX = e.x + Math.cos(e.beamAngle) * beamLength;
            const beamEndY = e.y + Math.sin(e.beamAngle) * beamLength;
            const L2 = Math.pow(e.x - beamEndX, 2) + Math.pow(e.y - beamEndY, 2);
            let t = ((state.player.x - e.x) * (beamEndX - e.x) + (state.player.y - e.y) * (beamEndY - e.y)) / L2;
            t = Math.max(0, Math.min(1, t));
            const closestX = e.x + t * (beamEndX - e.x);
            const closestY = e.y + t * (beamEndY - e.y);
            const distToBeam = Math.hypot(state.player.x - closestX, state.player.y - closestY);

            if (distToBeam < state.player.r + beamThickness / 2) {
                if (!state.player.shield) state.player.health -= 5;
                else state.player.shield = false;
            }
        }
        
        if (e.id === 'basilisk' && e.petrifyZones) {
            e.petrifyZones.forEach(zone => {
                const zoneX = zone.x - zone.sizeW / 2;
                const zoneY = zone.y - zone.sizeH / 2;
                const onCooldown = Date.now() < (zone.cooldownUntil || 0);

                ctx.fillStyle = onCooldown ? `rgba(0, 184, 148, 0.05)` : `rgba(0, 184, 148, 0.2)`;
                ctx.fillRect(zoneX, zoneY, zone.sizeW, zone.sizeH);

                const player = state.player;
                const isPlayerInside = player.x > zoneX && player.x < zoneX + zone.sizeW && player.y > zoneY && player.y < zoneY + zone.sizeH;

                if (isPlayerInside && !onCooldown) {
                    if (!zone.playerInsideTime) zone.playerInsideTime = Date.now();
                    const stunProgress = (Date.now() - zone.playerInsideTime) / 1500;
                    ctx.fillStyle = `rgba(0, 184, 148, 0.4)`;
                    ctx.fillRect(zoneX, zoneY, zone.sizeW * stunProgress, zone.sizeH);

                    if (stunProgress >= 1) {
                        play('stoneCrackingSound');
                        addStatusEffect('Petrified', '🗿', 2000);
                        player.stunnedUntil = Date.now() + 2000;
                        zone.playerInsideTime = null; 
                        zone.cooldownUntil = Date.now() + 2000;
                    }
                } else {
                    zone.playerInsideTime = null;
                }
            });
        }
        
        const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
        if(pDist < e.r+state.player.r){
            if (state.player.talent_states.phaseMomentum.active && !e.boss) {
            } else {
                state.player.talent_states.phaseMomentum.lastDamageTime = Date.now();
                state.player.talent_states.phaseMomentum.active = false;
                if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); 
                if(!state.player.shield){ 
                    let damage = e.boss ? (e.enraged ? 20 : 10) : 1; 
                    if (state.player.berserkUntil > Date.now()) damage *= 2;
                    damage *= state.player.talent_modifiers.damage_taken_multiplier;
                    const wouldBeFatal = (state.player.health - damage) <= 0;
                    if(wouldBeFatal && state.player.purchasedTalents.has('contingency-protocol') && !state.player.contingencyUsed) {
                        state.player.contingencyUsed = true;
                        state.player.health = 1;
                        addStatusEffect('Contingency Protocol', '🛡️', 3000);
                        const invulnShieldEndTime = Date.now() + 3000;
                        state.player.shield = true;
                        state.player.shield_end_time = invulnShieldEndTime;
                        setTimeout(()=> { if(state.player.shield_end_time <= invulnShieldEndTime) state.player.shield = false; }, 3000);
                        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#f1c40f', 100, 8, 50);
                    } else {
                        state.player.health -= damage; 
                    }
                    play('hitSound'); 
                    if(e.onDamage) e.onDamage(e, damage, state.player, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    if(state.player.health<=0) state.gameOver=true; 
                } else { 
                    state.player.shield=false; 
                    play('shieldBreak');
                    if(state.player.purchasedTalents.has('aegis-retaliation')) state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 250, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: 0, color: 'rgba(255, 255, 255, 0.5)' });
                }
                const overlap = (e.r + state.player.r) - pDist;
                const ang=Math.atan2(state.player.y-e.y,state.player.x-e.x); 
                totalPlayerPushX += Math.cos(ang) * overlap;
                totalPlayerPushY += Math.sin(ang) * overlap;
                playerCollisions++;
            }
        }
    }

    if (playerCollisions > 0) {
        state.player.x += totalPlayerPushX / playerCollisions;
        state.player.y += totalPlayerPushY / playerCollisions;
    }

    for (let i = state.pickups.length - 1; i >= 0; i--) {
        const p = state.pickups[i];
        if (p.lifeEnd && Date.now() > p.lifeEnd) { state.pickups.splice(i, 1); continue; }
        const slowZones = timeEater ? state.effects.filter(eff => eff.type === 'slow_zone') : [];
        if (timeEater && !p.eatenBy) {
            for (const zone of slowZones) {
                if (Math.hypot(p.x - zone.x, p.y - zone.y) < zone.r) {
                    p.eatenBy = zone;
                    break;
                }
            }
        }
        if (p.eatenBy) {
            const pullX = p.eatenBy.x - p.x;
            const pullY = p.eatenBy.y - p.y;
            p.vx = (pullX / (Math.hypot(pullX, pullY) || 1)) * 3;
            p.vy = (pullY / (Math.hypot(pullX, pullY) || 1)) * 3;
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
                const acceleration = 0.5;
                p.vx += Math.cos(angle) * acceleration;
                p.vy += Math.sin(angle) * acceleration;
            }
            p.vx *= 0.95; p.vy *= 0.95;
        }
        p.x += p.vx; p.y += p.vy;
        utils.drawCircle(ctx, p.x, p.y, p.r, p.emoji === '🩸' ? '#800020' : '#2ecc71');
        ctx.fillStyle="#fff"; ctx.font="16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.emoji || powers[p.type]?.emoji || '?', p.x, p.y+6);
        ctx.textAlign = "left";
        const collectDist = Math.hypot(state.player.x - p.x, state.player.y - p.y);
        if(collectDist < state.player.r + p.r){
            play('pickupSound'); 
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

    state.effects.forEach((effect, index) => {
        if (Date.now() > (effect.endTime || Infinity)) {
            if (effect.type === 'paradox_echo') stopLoopingSfx('paradoxTrailHum');
            if (effect.type === 'shrinking_box') stopLoopingSfx('wallShrink');
            state.effects.splice(index, 1);
            return;
        }

        if (effect.type === 'nova_bullet' || effect.type === 'ricochet_projectile') {
            let speedMultiplier = 1.0;
            state.effects.forEach(eff => {
                if (eff.type === 'dilation_field') {
                    if (eff.shape === 'horseshoe') {
                        const dist = Math.hypot(effect.x - eff.x, effect.y - eff.y);
                        if (dist < eff.r) {
                             let projAngle = Math.atan2(effect.y - eff.y, effect.x - eff.x);
                             let targetAngle = eff.angle;
                             let diff = Math.atan2(Math.sin(projAngle - targetAngle), Math.cos(projAngle - targetAngle));
                             if (Math.abs(diff) > (Math.PI / 4)) {
                                 speedMultiplier = 0.2;
                             }
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
            const elapsed = (Date.now() - effect.startTime) / 1000; effect.radius = elapsed * effect.speed;
            ctx.strokeStyle = effect.color || `rgba(255, 255, 255, ${1-(effect.radius/effect.maxRadius)})`; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI); ctx.stroke();
            let targets = (effect.caster === state.player) ? state.enemies : [state.player];
            targets.forEach(target => {
                if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) {
                    if (effect.damage > 0) {
                        let dmg = (target.boss || target === state.player) ? effect.damage : 1000;
                        if(target.health) target.health -= dmg; else target.hp -= dmg;
                        if (target.onDamage) target.onDamage(target, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    }
                    effect.hitEnemies.add(target);
                }
            });
            if (effect.radius >= effect.maxRadius) state.effects.splice(index, 1);
        } else if (effect.type === 'chain_lightning') {
            const linkIndex = Math.floor((Date.now() - effect.startTime) / effect.durationPerLink); if (linkIndex >= effect.targets.length) { state.effects.splice(index, 1); return; }
            for (let i = 0; i <= linkIndex; i++) {
                const from = i === 0 ? effect.caster : effect.targets[i - 1];
                const to = effect.targets[i];
                if (!from || typeof from.x !== 'number' || !to || typeof to.x !== 'number') continue;
                utils.drawLightning(ctx, from.x, from.y, to.x, to.y, effect.color || '#00ffff', 4);
                if (!effect.links.includes(to)) {
                    utils.spawnParticles(state.particles, to.x, to.y, '#ffffff', 30, 5, 20);
                    let dmg = (to.boss ? effect.damage : 50) * state.player.talent_modifiers.damage_multiplier;
                    if (effect.caster !== state.player) dmg = effect.damage;
                    to.hp -= dmg; 
                    if (to.onDamage) to.onDamage(to, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    effect.links.push(to);
                    if (state.player.purchasedTalents.has('volatile-finish') && i === effect.targets.length - 1) {
                         state.effects.push({ type: 'shockwave', caster: state.player, x: to.x, y: to.y, radius: 0, maxRadius: 150, speed: 600, startTime: Date.now(), hitEnemies: new Set(), damage: 15 * state.player.talent_modifiers.damage_multiplier });
                    }
                }
            }
        } else if (effect.type === 'ricochet_projectile') { 
            const hasPayload = state.player.purchasedTalents.has('unstable-payload');
            if(hasPayload) { const bouncesSoFar = effect.initialBounces - effect.bounces; effect.r = 8 + bouncesSoFar * 2; effect.damage = 10 + bouncesSoFar * 5; }
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, effect.color || '#f1c40f'); 
            if(effect.x < effect.r || effect.x > canvas.width - effect.r) { effect.dx *= -1; effect.bounces--; } 
            if(effect.y < effect.r || effect.y > canvas.height - effect.r) { effect.dy *= -1; effect.bounces--; } 
            state.enemies.forEach(e => { if (!effect.hitEnemies.has(e) && Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { let damage = (state.player.berserkUntil > Date.now()) ? effect.damage * 2 : effect.damage; e.hp -= damage; effect.bounces--; const angle = Math.atan2(e.y - effect.y, e.x - effect.x); effect.dx = -Math.cos(angle) * 10; effect.dy = -Math.sin(angle) * 10; effect.hitEnemies.add(e); setTimeout(()=>effect.hitEnemies.delete(e), 200); } }); 
            if (effect.bounces <= 0) state.effects.splice(index, 1);
        } else if (effect.type === 'nova_controller') { 
            if (Date.now() > effect.startTime + effect.duration) { state.effects.splice(index, 1); return; } 
            if(Date.now() - effect.lastShot > 50) { 
                effect.lastShot = Date.now(); const speed = 5;
                const caster = effect.caster || state.player;
                if (state.player.purchasedTalents.has('nova-pulsar') && caster === state.player) {
                    const angles = [effect.angle, effect.angle + (2 * Math.PI / 3), effect.angle - (2 * Math.PI / 3)];
                    angles.forEach(angle => { state.effects.push({ type: 'nova_bullet', x: caster.x, y: caster.y, r: effect.r || 4, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, color: effect.color, caster: caster }); });
                } else {
                    state.effects.push({ type: 'nova_bullet', x: caster.x, y: caster.y, r: effect.r || 4, dx: Math.cos(effect.angle) * speed, dy: Math.sin(effect.angle) * speed, color: effect.color, caster: caster, damage: effect.damage }); 
                }
                effect.angle += 0.5; 
            }
        } else if (effect.type === 'nova_bullet') { 
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, effect.color || '#fff'); 
            if(effect.x < 0 || effect.x > canvas.width || effect.y < 0 || effect.y > canvas.height) state.effects.splice(index, 1); 
            if (effect.caster === state.player) {
                state.enemies.forEach(e => { if (e !== effect.caster && Math.hypot(e.x-effect.x, e.y-effect.y) < e.r + effect.r) { let damage = ((state.player.berserkUntil > Date.now()) ? 6 : 3) * state.player.talent_modifiers.damage_multiplier; e.hp -= damage; state.effects.splice(index, 1); } }); 
            } else {
                if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < state.player.r + effect.r) {
                    if (!state.player.shield) {
                        state.player.health -= (effect.damage || 40);
                    } else state.player.shield = false;
                    state.effects.splice(index, 1);
                }
            }
        } else if (effect.type === 'orbital_target') {
            const hasTracking = state.player.purchasedTalents.has('targeting-algorithm');
            if(hasTracking && effect.target && effect.target.hp > 0) { effect.x = effect.target.x; effect.y = effect.target.y; }
            const duration = 1500; const progress = (Date.now() - effect.startTime) / duration; 
            if (progress >= 1) { 
                spawnParticlesCallback(effect.x, effect.y, '#e67e22', 100, 8, 40); 
                const explosionRadius = effect.radius || 150; 
                const targets = (effect.caster === state.player) ? state.enemies : [state.player];
                targets.forEach(e => { 
                    if (Math.hypot(e.x-effect.x, e.y-effect.y) < explosionRadius) { 
                        let damage = ((state.player.berserkUntil > Date.now() && effect.caster === state.player) ? 50 : 25)  * state.player.talent_modifiers.damage_multiplier; 
                        if(effect.caster !== state.player) damage = effect.damage;
                        
                        if(e.health) e.health -= damage; else e.hp -= damage; 

                        if(e.onDamage) e.onDamage(e, damage, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers); 
                    } 
                }); 
                state.effects.splice(index, 1); 
                return; 
            } 
            ctx.strokeStyle = effect.color || 'rgba(230, 126, 34, 0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, 50 * (1-progress), 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(effect.x-10, effect.y); ctx.lineTo(effect.x+10, effect.y); ctx.moveTo(effect.x, effect.y-10); ctx.lineTo(effect.x, effect.y+10); ctx.stroke(); 
        } else if (effect.type === 'black_hole') { 
            if (Date.now() > effect.endTime) { if (state.player.purchasedTalents.has('unstable-singularity')) { state.effects.push({ type: 'shockwave', caster: state.player, x: effect.x, y: effect.y, radius: 0, maxRadius: effect.maxRadius, speed: 800, startTime: Date.now(), hitEnemies: new Set(), damage: 25 * state.player.talent_modifiers.damage_multiplier }); } state.effects.splice(index, 1); return; } 
            const elapsed = Date.now() - effect.startTime;
            const progress = Math.min(1, elapsed / effect.duration);
            const currentPullRadius = effect.maxRadius * progress; 
            utils.drawCircle(ctx, effect.x, effect.y, effect.radius, effect.color || "#000"); 
            ctx.strokeStyle = effect.color ? `rgba(${effect.color.slice(1).match(/.{1,2}/g).map(v => parseInt(v, 16)).join(',')}, ${0.6 * progress})` : `rgba(155, 89, 182, ${0.6 * progress})`;
            ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, currentPullRadius, 0, 2*Math.PI); ctx.stroke();
        } else if (effect.type === 'seeking_shrapnel') {
            let closest = null; const sortedEnemies = [...state.enemies].sort((a,b) => Math.hypot(a.x-effect.x, a.y-effect.y) - Math.hypot(b.x-effect.x, b.y-effect.y));
            if(sortedEnemies[effect.targetIndex]) closest = sortedEnemies[effect.targetIndex]; else if (sortedEnemies.length > 0) closest = sortedEnemies[0];
            if(closest){ const angle = Math.atan2(closest.y - effect.y, closest.x - effect.x); const turnSpeed = 0.1; effect.dx = effect.dx * (1-turnSpeed) + (Math.cos(angle) * effect.speed) * turnSpeed; effect.dy = effect.dy * (1-turnSpeed) + (Math.sin(angle) * effect.speed) * turnSpeed; }
            effect.x += effect.dx; effect.y += effect.dy;
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#ff9944');
            state.enemies.forEach(e => { if(Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { e.hp -= effect.damage; state.effects.splice(index, 1); }});
            if(Date.now() > effect.startTime + effect.life) state.effects.splice(index, 1);
        } else if (effect.type === 'repulsion_field') {
            if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; }
            effect.x = state.player.x; effect.y = state.player.y;
            const isOverloaded = effect.isOverloaded && Date.now() < effect.startTime + 2000;
            if (isOverloaded) { const pulseAlpha = 0.8 * (1 - (Date.now() - effect.startTime) / 2000); ctx.strokeStyle = `rgba(0, 255, 255, ${pulseAlpha})`; ctx.lineWidth = 6;
            } else { const alpha = (effect.endTime - Date.now()) / 5000 * 0.4; ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineWidth = 4; }
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2*Math.PI); ctx.stroke();
        } else if (effect.type === 'glitch_zone') {
            if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; }
            const alpha = (effect.endTime - Date.now()) / 5000 * 0.3; ctx.fillStyle = `rgba(253, 121, 168, ${alpha})`; utils.drawCircle(ctx, effect.x, effect.y, effect.r, ctx.fillStyle);
            if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r + state.player.r) { if (!state.player.controlsInverted) { play('systemErrorSound'); addStatusEffect('Controls Inverted', '🔀', 3000); } state.player.controlsInverted = true; setTimeout(() => state.player.controlsInverted = false, 3000); }
        } else if (effect.type === 'annihilator_beam') {
            if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; }
            const { source, pillar } = effect; if(!source || !pillar || source.hp <= 0) { state.effects.splice(index, 1); return; }
            
            const alpha = (effect.endTime - Date.now()) / 1200; 
            ctx.fillStyle = `rgba(214, 48, 49, ${alpha * 0.7})`;
            
            // --- FIX: This is the new, corrected drawing logic ---
            ctx.save();
            ctx.fillStyle = `rgba(214, 48, 49, ${alpha * 0.7})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const distToPillar = Math.hypot(pillar.x - source.x, pillar.y - source.y);
            // Prevent division by zero or asin(>1) if the source is inside the pillar
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
            ctx.restore(); // Restores fillStyle and globalCompositeOperation
            // --- End of new drawing logic ---

            const allTargets = [state.player, ...state.enemies.filter(t => t !== source)];
            allTargets.forEach(target => {
                const distToPillarCheck = Math.hypot(pillar.x - source.x, pillar.y - source.y);
                if (distToPillarCheck <= pillar.r) return; // Don't fire if source is inside pillar

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
                        target.hp -= 999;
                    }
                }
            });
        } else if (effect.type === 'juggernaut_charge_ring') {
            const progress = (Date.now() - effect.startTime) / effect.duration; if (progress >= 1) { state.effects.splice(index, 1); return; }
            ctx.strokeStyle = `rgba(255,255,255, ${0.8 * (1-progress)})`; ctx.lineWidth = 15; ctx.beginPath(); ctx.arc(effect.source.x, effect.source.y, effect.source.r + (100 * progress), 0, Math.PI*2); ctx.stroke();
        } else if (effect.type === 'teleport_indicator') {
            if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; }
            const progress = 1 - ((effect.endTime - Date.now()) / 1000);
            ctx.strokeStyle = `rgba(255, 0, 0, ${1 - progress})`; ctx.lineWidth = 5 + (10 * progress); ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r * (1.5 - progress), 0, 2 * Math.PI); ctx.stroke();
        } else if (effect.type === 'slow_zone') {
            if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; }
            const alpha = (effect.endTime - Date.now()) / 6000 * 0.4;
            for(let i=0; i<3; i++) {
                ctx.strokeStyle = `rgba(223, 230, 233, ${alpha * (0.5 + Math.sin(Date.now()/200 + i*2)*0.5)})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.r * (0.6 + i*0.2), 0, Math.PI*2);
                ctx.stroke();
            }
        }
        else if (effect.type === 'transient_lightning') {
            utils.drawLightning(ctx, effect.x1, effect.y1, effect.x2, effect.y2, effect.color, 5);
        }
        else if (effect.type === 'miasma_gas') {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#6ab04c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
            if (!state.player.shield) {
                state.player.health -= 0.25; 
                if (state.player.health <= 0) state.gameOver = true;
            }
        }
        else if (effect.type === 'charge_indicator') {
            const progress = (Date.now() - effect.startTime) / effect.duration;
            ctx.fillStyle = effect.color || 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(effect.source.x, effect.source.y, effect.radius * progress, 0, 2 * Math.PI);
            ctx.fill();
        }
        else if (effect.type === 'paradox_echo') {
            const elapsed = Date.now() - effect.startTime;
            const progress = elapsed / 5000;
            if (progress >= 1) {
                stopLoopingSfx('paradoxTrailHum');
                effect.endTime = Date.now();
                return;
            }
            const currentIndex = Math.floor(effect.history.length * progress);
            const currentPos = effect.history[currentIndex];
            if (currentPos) {
                 utils.drawCircle(ctx, currentPos.x, currentPos.y, effect.playerR, 'rgba(129, 236, 236, 0.4)');
                 if (Math.random() < 0.7) {
                    effect.trail.push({x: currentPos.x, y: currentPos.y, lifeEnd: Date.now() + 3000});
                }
            }
            
            effect.trail.forEach((p, i) => {
                if (Date.now() > p.lifeEnd) {
                    effect.trail.splice(i, 1);
                    return;
                }
                const lifeProgress = (p.lifeEnd - Date.now()) / 3000;
                
                ctx.fillStyle = `rgba(231, 76, 60, ${0.4 * lifeProgress})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
                ctx.fill();

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
            const { source, endTime } = effect;
            const remainingTime = endTime - Date.now();
            if (remainingTime > 250) {
                effect.angle = Math.atan2(state.player.y - source.y, state.player.x - source.x);
            }
            
            const coneAngle = Math.PI / 4;
            const coneLength = canvas.height;
            const progress = 1 - (remainingTime) / 2500;
            ctx.globalAlpha = 0.5 * progress;
            ctx.fillStyle = '#9b59b6';
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.arc(source.x, source.y, coneLength, effect.angle - coneAngle / 2, effect.angle + coneAngle / 2);
            ctx.lineTo(source.x, source.y);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            if (remainingTime <= 0 && !effect.hasFired) {
                effect.hasFired = true;
                play('syphonFire');
                const playerAngle = Math.atan2(state.player.y - source.y, state.player.x - source.x);
                let angleDiff = Math.abs(effect.angle - playerAngle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
                
                if (angleDiff < coneAngle / 2) {
                    const stolenPower = state.offensiveInventory[0];
                    if (stolenPower) {
                        play('powerAbsorb');
                        state.offensiveInventory.shift();
                        state.offensiveInventory.push(null);
                        
                        switch (stolenPower) {
                            case 'missile':
                                state.effects.push({ type: 'shockwave', caster: source, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 400, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: 70, color: 'rgba(155, 89, 182, 0.7)' });
                                break;
                            case 'chain':
                                state.effects.push({ type: 'chain_lightning', targets: [state.player], links: [], startTime: Date.now(), durationPerLink: 80, damage: 75, caster: source, color: '#9b59b6' });
                                break;
                            case 'shockwave':
                                state.effects.push({ type: 'shockwave', caster: source, x: source.x, y: source.y, radius: 0, maxRadius: canvas.width, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: 60, color: 'rgba(155, 89, 182, 0.7)' });
                                break;
                            case 'black_hole':
                                state.effects.push({ type: 'black_hole', x: source.x, y: source.y, radius: 30, maxRadius: 400, damageRate: 200, lastDamage: new Map(), startTime: Date.now(), duration: 5000, endTime: Date.now() + 5000, damage: 65, caster: source, color: '#9b59b6' });
                                break;
                             case 'orbitalStrike':
                                state.effects.push({ type: 'orbital_target', x: state.player.x, y: state.player.y, startTime: Date.now(), caster: source, damage: 80, radius: 200, color: 'rgba(155, 89, 182, 0.8)' });
                                break;
                            case 'ricochetShot':
                                 for(let i = -1; i <= 1; i++) {
                                    const angle = effect.angle + i * 0.3;
                                    state.effects.push({ type: 'ricochet_projectile', x: source.x, y: source.y, dx: Math.cos(angle) * 12, dy: Math.sin(angle) * 12, r: 15, damage: 50, bounces: 5, initialBounces: 5, hitEnemies: new Set(), caster: source, color: '#9b59b6' });
                                 }
                                break;
                            case 'bulletNova':
                                state.effects.push({ type: 'nova_controller', startTime: Date.now(), duration: 2500, lastShot: 0, angle: Math.random() * Math.PI * 2, caster: source, color: '#9b59b6', r: 8 });
                                break;
                        }
                    }
                }
            }
        }
        else if (effect.type === 'shrinking_box') {
            playLooping('wallShrink');
            const progress = (Date.now() - effect.startTime) / effect.duration;
            const currentSize = effect.initialSize * (1 - progress);
            if(currentSize <= 0) {
                stopLoopingSfx('wallShrink');
                effect.endTime = Date.now();
                return;
            }
            const halfSize = currentSize / 2;
            const left = effect.x - halfSize;
            const right = effect.x + halfSize;
            const top = effect.y - halfSize;
            const bottom = effect.y + halfSize;
            const gapSize = 80;
            const wallThickness = 5;

            ctx.fillStyle = 'rgba(211, 84, 0, 0.5)';
            const gapStart = effect.gapPosition * (currentSize - gapSize);
            
            const playerIsInsideBounds = state.player.x >= left && state.player.x <= right && state.player.y >= top && state.player.y <= bottom;

            if (playerIsInsideBounds) {
                if (state.player.y - state.player.r < top && (effect.gapSide !== 0 || state.player.x < left + gapStart || state.player.x > left + gapStart + gapSize)) {
                    state.player.y = top + state.player.r;
                }
                if (state.player.y + state.player.r > bottom && (effect.gapSide !== 2 || state.player.x < left + gapStart || state.player.x > left + gapStart + gapSize)) {
                    state.player.y = bottom - state.player.r;
                }
                if (state.player.x - state.player.r < left && (effect.gapSide !== 3 || state.player.y < top + gapStart || state.player.y > top + gapStart + gapSize)) {
                    state.player.x = left + state.player.r;
                }
                if (state.player.x + state.player.r > right && (effect.gapSide !== 1 || state.player.y < top + gapStart || state.player.y > top + gapStart + gapSize)) {
                    state.player.x = right - state.player.r;
                }
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
        else if (effect.type === 'dilation_field') {
            ctx.globalAlpha = 0.2;
            if (effect.shape === 'horseshoe') {
                ctx.fillStyle = '#bdc3c7';
                ctx.beginPath();
                const openingAngle = Math.PI / 2;
                ctx.arc(effect.x, effect.y, effect.r, effect.angle + openingAngle/2, effect.angle - openingAngle/2 + 2*Math.PI);
                ctx.arc(effect.x, effect.y, effect.r * 0.8, effect.angle - openingAngle/2 + 2*Math.PI, effect.angle + openingAngle/2, true);
                ctx.closePath();
                ctx.fill();
            } else {
                 ctx.fillStyle = '#bdc3c7';
                 utils.drawCircle(ctx, effect.x, effect.y, effect.r, ctx.fillStyle);
            }
            ctx.globalAlpha = 1.0;
        }
        else if (effect.type === 'shaper_rune') {
            const runeSymbols = { nova: '💫', shockwave: '💥', lasers: '☄️', heal: '❤️', speed_buff: '🚀' };
            ctx.font = `${effect.r * 0.8}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.r, 0, 2*Math.PI);
            ctx.fill();
            ctx.fillStyle = 'rgba(241, 196, 15, 0.9)';
            ctx.fillText(runeSymbols[effect.runeType] || '?', effect.x, effect.y);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
        else if (effect.type === 'shaper_zone') {
            const colors = {
                reckoning: 'rgba(231, 76, 60, 0.3)',
                alacrity: 'rgba(52, 152, 219, 0.3)',
                ruin: 'rgba(142, 68, 173, 0.3)'
            };
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, colors[effect.zoneType]);
            
            const dist = Math.hypot(state.player.x - effect.x, state.player.y - effect.y);
            if (dist < effect.r) {
                if (effect.playerInsideTime === null) effect.playerInsideTime = Date.now();
                
                const timeInside = Date.now() - effect.playerInsideTime;
                const attuneProgress = timeInside / effect.attuneTime;

                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, effect.r, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * attuneProgress));
                ctx.stroke();

                if (attuneProgress >= 1) {
                    play('shaperAttune');
                    switch(effect.zoneType) {
                        case 'reckoning':
                            addStatusEffect('Reckoning', '⚔️', 8000);
                            state.player.berserkUntil = Date.now() + 8000;
                            break;
                        case 'alacrity':
                            addStatusEffect('Alacrity', '🚀', 8000);
                            state.player.speed *= 1.5;
                            setTimeout(() => state.player.speed /= 1.5, 8000);
                            break;
                        case 'ruin':
                            if(effect.boss && effect.boss.hp > 0) effect.boss.hp -= effect.boss.maxHP * 0.15;
                            state.player.health -= 30;
                            break;
                    }
                    state.effects = state.effects.filter(e => e.type !== 'shaper_zone');
                    effect.boss.zonesActive = false;
                }
            } else {
                effect.playerInsideTime = null;
            }
        }
    });
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

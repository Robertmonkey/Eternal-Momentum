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

// --- NEW: Pass core handlers to gameHelpers ---
const gameHelpers = { addStatusEffect, spawnEnemy, spawnPickup, play, stopLoopingSfx, playLooping, addEssence, useSyphonCore, useLoopingEyeCore };
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


// --- NEW ---
// Function to handle unlocking Aberration Cores based on player level
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
    // --- UPDATED: Gentler leveling curve ---
    state.player.essenceToNextLevel = Math.floor(state.player.essenceToNextLevel * 1.18);
    state.player.ascensionPoints += 1;
    utils.spawnParticles(state.particles, state.player.x, state.player.y, '#00ffff', 80, 6, 50, 5);
    
    // --- NEW: Check for core unlocks on level up ---
    if (state.player.level === 10 && state.player.unlockedAberrationCores.size === 0) {
        showUnlockNotification("SYSTEM ONLINE", "Aberration Core Socket Unlocked");
    }
    handleCoreUnlocks(state.player.level);

    savePlayerState();
}

export function addEssence(amount) {
    if (state.gameOver) return;

    let modifiedAmount = Math.floor(amount * state.player.talent_modifiers.essence_gain_modifier);
    
    // --- NEW: Essence Transmutation Talent ---
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
            y = canvas.height - edgeMargin;
            break;
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
        if (!bossSelectedInLoop) {
            break;
        }
        emergencyBreak++;
    }

    return Array.from(bossesToSpawn);
}

export function spawnBossesForStage(stageNum) {
    let bossIdsToSpawn;

    if (state.arenaMode && state.customOrreryBosses.length > 0) {
        bossIdsToSpawn = state.customOrreryBosses;
    } else {
        bossIdsToSpawn = getBossesForStage(stageNum);
    }

    if (bossIdsToSpawn && bossIdsToSpawn.length > 0) {
        bossIdsToSpawn.forEach(bossId => {
            spawnEnemy(true, bossId, getSafeSpawnLocation());
        });
        // --- NEW: Centurion Core Logic ---
        if(state.player.equippedAberrationCore === 'centurion') {
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
        
        let difficultyIndex;
        if (state.arenaMode) {
            const tierSum = state.customOrreryBosses.reduce((sum, bId) => {
                const boss = bossData.find(b => b.id === bId);
                return sum + (boss ? boss.difficulty_tier : 0);
            }, 0);
            difficultyIndex = tierSum * 2.5; 
        } else {
            difficultyIndex = (state.currentStage - 1);
        }
        
        const scalingFactor = 12;
        const finalHp = baseHp + (Math.pow(difficultyIndex, 1.5) * scalingFactor);
        e.maxHP = Math.round(finalHp);
        e.hp = e.maxHP;

        state.enemies.push(e);
        if (bd.init) bd.init(e, state, spawnEnemy, canvas);
        
        if (!state.bossActive) {
            const stageInfo = STAGE_CONFIG.find(s => s.stage === state.currentStage);
            let bannerName = "Custom Encounter";
            if(stageInfo) {
                bannerName = stageInfo.displayName;
            } else if (state.arenaMode) {
                bannerName = "Forged Timeline";
            } else if (e.name) {
                bannerName = e.name;
            }
            showBossBanner({name: bannerName});
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
    // --- NEW: Check if pickup spawn is disabled by a core ---
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

// --- NEW: Core logic handlers ---
export function useSyphonCore(mx, my) {
    play('syphonFire');
    const angle = Math.atan2(my - state.player.y, mx - state.player.x);
    state.effects.push({
        type: 'syphon_cone',
        source: state.player,
        angle: angle,
        endTime: Date.now() + 500,
        isPlayer: true
    });
    state.player.talent_states.core_states.syphon.canUse = false;
}

export function useLoopingEyeCore(mx, my) {
    play('chargeUpSound');
    state.effects.push({
        type: 'teleport_indicator',
        x: mx,
        y: my,
        r: state.player.r,
        endTime: Date.now() + 1000,
        isPlayer: true
    });
    setTimeout(() => {
        if(state.gameOver) return;
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#fff', 30, 4, 20);
        state.player.x = mx;
        state.player.y = my;
        play('mirrorSwap');
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#fff', 30, 4, 20);
        state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 100, speed: 500, startTime: Date.now(), hitEnemies: new Set(), damage: 5 * state.player.talent_modifiers.damage_multiplier });
    }, 1000);
}


export function gameTick(mx, my) {
    if (state.isPaused) return true;
    const now = Date.now();

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
                // --- NEW: Shaper of Fate Core ---
                if (state.player.equippedAberrationCore === 'shaper_of_fate') {
                    const positions = [{x: -50, y: 0}, {x: 50, y: 0}, {x: 0, y: -50}];
                    ['damage', 'defense', 'utility'].forEach((type, i) => {
                        state.effects.push({type: 'shaper_rune_pickup', runeType: type, x: state.player.x + positions[i].x, y: state.player.y + positions[i].y, r: 20});
                    });
                    state.player.talent_states.core_states.shaper_of_fate.isDisabled = true;
                }
            }
        }
        if (state.bossActive && Math.random() < (0.007 + state.player.level * 0.001)) {
            spawnEnemy(false);
        }
        // --- UPDATED: Use talent modifier for power spawn rate ---
        if (Math.random() < ((0.02 + state.player.level * 0.0002) * state.player.talent_modifiers.power_spawn_rate_modifier)) {
            spawnPickup();
        }
    }
    
    if (state.gameOver) {
        stopAllLoopingSounds();
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
        if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 8000) {
            state.player.talent_states.phaseMomentum.active = true;
        }
    } else {
        state.player.talent_states.phaseMomentum.active = false;
    }
    
    let playerSpeedMultiplier = state.player.talent_states.phaseMomentum.active ? 1.10 : 1.0;
    
    const isBerserkImmune = state.player.berserkUntil > now && state.player.purchasedTalents.has('unstoppable-frenzy');
    
    if (state.player.statusEffects.some(e => e.name === 'Slowed' || e.name === 'Epoch-Slow') && !isBerserkImmune) {
        playerSpeedMultiplier *= 0.5;
    }
    
    // --- NEW: Aethel & Umbra Core speed/damage logic ---
    if (state.player.equippedAberrationCore === 'aethel_and_umbra') {
        if (state.player.health > state.player.maxHealth * 0.5) {
            playerSpeedMultiplier *= 1.10; // Aethel's speed
        }
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

    if (now > state.player.stunnedUntil) {
        state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
        state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
    }

    // --- NEW: Epoch-Ender Core history tracking ---
    const epochCore = state.player.equippedAberrationCore === 'epoch_ender';
    if(epochCore && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
        const history = state.player.talent_states.core_states.epoch_ender.history;
        history.push({ x: state.player.x, y: state.player.y, health: state.player.health });
        if(history.length > 120) history.shift(); // Keep 2 seconds of history (120 frames at 60fps)
    }

    // --- NEW: ABERRATION CORE LOGIC ---
    let coreId = state.player.equippedAberrationCore;
    // Pantheon Core logic
    if (coreId === 'pantheon') {
        if (now > (state.player.talent_states.core_states.pantheon.lastCycleTime || 0) + 60000) {
            const unlockedCores = Array.from(state.player.unlockedAberrationCores).filter(id => id !== 'pantheon');
            if (unlockedCores.length > 0) {
                const newCore = unlockedCores[Math.floor(Math.random() * unlockedCores.length)];
                state.player.talent_states.core_states.pantheon.activeCore = newCore;
                const coreData = bossData.find(b => b.id === newCore);
                showUnlockNotification(`Pantheon Attuned: ${coreData.name}`, 'Aspect Shift');
            }
            state.player.talent_states.core_states.pantheon.lastCycleTime = now;
        }
        coreId = state.player.talent_states.core_states.pantheon.activeCore || null;
    }

    if (coreId) {
        switch(coreId) {
            case 'vampire':
                if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 5000) {
                    state.player.health = Math.min(state.player.maxHealth, state.player.health + (1 / 60));
                }
                break;
            case 'gravity':
                if (now > (state.player.talent_states.core_states.gravity?.lastPulseTime || 0) + 10000) {
                    if(!state.player.talent_states.core_states.gravity) state.player.talent_states.core_states.gravity = {};
                    state.player.talent_states.core_states.gravity.lastPulseTime = now;
                    state.effects.push({ type: 'player_pull_pulse', x: state.player.x, y: state.player.y, maxRadius: 300, startTime: now, duration: 1000 });
                }
                break;
            case 'swarm_link':
                let prev = state.player;
                state.player.talent_states.core_states.swarm_link.tail.forEach(c => {
                    c.x += (prev.x - c.x) * 0.2;
                    c.y += (prev.y - c.y) * 0.2;
                    utils.drawCircle(ctx, c.x, c.y, 8, "#c0392b");
                    prev = c;
                    state.enemies.forEach(e => {
                        if (Math.hypot(e.x - c.x, e.y - c.y) < e.r + 8 && !e.isFriendly) {
                            e.hp -= 0.2 * state.player.talent_modifiers.damage_multiplier;
                        }
                    });
                });
                break;
            case 'architect':
                if (now > (state.player.talent_states.core_states.architect.lastPillarTime || 0) + 15000) {
                    state.player.talent_states.core_states.architect.lastPillarTime = now;
                    play('architectBuild');
                    const pillarPositions = [
                        {x: state.player.x - 100, y: state.player.y},
                        {x: state.player.x + 100, y: state.player.y},
                        {x: state.player.x, y: state.player.y - 100},
                        {x: state.player.x, y: state.player.y + 100},
                    ];
                    pillarPositions.forEach(pos => {
                        state.effects.push({ type: 'architect_pillar', x: pos.x, y: pos.y, r: 20, endTime: now + 10000 });
                    });
                }
                break;
             case 'puppeteer':
                if (now > (state.player.talent_states.core_states.puppeteer.lastConversion || 0) + 8000) {
                    let farthestEnemy = null;
                    let maxDist = 0;
                    state.enemies.forEach(e => {
                        if (!e.boss && !e.isPuppet && !e.isFriendly) {
                            const d = Math.hypot(state.player.x - e.x, state.player.y - e.y);
                            if (d > maxDist) {
                                maxDist = d;
                                farthestEnemy = e;
                            }
                        }
                    });

                    const currentPuppetCount = state.enemies.filter(e => e.isFriendly && e.id === 'puppet').length;
                    if (farthestEnemy && currentPuppetCount < 3) {
                        state.player.talent_states.core_states.puppeteer.lastConversion = now;
                        play('puppeteerConvert');
                        farthestEnemy.isPuppet = true;
                        farthestEnemy.isFriendly = true;
                        farthestEnemy.id = 'puppet';
                        farthestEnemy.customColor = '#a29bfe';
                        farthestEnemy.hp = 104;
                        farthestEnemy.maxHP = 104;
                        farthestEnemy.dx *= 1.5;
                        farthestEnemy.dy *= 1.5;
                        state.effects.push({
                            type: 'transient_lightning',
                            x1: state.player.x, y1: state.player.y,
                            x2: farthestEnemy.x, y2: farthestEnemy.y,
                            color: '#a29bfe',
                            endTime: now + 200
                        });
                    }
                }
                break;
            case 'helix_weaver':
                 if (now > (state.player.talent_states.core_states.helix_weaver?.lastBolt || 0) + 5000) {
                    if(!state.player.talent_states.core_states.helix_weaver) state.player.talent_states.core_states.helix_weaver = {};
                    state.player.talent_states.core_states.helix_weaver.lastBolt = now;
                    state.effects.push({type: 'helix_bolt', x: state.player.x, y: state.player.y, r: 8, speed: 2, angle: Math.random() * 2 * Math.PI, lifeEnd: now + 10000, caster: state.player});
                 }
                 break;
        }
    }


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
    utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r, state.player.shield ? "#f1c40f" : ((state.player.berserkUntil > now) ? '#e74c3c' : (state.player.infected ? '#55efc4' : "#3498db")));
    
    if (state.decoy) {
        utils.drawCircle(ctx, state.decoy.x, state.decoy.y, state.decoy.r, "#9b59b6");
        if (now > state.decoy.expires) {
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
                // --- NEW: Splitter Core Boss Death ---
                if (state.player.equippedAberrationCore === 'splitter' && !e.isFriendly) {
                     for(let wave = 0; wave < 2; wave++) {
                        setTimeout(() => {
                            for(let j=0; j<3; j++) {
                                const minion = spawnEnemy(false, null, {x: e.x, y: e.y});
                                if(minion) {
                                    minion.isFriendly = true;
                                    minion.customColor = '#ffaa00';
                                    minion.hp = 10;
                                    minion.lifeEnd = now + 10000;
                                }
                            }
                        }, wave * 1000);
                     }
                }
                if (e.onDeath) e.onDeath(e, state, spawnEnemy, spawnParticlesCallback, play, stopLoopingSfx);
                state.enemies.splice(i, 1);
                if (!state.enemies.some(en => en.boss)) {
                    state.bossActive = false;
                    AudioManager.playSfx('bossDefeatSound');
                    AudioManager.fadeOutMusic();
                    if (state.arenaMode) {
                        showUnlockNotification("Timeline Forged!", "Victory");
                        setTimeout(() => {
                            state.gameOver = true;
                        }, 2000);
                    } else {
                        state.bossSpawnCooldownEnd = now + 4000;
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
                }
            } else {
                addEssence(10);
                // --- NEW: Thermal Runaway Talent ---
                if (state.player.purchasedTalents.has('thermal-runaway') && state.player.berserkUntil > now) {
                    state.player.berserkUntil += 100; // 0.1 seconds
                }
                // --- NEW: Splitter Core Minion Spawn ---
                if(state.player.equippedAberrationCore === 'splitter' && !e.isFriendly && now > (state.player.talent_states.core_states.splitter.cooldownUntil || 0)) {
                    state.player.talent_states.core_states.splitter.cooldownUntil = now + 20000;
                    const minion = spawnEnemy(false, null, {x: e.x, y: e.y});
                    if(minion) {
                        minion.isFriendly = true;
                        minion.customColor = '#ffaa00';
                        minion.hp = 10;
                        minion.lifeEnd = now + 10000;
                    }
                }
                // --- NEW: Swarm Link Core ---
                if (state.player.equippedAberrationCore === 'swarm_link' && !e.isFriendly) {
                    state.player.talent_states.core_states.swarm_link.enemiesForNextSegment++;
                    if (state.player.talent_states.core_states.swarm_link.enemiesForNextSegment >= 2 && state.player.talent_states.core_states.swarm_link.tail.length < 50) {
                        state.player.talent_states.core_states.swarm_link.enemiesForNextSegment = 0;
                        const lastSegment = state.player.talent_states.core_states.swarm_link.tail.length > 0 ? state.player.talent_states.core_states.swarm_link.tail[state.player.talent_states.core_states.swarm_link.tail.length-1] : state.player;
                        state.player.talent_states.core_states.swarm_link.tail.push({x: lastSegment.x, y: lastSegment.y});
                    }
                }

                // --- NEW: Fractal Horror Core ---
                if (state.player.equippedAberrationCore === 'fractal_horror' && !e.isFriendly) {
                    if(!state.player.talent_states.core_states.fractal_horror) state.player.talent_states.core_states.fractal_horror = {killCount: 0};
                    state.player.talent_states.core_states.fractal_horror.killCount++;
                    if(state.player.talent_states.core_states.fractal_horror.killCount >= 10) {
                        state.player.talent_states.core_states.fractal_horror.killCount = 0;
                        for(let k=0; k<3; k++) {
                            const bit = spawnEnemy(false, null, {x: e.x, y: e.y});
                            if(bit) {
                                bit.isFriendly = true; bit.customColor = '#be2edd'; bit.r = 8; bit.hp=5; bit.lifeEnd = now + 8000;
                            }
                        }
                    }
                }
                 // --- NEW: Parasite Core ---
                if (e.isInfected && state.player.equippedAberrationCore === 'parasite') {
                    const spore = spawnEnemy(false, null, {x: e.x, y: e.y});
                    if(spore) {
                        spore.isFriendly = true;
                        spore.customColor = '#55efc4';
                        spore.r = 8;
                        spore.hp = 5;
                        spore.lifeEnd = now + 8000;
                    }
                }

                const scavengerRank = state.player.purchasedTalents.get('power-scavenger');
                if (scavengerRank && Math.random() < [0.01, 0.025][scavengerRank-1]) {
                    state.pickups.push({ x: e.x, y: e.y, r: 12, type: 'score', vx: 0, vy: 0, lifeEnd: now + 10000 });
                }
                const cryoRank = state.player.purchasedTalents.get('cryo-shatter');
                if (cryoRank && e.wasFrozen && Math.random() < [0.25, 0.5][cryoRank-1]) {
                    utils.spawnParticles(state.particles, e.x, e.y, '#ADD8E6', 40, 4, 30, 2);
                    state.effects.push({ type: 'shockwave', caster: state.player, x: e.x, y: e.y, radius: 0, maxRadius: 100, speed: 500, startTime: now, hitEnemies: new Set(), damage: 5 * state.player.talent_modifiers.damage_multiplier, color: 'rgba(0, 200, 255, 0.5)' });
                    // --- NEW: Glacial Propagation ---
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
                    if (field.isOverloaded && !field.hitEnemies.has(e)) {
                        const knockbackVelocity = 20;
                        const angle = Math.atan2(e.y - field.y, e.x - field.x);
                        e.knockbackDx = Math.cos(angle) * knockbackVelocity;
                        e.knockbackDy = Math.sin(angle) * knockbackVelocity;
                        e.knockbackUntil = now + 2000;
                        field.hitEnemies.add(e);
                    }
                    const knockbackForce = 5;
                    const angle = Math.atan2(e.y - field.y, e.x - field.x);
                    e.x += Math.cos(angle) * knockbackForce;
                    e.y += Math.sin(angle) * knockbackForce;
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
        } else if (e.knockbackUntil && e.knockbackUntil > now) {
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
            let tgt = e.isFriendly ? null : (state.decoy ? state.decoy : state.player);
            if (e.isFriendly) {
                let closestEnemy = null;
                let minDist = Infinity;
                state.enemies.forEach(other => {
                    if (!other.isFriendly && !other.boss) {
                        const dist = Math.hypot(e.x - other.x, e.y - other.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closestEnemy = other;
                        }
                    }
                });
                tgt = closestEnemy;
            }
            
            let enemySpeedMultiplier = 1;
            if (state.gravityActive && now < state.gravityEnd) {
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
                    if (e.id !== 'fractal_horror') {
                        const elapsed = now - effect.startTime;
                        const progress = Math.min(1, elapsed / effect.duration);
                        const currentPullRadius = effect.maxRadius * progress;
                        const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                        if (dist < currentPullRadius) {
                            let pullStrength = e.boss ? 0.03 : 0.1;
                            e.x += (effect.x - e.x) * pullStrength;
                            e.y += (effect.y - e.y) * pullStrength;
                            
                            if (state.player.purchasedTalents.has('unstable-singularity') && dist < effect.radius + e.r && now - (effect.lastDamage.get(e) || 0) > effect.damageRate) {
                                e.hp -= e.boss ? effect.damage : 15;
                                e.hp -= 5 * state.player.talent_modifiers.damage_multiplier;
                                effect.lastDamage.set(e, now);
                           }
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
        
        // --- NEW: Parasite Core from Phase Momentum ---
        if (state.player.talent_states.phaseMomentum.active && !e.boss && !e.isFriendly && state.player.equippedAberrationCore === 'parasite') {
             if (Math.hypot(state.player.x - e.x, state.player.y - e.y) < state.player.r + e.r) {
                e.isInfected = true;
                e.infectionEnd = now + 10000;
             }
        }


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

                        // --- NEW: Epoch Ender & Contingency Protocol ---
                        if(wouldBeFatal && epochCore && e.boss && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
                             const history = state.player.talent_states.core_states.epoch_ender.history;
                             const rewindState = history[0];
                             if (rewindState) {
                                state.player.x = rewindState.x;
                                state.player.y = rewindState.y;
                                state.player.health = rewindState.health;
                                state.player.talent_states.core_states.epoch_ender.cooldownUntil = now + 120000; // 2 min cooldown
                                play('timeRewind');
                             }
                        } else if(wouldBeFatal && state.player.purchasedTalents.has('contingency-protocol') && !state.player.contingencyUsed) {
                            state.player.contingencyUsed = true;
                            state.player.health = 1;
                            addStatusEffect('Contingency Protocol', '🛡️', 3000);
                            const invulnShieldEndTime = now + 3000;
                            state.player.shield = true;
                            state.player.shield_end_time = invulnShieldEndTime;
                            setTimeout(()=> { if(state.player.shield_end_time <= invulnShieldEndTime) state.player.shield = false; }, 3000);
                        } else {
                            state.player.health -= damage; 
                        }

                        // --- NEW: Mirror Mirage & Glitch Cores ---
                        if (state.player.equippedAberrationCore === 'mirror_mirage' && now > (state.player.talent_states.core_states.mirror_mirage.cooldownUntil || 0)) {
                            state.player.talent_states.core_states.mirror_mirage.cooldownUntil = now + 12000;
                            state.decoy = {x: state.player.x, y: state.player.y, r: 20, expires: now + 3000, isTaunting: true, isMobile: false};
                        }
                        if (state.player.equippedAberrationCore === 'glitch' && Math.random() < 0.25) {
                            state.effects.push({type: 'glitch_zone', x: e.x, y: e.y, r: 100, endTime: now + 4000});
                        }

                        play('hitSound'); 
                        if(e.onDamage) e.onDamage(e, damage, state.player, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                        if(state.player.health<=0) state.gameOver=true; 
                    } else { 
                        state.player.shield=false; 
                        play('shieldBreak');
                        // --- NEW: EMP Core ---
                        if (state.player.equippedAberrationCore === 'emp') {
                             state.effects = state.effects.filter(ef => ef.type !== 'nova_bullet' && ef.type !== 'ricochet_projectile' && ef.type !== 'seeking_shrapnel');
                             utils.spawnParticles(state.particles, state.player.x, state.player.y, '#3498db', 50, 4, 30);
                        }
                        if(state.player.purchasedTalents.has('aegis-retaliation')) state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 250, speed: 1000, startTime: now, hitEnemies: new Set(), damage: 0, color: 'rgba(255, 255, 255, 0.5)' });
                    }
                    const overlap = (e.r + state.player.r) - pDist;
                    const ang=Math.atan2(state.player.y-e.y,state.player.x-e.x); 
                    totalPlayerPushX += Math.cos(ang) * overlap;
                    totalPlayerPushY += Math.sin(ang) * overlap;
                    playerCollisions++;
                }
            }
        } else { // if friendly
            state.enemies.forEach(other => {
                if(!other.isFriendly && Math.hypot(e.x - other.x, e.y - other.y) < e.r + other.r) {
                    other.hp -= 0.5;
                    e.hp -= 0.5;
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
            // --- NEW: Essence Weaving Talent ---
            if (state.player.purchasedTalents.has('essence-weaving')) {
                state.player.health = Math.min(state.player.maxHealth, state.player.health + state.player.maxHealth * 0.02);
            }
             // --- NEW: Obelisk Core ---
            if (state.player.equippedAberrationCore === 'obelisk') {
                const currentCharges = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
                if (!currentCharges || currentCharges.count < 3) {
                    if(currentCharges) {
                        currentCharges.count++;
                        currentCharges.endTime = now + 99999;
                    } else {
                        addStatusEffect('Conduit Charge', '⚡', 99999);
                        state.player.statusEffects.find(e => e.name === 'Conduit Charge').count = 1;
                    }
                }
            }

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
                // --- NEW: Time Eater Core ---
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
            const elapsed = (now - effect.startTime) / 1000; effect.radius = elapsed * effect.speed;
            ctx.strokeStyle = effect.color || `rgba(255, 255, 255, ${1-(effect.radius/effect.maxRadius)})`; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI); ctx.stroke();
            let targets = (effect.caster === state.player) ? state.enemies.filter(e => !e.isFriendly) : [state.player];
            targets.forEach(target => {
                if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) {
                    if (effect.damage > 0) {
                        let dmg;
                        if (target.isPuppet && effect.caster === state.player) {
                            dmg = target.maxHP / 2;
                        } else if (target.boss || target === state.player) {
                            dmg = effect.damage;
                        } else {
                            dmg = 1000;
                        }

                        if (target === state.player) {
                            if (!target.shield) {
                                target.health -= dmg;
                                if (target.health <= 0) state.gameOver = true;
                            } else {
                                target.shield = false;
                            }
                        } else {
                            target.hp -= dmg;
                            // --- NEW: Basilisk Core ---
                            if (state.player.equippedAberrationCore === 'basilisk') {
                                addStatusEffect.call(target, 'Petrified', '🗿', 3000);
                            }
                        }
                        if (target.onDamage) target.onDamage(target, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    }
                    effect.hitEnemies.add(target);
                }
            });
            if (effect.radius >= effect.maxRadius) state.effects.splice(i, 1);
        }
        else if (effect.type === 'chain_lightning') {
            // ... (no changes here)
        }
        else if (effect.type === 'ricochet_projectile') { 
            // ... (no changes here)
        }
        else if (effect.type === 'nova_controller') { 
            // ... (no changes here)
        }
        else if (effect.type === 'nova_bullet') { 
            // ... (no changes here)
        }
        else if (effect.type === 'orbital_target') {
            // ... (no changes here)
        }
        else if (effect.type === 'black_hole') { 
            // ... (no changes here)
        }
        else if (effect.type === 'seeking_shrapnel') {
            // ... (no changes here)
        }
        else if (effect.type === 'repulsion_field') {
            // ... (no changes here)
        }
        else if (effect.type === 'glitch_zone') {
            // ... (no changes here)
        }
        else if (effect.type === 'annihilator_beam') {
            // ... (no changes here)
        }
        else if (effect.type === 'juggernaut_charge_ring') {
            // ... (no changes here)
        }
        else if (effect.type === 'teleport_indicator') {
            // ... (no changes here)
        }
        else if (effect.type === 'slow_zone') {
            // ... (no changes here)
        }
        else if (effect.type === 'transient_lightning') {
            // ... (no changes here)
        }
        else if (effect.type === 'miasma_gas') {
            // ... (no changes here)
        }
        else if (effect.type === 'charge_indicator') {
            // ... (no changes here)
        }
        else if (effect.type === 'paradox_echo') {
            // ... (no changes here)
        }
        else if (effect.type === 'syphon_cone') {
            // ... (no changes here)
        }
        else if (effect.type === 'shrinking_box') {
            // ... (no changes here)
        }
        else if (effect.type === 'dilation_field') {
            // ... (no changes here)
        }
        else if (effect.type === 'shaper_rune') {
            // ... (no changes here)
        }
        else if (effect.type === 'shaper_zone') {
            // ... (no changes here)
        }
        else if (effect.type === 'aspect_summon_ring') {
            // ... (no changes here)
        }
        // --- NEW EFFECTS ---
        else if (effect.type === 'architect_pillar') {
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#7f8c8d');
            state.enemies.forEach(e => {
                if (!e.isFriendly) {
                    const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                    if (dist < e.r + effect.r) {
                        const angle = Math.atan2(e.y - effect.y, e.x - effect.x);
                        e.x = effect.x + Math.cos(angle) * (e.r + effect.r);
                        e.y = effect.y + Math.sin(angle) * (e.r + effect.r);
                    }
                }
            });
        }
        else if (effect.type === 'player_pull_pulse') {
            const elapsed = now - effect.startTime;
            const progress = elapsed / effect.duration;
            if (progress > 1) { state.effects.splice(i, 1); continue; }
            const alpha = Math.sin(progress * Math.PI);
            ctx.strokeStyle = `rgba(155, 89, 182, ${alpha * 0.5})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.maxRadius * progress, 0, 2*Math.PI);
            ctx.stroke();
            state.enemies.forEach(e => {
                if(!e.boss) {
                    e.x += (effect.x - e.x) * 0.03;
                    e.y += (effect.y - e.y) * 0.03;
                }
            });
        }
        else if (effect.type === 'helix_bolt') {
            effect.x += effect.dx; effect.y += effect.dy;
            effect.angle += 0.1;
            effect.dx = Math.cos(effect.angle) * effect.speed;
            effect.dy = Math.sin(effect.angle) * effect.speed;
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#e74c3c');
            state.enemies.forEach(e => {
                if(!e.isFriendly && Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) {
                    e.hp -= 5 * state.player.talent_modifiers.damage_multiplier;
                    state.effects.splice(i, 1);
                }
            });
        }
        else if (effect.type === 'containment_pylon') {
            utils.drawCrystal(ctx, effect.x, effect.y, effect.r, '#d35400');
            state.enemies.forEach(e => {
                if(!e.isFriendly && !e.boss) {
                    const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                    if(dist < 150) {
                        e.x += (effect.x - e.x) * 0.02;
                        e.y += (effect.y - e.y) * 0.02;
                        utils.drawLightning(ctx, effect.x, effect.y, e.x, e.y, 'rgba(211, 84, 0, 0.5)', 2);
                    }
                }
            });
        }
         else if (effect.type === 'shaper_rune_pickup') {
            const runeSymbols = { damage: '🔥', defense: '🛡️', utility: '🚀' };
            utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#f1c40f');
            ctx.fillStyle = '#000'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(runeSymbols[effect.runeType], effect.x, effect.y + 6);
            ctx.textAlign = 'left';
            if(Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < state.player.r + effect.r) {
                switch(effect.runeType) {
                    case 'damage': addStatusEffect('Rune: Damage', '🔥', 99999); break;
                    case 'defense': addStatusEffect('Rune: Defense', '🛡️', 99999); break;
                    case 'utility': addStatusEffect('Rune: Utility', '🚀', 99999); break;
                }
                state.effects = state.effects.filter(e => e.type !== 'shaper_rune_pickup');
                state.player.talent_states.core_states.shaper_of_fate.isDisabled = false;
            }
        }
    }
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

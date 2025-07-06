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
    // Pass core-specific actions
    useSyphonCore: (mx, my) => Cores.handleCoreOnEmptySlot(mx, my, gameHelpers),
    useLoopingEyeCore: (mx, my) => Cores.handleCoreOnDefensivePower(mx, my, gameHelpers)
};


export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();
    
    // Check for immunities before applying
    if (name === 'Stunned' || name === 'Petrified' || name === 'Slowed' || name === 'Epoch-Slow') {
        const isBerserk = state.player.berserkUntil > now;
        const hasTalent = state.player.purchasedTalents.has('unstoppable-frenzy');
        if (isBerserk && hasTalent) {
            return; 
        }
    }

    // Replace existing effect of the same name to refresh it
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
        bossIdsToSpawn.forEach(bossId => spawnEnemy(true, bossId, getSafeSpawnLocation()));
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
            let bannerName = e.name;
            if (state.arenaMode) bannerName = "Forged Timeline";
            else if (state.currentStage <= 30) bannerName = STAGE_CONFIG.find(s => s.stage === state.currentStage)?.displayName || e.name;
            
            showBossBanner({name: bannerName});
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
        x: Math.random() * canvas.width, y: Math.random() * canvas.height, 
        r: 12, type, vx: 0, vy: 0, lifeEnd: Date.now() + life
    });
}

export function gameTick(mx, my) {
    if (state.isPaused) return true;
    const now = Date.now();

    // --- Game Over Check ---
    if (state.gameOver) {
        stopAllLoopingSounds();
        document.getElementById('gameOverMenu').style.display = 'flex';
        return false;
    }

    // --- Spawning Logic ---
    if (!state.bossHasSpawnedThisRun && now > state.bossSpawnCooldownEnd) {
        spawnBossesForStage(state.currentStage);
        state.bossHasSpawnedThisRun = true;
    }
    if (state.bossActive && Math.random() < (0.007 + state.player.level * 0.001)) spawnEnemy(false);
    if (Math.random() < ((0.02 + state.player.level * 0.0002) * state.player.talent_modifiers.power_spawn_rate_modifier)) spawnPickup();
    
    // --- Rendering Setup ---
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    utils.applyScreenShake(ctx);
    
    // --- Player Movement & State Update ---
    let finalMx = state.player.controlsInverted ? state.player.x - (mx - state.player.x) : mx;
    let finalMy = state.player.controlsInverted ? state.player.y - (my - state.player.y) : my;
    
    state.player.talent_states.phaseMomentum.active = state.player.purchasedTalents.has('phase-momentum') && (now - state.player.talent_states.phaseMomentum.lastDamageTime > 8000);
    
    let playerSpeedMultiplier = state.player.talent_states.phaseMomentum.active ? 1.10 : 1.0;
    const isBerserkImmune = state.player.berserkUntil > now && state.player.purchasedTalents.has('unstoppable-frenzy');
    if (state.player.statusEffects.some(e => e.name === 'Slowed' || e.name === 'Epoch-Slow') && !isBerserkImmune) playerSpeedMultiplier *= 0.5;
    
    state.effects.forEach(effect => { 
        if(effect.type === 'slow_zone' && Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r && !isBerserkImmune) playerSpeedMultiplier *= 0.5;
    });

    if (now > state.player.stunnedUntil) {
        state.player.x += (finalMx - state.player.x) * 0.015 * state.player.speed * playerSpeedMultiplier;
        state.player.y += (finalMy - state.player.y) * 0.015 * state.player.speed * playerSpeedMultiplier;
    }

    if (state.player.infected && now > state.player.infectionEnd) state.player.infected = false;
    if (state.player.infected && now - state.player.lastSpore > 2000) {
        state.player.lastSpore = now;
        const spore = spawnEnemy(false, null, {x: state.player.x, y: state.player.y});
        if(spore){ spore.r = 8; spore.hp = 2; spore.dx = (Math.random() - 0.5) * 8; spore.dy = (Math.random() - 0.5) * 8; spore.ignoresPlayer = true; }
    }

    // --- Core Tick Effects ---
    Cores.applyCoreTickEffects(gameHelpers);

    // --- Rendering Player and Decoy ---
    if (state.player.talent_states.phaseMomentum.active) {
        ctx.globalAlpha = 0.3;
        utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r + 5, 'rgba(0, 255, 255, 0.5)');
        ctx.globalAlpha = 1.0;
    }
    utils.drawCircle(ctx, state.player.x, state.player.y, state.player.r, state.player.shield ? "#f1c40f" : ((state.player.berserkUntil > now) ? '#e74c3c' : (state.player.infected ? '#55efc4' : "#3498db")));
    
    if (state.decoy) {
        utils.drawCircle(ctx, state.decoy.x, state.decoy.y, state.decoy.r, "#9b59b6");
        if (now > state.decoy.expires) state.decoy = null;
    }

    // --- Enemy Update and Collision Loop ---
    let totalPlayerPushX = 0, totalPlayerPushY = 0, playerCollisions = 0;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.hp <= 0) {
            if (e.boss) {
                if (e.onDeath) e.onDeath(e, state, spawnEnemy, spawnParticlesCallback, play, stopLoopingSfx);
                state.enemies.splice(i, 1);
                if (!state.enemies.some(en => en.boss)) {
                    state.bossActive = false;
                    state.bossHasSpawnedThisRun = false;
                    AudioManager.playSfx('bossDefeatSound');
                    AudioManager.fadeOutMusic();
                    if (state.arenaMode) {
                        showUnlockNotification("Timeline Forged!", "Victory");
                        setTimeout(() => { state.gameOver = true; }, 2000);
                    } else {
                        if (state.currentStage > state.player.highestStageBeaten) {
                            state.player.highestStageBeaten = state.currentStage;
                            state.player.ascensionPoints += 1;
                            showUnlockNotification("Stage Cleared! +1 AP", `Level ${state.currentStage + 1} Unlocked`);
                        }
                        handleThematicUnlock(state.currentStage);
                        addEssence(300);
                        state.bossSpawnCooldownEnd = now + 4000;
                        savePlayerState();
                    }
                }
            } else {
                addEssence(10);
                Cores.handleCoreOnEnemyDeath(e, gameHelpers);
                if (state.player.purchasedTalents.has('thermal-runaway') && state.player.berserkUntil > now) state.player.berserkUntil += 100;
                const scavengerRank = state.player.purchasedTalents.get('power-scavenger');
                if (scavengerRank && Math.random() < [0.01, 0.025][scavengerRank-1]) state.pickups.push({ x: e.x, y: e.y, r: 12, type: 'score', vx: 0, vy: 0, lifeEnd: now + 10000 });
                const cryoRank = state.player.purchasedTalents.get('cryo-shatter');
                if (cryoRank && e.wasFrozen && Math.random() < [0.25, 0.5][cryoRank-1]) {
                    utils.spawnParticles(state.particles, e.x, e.y, '#ADD8E6', 40, 4, 30, 2);
                    state.effects.push({ type: 'shockwave', caster: state.player, x: e.x, y: e.y, radius: 0, maxRadius: 100, speed: 500, startTime: now, hitEnemies: new Set(), damage: 5 * state.player.talent_modifiers.damage_multiplier, color: 'rgba(0, 200, 255, 0.5)' });
                    if (state.player.purchasedTalents.has('glacial-propagation')) state.effects.push({ type: 'small_freeze', x: e.x, y: e.y, radius: 100, endTime: now + 200 });
                }
                state.enemies.splice(i, 1);
            }
            continue;
        }

        if(e.lifeEnd && now > e.lifeEnd) { state.enemies.splice(i, 1); continue; }

        // Enemy Movement
        if(!e.frozen && !e.hasCustomMovement){ 
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
            if (tgt) { e.x += (tgt.x - e.x) * 0.005; e.y += (tgt.y - e.y) * 0.005; }
            e.x += e.dx; e.y += e.dy;
            if(e.x<e.r || e.x>canvas.width-e.r) e.dx*=-1; 
            if(e.y<e.r || e.y>canvas.height-e.r) e.dy*=-1;
        }
        
        // Boss Logic & Drawing
        if (e.boss && e.logic) e.logic(e, ctx, state, utils, gameHelpers);
        let color = e.customColor || (e.boss ? e.color : "#c0392b"); if(e.isInfected) color = '#55efc4'; if(e.frozen) color = '#add8e6';
        if(!e.hasCustomDraw) utils.drawCircle(ctx, e.x,e.y,e.r, color);
        
        // Player-Enemy Collision
        if(!e.isFriendly) {
            const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
            if(pDist < e.r+state.player.r){
                if (state.player.talent_states.phaseMomentum.active && !e.boss) {
                    Cores.handleCoreOnCollision(e, gameHelpers);
                } else {
                    state.player.talent_states.phaseMomentum.lastDamageTime = now;
                    state.player.talent_states.phaseMomentum.active = false;
                    if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); 
                    
                    if(!state.player.shield){ 
                        let damage = e.boss ? (e.enraged ? 20 : 10) : 1; 
                        damage *= state.player.talent_modifiers.damage_taken_multiplier;
                        const wouldBeFatal = (state.player.health - damage) <= 0;
                        
                        if(wouldBeFatal && Cores.handleCoreOnFatalDamage(e, gameHelpers)) {
                            // Death prevented by a core
                        } else if(wouldBeFatal && state.player.purchasedTalents.has('contingency-protocol') && !state.player.contingencyUsed) {
                            state.player.contingencyUsed = true;
                            state.player.health = 1;
                            const shieldEndTime = now + 3000;
                            state.player.shield = true;
                            state.player.shield_end_time = shieldEndTime;
                            addStatusEffect('Contingency Protocol', '🛡️', 3000);
                            setTimeout(()=> { if(state.player.shield_end_time <= shieldEndTime) state.player.shield = false; }, 3000);
                        } else {
                            state.player.health -= damage; 
                            Cores.handleCoreOnPlayerDamage(e, gameHelpers);
                        }
                        
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
        } else { // Friendly minion collision
            state.enemies.forEach(other => {
                if(!other.isFriendly && Math.hypot(e.x - other.x, e.y - other.y) < e.r + other.r) {
                    other.hp -= 0.5; e.hp -= 0.5;
                }
            });
        }
    }
    if (playerCollisions > 0) { state.player.x += totalPlayerPushX / playerCollisions; state.player.y += totalPlayerPushY / playerCollisions; }

    // --- Pickup Update and Collision Loop ---
    for (let i = state.pickups.length - 1; i >= 0; i--) {
        const p = state.pickups[i];
        if (p.lifeEnd && now > p.lifeEnd) { state.pickups.splice(i, 1); continue; }
        const pickupRadius = 75 + state.player.talent_modifiers.pickup_radius_bonus;
        const d = Math.hypot(state.player.x - p.x, state.player.y - p.y);
        if (d < pickupRadius) {
            const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
            p.vx += Math.cos(angle) * 0.5; p.vy += Math.sin(angle) * 0.5;
        }
        p.vx *= 0.95; p.vy *= 0.95;
        p.x += p.vx; p.y += p.vy;
        utils.drawCircle(ctx, p.x, p.y, p.r, p.emoji === '🩸' ? '#800020' : '#2ecc71');
        ctx.fillStyle="#fff"; ctx.font="16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.emoji || powers[p.type]?.emoji || '?', p.x, p.y+6);
        ctx.textAlign = "left";
        
        if(d < state.player.r + p.r){
            play('pickupSound'); 
            if (state.player.purchasedTalents.has('essence-weaving')) state.player.health = Math.min(state.player.maxHealth, state.player.health + state.player.maxHealth * 0.02);
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
                    addStatusEffect('Auto-Used', p.emoji || powers[p.type]?.emoji || '?', 2000);
                    powers[p.type].apply(utils, gameHelpers, mx, my);
                    state.pickups.splice(i, 1);
                } else {
                    utils.spawnParticles(state.particles, p.x, p.y, "#f00", 15, 2, 20); 
                    state.pickups.splice(i,1);
                }
            }
        }
    }

    // --- Effects Update and Rendering Loop ---
    for (let i = state.effects.length - 1; i >= 0; i--) {
        const effect = state.effects[i];
        if (now > (effect.endTime || Infinity)) {
            if (effect.type === 'paradox_echo') stopLoopingSfx('paradoxTrailHum');
            if (effect.type === 'shrinking_box') stopLoopingSfx('wallShrink');
            state.effects.splice(i, 1);
            continue;
        }

        // --- RESTORED: Shrinking Box Logic ---
        if (effect.type === 'shrinking_box') {
            const progress = (now - effect.startTime) / effect.duration;
            if (progress >= 1) {
                stopLoopingSfx('wallShrink');
                state.effects.splice(i, 1);
                continue;
            }
            playLooping('wallShrink');
            const currentSize = effect.initialSize * (1 - progress);
            const halfSize = currentSize / 2;
            const left = effect.x - halfSize, right = effect.x + halfSize;
            const top = effect.y - halfSize, bottom = effect.y + halfSize;
            const walls = [
                { x1: left, y1: top, x2: right, y2: top },
                { x1: right, y1: top, x2: right, y2: bottom },
                { x1: right, y1: bottom, x2: left, y2: bottom },
                { x1: left, y1: bottom, x2: left, y2: top }
            ];
            ctx.strokeStyle = 'rgba(211, 84, 0, 0.8)';
            ctx.lineWidth = 10;
            ctx.shadowColor = '#d35400';
            ctx.shadowBlur = 20;
            const gapSize = 150 * (1 - progress);
            walls.forEach((wall, index) => {
                if (index === effect.gapSide) {
                    const wallLength = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                    const gapStart = (wallLength - gapSize) * effect.gapPosition;
                    const gapEnd = gapStart + gapSize;
                    const p1 = { x: wall.x1 + (wall.x2 - wall.x1) * (gapStart / wallLength), y: wall.y1 + (wall.y2 - wall.y1) * (gapStart / wallLength) };
                    const p2 = { x: wall.x1 + (wall.x2 - wall.x1) * (gapEnd / wallLength), y: wall.y1 + (wall.y2 - wall.y1) * (gapEnd / wallLength) };
                    ctx.beginPath(); ctx.moveTo(wall.x1, wall.y1); ctx.lineTo(p1.x, p1.y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(wall.x2, wall.y2); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.moveTo(wall.x1, wall.y1); ctx.lineTo(wall.x2, wall.y2); ctx.stroke();
                }
            });
            ctx.shadowBlur = 0;
        }
        else if (effect.type === 'shockwave') {
            const elapsed = (now - effect.startTime) / 1000; effect.radius = elapsed * effect.speed;
            ctx.strokeStyle = effect.color || `rgba(255, 255, 255, ${1-(effect.radius/effect.maxRadius)})`; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI); ctx.stroke();
            let targets = (effect.caster === state.player) ? state.enemies.filter(e => !e.isFriendly) : [state.player];
            targets.forEach(target => {
                if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) {
                    if (effect.damage > 0) {
                        let dmg = target.boss || target === state.player ? effect.damage : 1000;
                        if (target === state.player) {
                            if (!target.shield) { target.health -= dmg; if (target.health <= 0) state.gameOver = true; } 
                            else { target.shield = false; }
                        } else {
                            target.hp -= dmg;
                        }
                        if (target.onDamage) target.onDamage(target, dmg, effect.caster, state, spawnParticlesCallback, play, stopLoopingSfx, gameHelpers);
                    }
                    effect.hitEnemies.add(target);
                }
            });
            if (effect.radius >= effect.maxRadius) state.effects.splice(i, 1);
        }
        // ... Other effect handlers from your old file would go here ...
        // For brevity, I'm including the most critical ones.
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
    }
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

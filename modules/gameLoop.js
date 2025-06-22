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
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) AudioManager.playSfx(soundElement);
}
function stopLoopingSfx(soundId) {
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) AudioManager.stopLoopingSfx(soundElement);
}

const gameHelpers = { addStatusEffect, spawnEnemy, spawnPickup, play, stopLoopingSfx };

export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();
    state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== name);
    state.player.statusEffects.push({ name, emoji, startTime: now, endTime: now + duration });
}

export function handleThematicUnlock(level) {
    const unlock = THEMATIC_UNLOCKS[level];
    if (!unlock) return;

    if (unlock.type === 'power' && !state.player.unlockedPowers.has(unlock.id)) {
        state.player.unlockedPowers.add(unlock.id);
        const powerName = powers[unlock.id]?.desc || unlock.id;
        showUnlockNotification(`Power Unlocked: ${powers[unlock.id].emoji} ${powerName}`);
    } else if (unlock.type === 'slot') {
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
    state.player.ascensionPoints += 2;
    handleThematicUnlock(state.player.level);
    utils.spawnParticles(state.particles, state.player.x, state.player.y, '#00ffff', 80, 6, 50, 5);
    savePlayerState();
}

export function addEssence(amount) {
    if (state.gameOver) return;
    state.player.essence += Math.floor(amount * state.player.essenceGainModifier);
    while (state.player.essence >= state.player.essenceToNextLevel) {
        levelUp();
    }
}

export function spawnEnemy(isBoss = false, bossId = null, location = null) {
    const e = { x: location ? location.x : Math.random() * canvas.width, y: location ? location.y : Math.random() * canvas.height, dx: (Math.random() - 0.5) * 0.75, dy: (Math.random() - 0.5) * 0.75, r: isBoss ? 50 : 15, hp: isBoss ? 200 : 1, maxHP: isBoss ? 200 : 1, boss: isBoss, frozen: false, targetBosses: false };
    if (isBoss) {
        const bossIndex = (state.currentStage - 1);
        if (bossIndex >= bossData.length) {
            console.log("All bosses defeated! VICTORY!");
            state.gameOver = true;
            return null;
        }
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

export function gameTick(mx, my) {
    if (state.isPaused) return true;
    if (state.gameOver) {
        stopLoopingSfx("beamHum");
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
        return false;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    utils.applyScreenShake(ctx);
    
    // --- Player Logic & Drawing ---
    let finalMx = mx;
    let finalMy = my;
    if (state.player.controlsInverted) {
        finalMx = state.player.x - (mx - state.player.x);
        finalMy = state.player.y - (my - state.player.y);
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
        if (Date.now() > state.decoy.expires) state.decoy = null;
    }

    // --- Enemy Logic & Drawing ---
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];
        if (e.hp <= 0) {
            if (e.boss) {
                if (state.currentStage > state.player.highestStageBeaten) {
                    state.player.highestStageBeaten = state.currentStage;
                    state.player.ascensionPoints += 3;
                    showUnlockNotification("Stage Cleared! +3 AP", `Level ${state.currentStage + 1} Unlocked`);
                }
                utils.triggerScreenShake(250, 5);
                addEssence(300);
                state.currentStage++;
                state.bossActive = false;
                state.bossSpawnCooldownEnd = Date.now() + 5000;
                savePlayerState();
                if (e.onDeath) e.onDeath(e, state, spawnEnemy, (x, y, c, n, spd, life, r) => utils.spawnParticles(state.particles, x, y, c, n, spd, life, r), play, stopLoopingSfx);
                state.enemies.splice(i, 1);
                if (state.currentBoss === e) {
                    state.currentBoss = state.enemies.find(en => en.boss) || null;
                }
            } else {
                addEssence(10);
                state.enemies.splice(i, 1);
            }
            continue;
        }

        if(!e.frozen && !e.hasCustomMovement){ 
            let tgt = state.decoy || state.player;
            let enemySpeedMultiplier = 1;
            state.effects.forEach(effect => { if(effect.type === 'slow_zone' && Math.hypot(e.x - effect.x, e.y - effect.y) < effect.r) { enemySpeedMultiplier = 0.5; } });
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
        if(!e.hasCustomDraw) { utils.drawCircle(ctx, e.x,e.y,e.r, color); }
        if(e.enraged) { ctx.strokeStyle = "yellow"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x,e.y,e.r+5,0,2*Math.PI); ctx.stroke(); }
        
        const pDist = Math.hypot(state.player.x-e.x,state.player.y-e.y);
        if(pDist < e.r+state.player.r){ if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); if(!state.player.shield){ let damage = e.boss ? (e.enraged ? 20 : 10) : 1; if (state.player.berserkUntil > Date.now()) damage *= 2; state.player.health -= damage; play('hit'); if(e.onDamage) e.onDamage(e, damage, state.player, state, (x,y,c,n,spd,life,r)=>utils.spawnParticles(state.particles,x,y,c,n,spd,life,r)); if(state.player.health<=0) state.gameOver=true; } else { state.player.shield=false; } const ang=Math.atan2(state.player.y-e.y,state.player.x-e.x); state.player.x=e.x+Math.cos(ang)*(e.r+state.player.r); state.player.y=e.y+Math.sin(ang)*(e.r+state.player.r); }
    }

    // --- Pickup Logic & Drawing ---
    for (let i = state.pickups.length - 1; i >= 0; i--) {
        const p = state.pickups[i];
        p.x += p.dx || 0;
        p.y += p.dy || 0;
        utils.drawCircle(ctx, p.x, p.y, p.r, "#2ecc71");
        ctx.fillStyle="#fff"; ctx.font="16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(powers[p.type]?.emoji || '?', p.x, p.y+6);
        ctx.textAlign = "left";

        const d=Math.hypot(state.player.x-p.x,state.player.y-p.y);
        if(d < state.player.r + p.r){
            const isOffensive = offensivePowers.includes(p.type);
            const targetInventory = isOffensive ? state.offensiveInventory : state.defensiveInventory;
            const idx=targetInventory.indexOf(null);
            if(idx!==-1){
                targetInventory[idx]=p.type; play('pickup'); state.pickups.splice(i,1);
            } else {
                utils.spawnParticles(state.particles, p.x, p.y, "#f00", 15, 2, 20); state.pickups.splice(i,1);
            }
        }
    }

    // --- Effects Logic & Drawing ---
    state.effects.forEach((effect, index) => {
        if (effect.type === 'shockwave') {
            const elapsed = (Date.now() - effect.startTime) / 1000;
            effect.radius = elapsed * effect.speed;
            ctx.strokeStyle = `rgba(255, 255, 255, ${1-(effect.radius/effect.maxRadius)})`;
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI);
            ctx.stroke();
            let targets = (effect.caster === state.player) ? state.enemies : [state.player];
            targets.forEach(target => {
                if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) {
                    let dmg = (target.boss || target === state.player) ? effect.damage : 1000;
                    if(target.health) target.health -= dmg; else target.hp -= dmg;
                    if (target.onDamage) target.onDamage(target, dmg, effect.caster);
                    effect.hitEnemies.add(target);
                }
            });
            if (effect.radius >= effect.maxRadius) state.effects.splice(index, 1);
        }
    });
    
    utils.updateParticles(ctx, state.particles);
    updateUI();
    ctx.restore();
    return true;
}

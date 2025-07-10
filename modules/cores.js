// modules/cores.js
import { state } from './state.js';
import * as utils from './utils.js';
import { bossData } from './bosses.js';
import { showUnlockNotification } from './ui.js';

/**
 * Standardized function to get the currently active core ID, accounting for Pantheon.
 * @returns {string|null} The ID of the core whose logic should be executed.
 */
function getActiveCoreId() {
    let coreId = state.player.equippedAberrationCore;
    if (coreId === 'pantheon') {
        return state.player.talent_states.core_states.pantheon.activeCore || null;
    }
    return coreId;
}

/**
 * Applies passive, per-tick effects for equipped Aberration Cores.
 */
export function applyCoreTickEffects(gameHelpers) {
    const now = Date.now();
    const { play } = gameHelpers;
    const ctx = document.getElementById("gameCanvas").getContext("2d");

    let equippedCoreId = state.player.equippedAberrationCore;

    // Handle Pantheon Core's aspect shifting separately first
    if (equippedCoreId === 'pantheon') {
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
    }
    
    const activeCoreId = getActiveCoreId();

    if (activeCoreId) {
        switch (activeCoreId) {
            case 'vampire':
                if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 5000) {
                    state.player.health = Math.min(state.player.maxHealth, state.player.health + (1 / 60));
                }
                break;
            case 'gravity':
                if (now > (state.player.talent_states.core_states.gravity?.lastPulseTime || 0) + 10000) {
                    if (!state.player.talent_states.core_states.gravity) state.player.talent_states.core_states.gravity = {};
                    state.player.talent_states.core_states.gravity.lastPulseTime = now;
                    state.effects.push({ type: 'player_pull_pulse', x: state.player.x, y: state.player.y, maxRadius: 600, startTime: now, duration: 250 });
                    play('gravitySound');
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
                        { x: state.player.x - 100, y: state.player.y },
                        { x: state.player.x + 100, y: state.player.y },
                        { x: state.player.x, y: state.player.y - 100 },
                        { x: state.player.x, y: state.player.y + 100 },
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
                    if (!state.player.talent_states.core_states.helix_weaver) state.player.talent_states.core_states.helix_weaver = {};
                    state.player.talent_states.core_states.helix_weaver.lastBolt = now;
                    state.effects.push({ type: 'helix_bolt', x: state.player.x, y: state.player.y, r: 8, speed: 2, angle: Math.random() * 2 * Math.PI, lifeEnd: now + 10000, caster: state.player });
                }
                break;
        }
    }
}

export function handleCoreOnEnemyDeath(enemy, gameHelpers) {
    const now = Date.now();
    const { spawnEnemy } = gameHelpers;
    const activeCoreId = getActiveCoreId();

    if (!activeCoreId || enemy.isFriendly) return;

    switch (activeCoreId) {
        case 'splitter':
            if (!enemy.boss && now > (state.player.talent_states.core_states.splitter.cooldownUntil || 0)) {
                state.player.talent_states.core_states.splitter.cooldownUntil = now + 500;
                for (let i = 0; i < 3; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    state.effects.push({
                        type: 'seeking_shrapnel',
                        x: enemy.x,
                        y: enemy.y,
                        dx: Math.cos(angle) * 4,
                        dy: Math.sin(angle) * 4,
                        r: 7,
                        speed: 5,
                        damage: 8 * state.player.talent_modifiers.damage_multiplier,
                        life: 3000,
                        startTime: now,
                        targetIndex: i
                    });
                }
            }
            break;
        case 'swarm_link':
            state.player.talent_states.core_states.swarm_link.enemiesForNextSegment++;
            if (state.player.talent_states.core_states.swarm_link.enemiesForNextSegment >= 2 && state.player.talent_states.core_states.swarm_link.tail.length < 50) {
                state.player.talent_states.core_states.swarm_link.enemiesForNextSegment = 0;
                const lastSegment = state.player.talent_states.core_states.swarm_link.tail.length > 0 ? state.player.talent_states.core_states.swarm_link.tail[state.player.talent_states.core_states.swarm_link.tail.length - 1] : state.player;
                state.player.talent_states.core_states.swarm_link.tail.push({ x: lastSegment.x, y: lastSegment.y });
            }
            break;
        case 'fractal_horror':
            if (!state.player.talent_states.core_states.fractal_horror) state.player.talent_states.core_states.fractal_horror = { killCount: 0 };
            state.player.talent_states.core_states.fractal_horror.killCount++;
            if (state.player.talent_states.core_states.fractal_horror.killCount >= 10) {
                state.player.talent_states.core_states.fractal_horror.killCount = 0;
                for (let k = 0; k < 3; k++) {
                    const bit = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
                    if (bit) {
                        bit.isFriendly = true; bit.customColor = '#be2edd'; bit.r = 8; bit.hp = 5; bit.lifeEnd = now + 8000;
                    }
                }
            }
            break;
        case 'parasite':
            if (enemy.isInfected) {
                const spore = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
                if (spore) {
                    spore.isFriendly = true;
                    spore.customColor = '#55efc4';
                    spore.r = 8;
                    spore.hp = 5;
                    spore.lifeEnd = now + 8000;
                }
            }
            break;
    }
}

export function handleCoreOnPlayerDamage(enemy, gameHelpers) {
    const now = Date.now();
    const activeCoreId = getActiveCoreId();

    if (!activeCoreId) return;

    switch (activeCoreId) {
        case 'mirror_mirage':
            if (now > (state.player.talent_states.core_states.mirror_mirage.cooldownUntil || 0)) {
                state.player.talent_states.core_states.mirror_mirage.cooldownUntil = now + 12000;
                state.decoy = { x: state.player.x, y: state.player.y, r: 20, expires: now + 3000, isTaunting: true, isMobile: false };
            }
            break;
        case 'glitch':
            if (Math.random() < 0.25) {
                state.effects.push({ type: 'glitch_zone', x: enemy.x, y: enemy.y, r: 100, endTime: now + 4000 });
            }
            break;
    }
}

export function handleCoreOnCollision(enemy, gameHelpers) {
    const now = Date.now();
    const activeCoreId = getActiveCoreId();

    if (!activeCoreId || enemy.isFriendly) return;

    switch (activeCoreId) {
        case 'parasite':
             if (state.player.talent_states.phaseMomentum.active && !enemy.boss) {
                enemy.isInfected = true;
                enemy.infectionEnd = now + 10000;
             }
            break;
        case 'juggernaut':
            const juggernautState = state.player.talent_states.core_states.juggernaut;
            if (juggernautState.isCharging && !enemy.boss) {
                enemy.hp = 0;
                state.effects.push({ type: 'shockwave', caster: state.player, x: enemy.x, y: enemy.y, radius: 0, maxRadius: 120, speed: 600, startTime: now, hitEnemies: new Set(), damage: 10, color: 'rgba(99, 110, 114, 0.7)' });
                juggernautState.isCharging = false;
                juggernautState.lastMoveTime = 0;
            }
            break;
    }
}

export function handleCoreOnShieldBreak() {
    const activeCoreId = getActiveCoreId();
    if (activeCoreId === 'emp') {
        state.effects = state.effects.filter(ef => ef.type !== 'nova_bullet' && ef.type !== 'ricochet_projectile' && ef.type !== 'seeking_shrapnel');
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#3498db', 50, 4, 30);
    }
}

export function handleCoreOnFatalDamage(enemy, gameHelpers) {
    const now = Date.now();
    const activeCoreId = getActiveCoreId();

    if (activeCoreId === 'epoch_ender' && enemy.boss && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
        const history = state.player.talent_states.core_states.epoch_ender.history;
        const rewindState = history[0];
        if (rewindState) {
            state.player.x = rewindState.x;
            state.player.y = rewindState.y;
            state.player.health = rewindState.health;
            state.player.talent_states.core_states.epoch_ender.cooldownUntil = now + 120000;
            gameHelpers.play('timeRewind');
            return true;
        }
    }
    return false;
}

export function handleCoreOnPickup(gameHelpers) {
    const { addStatusEffect } = gameHelpers;
    const activeCoreId = getActiveCoreId();

    if (activeCoreId === 'obelisk') {
        const currentCharges = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
        if (!currentCharges || currentCharges.count < 3) {
            addStatusEffect('Conduit Charge', '⚡', 99999);
        }
    }
}

export function handleCoreOnEmptySlot(mx, my, gameHelpers) {
    const activeCoreId = getActiveCoreId();
    if (activeCoreId === 'syphon' && state.player.talent_states.core_states.syphon.canUse) {
        gameHelpers.play('syphonFire');
        const angle = Math.atan2(my - state.player.y, mx - state.player.x);
        state.effects.push({
            type: 'syphon_cone',
            source: state.player,
            angle: angle,
            endTime: Date.now() + 500,
            isPlayer: true
        });
        state.player.talent_states.core_states.syphon.canUse = false;
        return true;
    }
    return false;
}

export function handleCoreOnDefensivePower(mx, my, gameHelpers) {
     const { play } = gameHelpers;
     const activeCoreId = getActiveCoreId();

     if (activeCoreId === 'looping_eye') {
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
}

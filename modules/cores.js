// modules/cores.js
import { state } from './state.js';
import * as utils from './utils.js';
import { bossData } from './bosses.js';
import { showUnlockNotification } from './ui.js';

/**
 * Applies passive, per-tick effects for equipped Aberration Cores.
 * @param {object} gameHelpers - An object containing helper functions like play, spawnEnemy, etc.
 */
export function applyCoreTickEffects(gameHelpers) {
    const now = Date.now();
    const { play } = gameHelpers;
    const ctx = document.getElementById("gameCanvas").getContext("2d");

    let coreId = state.player.equippedAberrationCore;

    // Handle Pantheon Core's aspect shifting
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
        switch (coreId) {
            case 'vampire':
                if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 5000) {
                    state.player.health = Math.min(state.player.maxHealth, state.player.health + (1 / 60));
                }
                break;
            case 'gravity':
                if (now > (state.player.talent_states.core_states.gravity?.lastPulseTime || 0) + 10000) {
                    if (!state.player.talent_states.core_states.gravity) state.player.talent_states.core_states.gravity = {};
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

/**
 * Applies Core effects that trigger when an enemy is defeated.
 * @param {object} enemy - The enemy that was just defeated.
 * @param {object} gameHelpers - An object containing helper functions like play, spawnEnemy, etc.
 */
export function handleCoreOnEnemyDeath(enemy, gameHelpers) {
    const now = Date.now();
    const { spawnEnemy } = gameHelpers;
    const coreId = state.player.equippedAberrationCore;

    if (!coreId || enemy.isFriendly) return;

    switch (coreId) {
        case 'splitter':
            if (enemy.boss) { // On boss death
                for (let wave = 0; wave < 2; wave++) {
                    setTimeout(() => {
                        for (let j = 0; j < 3; j++) {
                            const minion = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
                            if (minion) {
                                minion.isFriendly = true;
                                minion.customColor = '#ffaa00';
                                minion.hp = 10;
                                minion.lifeEnd = now + 10000;
                            }
                        }
                    }, wave * 1000);
                }
            } else { // On normal enemy death
                if (now > (state.player.talent_states.core_states.splitter.cooldownUntil || 0)) {
                    state.player.talent_states.core_states.splitter.cooldownUntil = now + 20000;
                    const minion = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
                    if (minion) {
                        minion.isFriendly = true;
                        minion.customColor = '#ffaa00';
                        minion.hp = 10;
                        minion.lifeEnd = now + 10000;
                    }
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

/**
 * Applies Core effects that trigger when the player takes damage.
 * @param {object} enemy - The enemy that damaged the player.
 * @param {object} gameHelpers - An object containing helper functions.
 */
export function handleCoreOnPlayerDamage(enemy, gameHelpers) {
    const now = Date.now();
    const { play } = gameHelpers;
    const coreId = state.player.equippedAberrationCore;

    if (!coreId) return;

    switch (coreId) {
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

/**
 * Applies Core effects that trigger when the player collides with an enemy.
 * @param {object} enemy - The enemy the player collided with.
 * @param {object} gameHelpers - An object containing helper functions.
 */
export function handleCoreOnCollision(enemy, gameHelpers) {
    const now = Date.now();
    const coreId = state.player.equippedAberrationCore;

    if (!coreId || enemy.isFriendly) return;

    switch (coreId) {
        case 'parasite':
             if (state.player.talent_states.phaseMomentum.active && !enemy.boss) {
                enemy.isInfected = true;
                enemy.infectionEnd = now + 10000;
             }
            break;
    }
}

/**
 * Applies Core effects that trigger when the player's shield breaks.
 */
export function handleCoreOnShieldBreak() {
    const coreId = state.player.equippedAberrationCore;
    if (coreId === 'emp') {
        state.effects = state.effects.filter(ef => ef.type !== 'nova_bullet' && ef.type !== 'ricochet_projectile' && ef.type !== 'seeking_shrapnel');
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#3498db', 50, 4, 30);
    }
}


/**
 * Applies Core effects that trigger when the player would take fatal damage.
 * @param {object} enemy - The enemy dealing the damage.
 * @param {object} gameHelpers - An object containing helper functions.
 * @returns {boolean} - True if the death was prevented, otherwise false.
 */
export function handleCoreOnFatalDamage(enemy, gameHelpers) {
    const now = Date.now();
    const coreId = state.player.equippedAberrationCore;

    if (coreId === 'epoch_ender' && enemy.boss && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
        const history = state.player.talent_states.core_states.epoch_ender.history;
        const rewindState = history[0];
        if (rewindState) {
            state.player.x = rewindState.x;
            state.player.y = rewindState.y;
            state.player.health = rewindState.health;
            state.player.talent_states.core_states.epoch_ender.cooldownUntil = now + 120000; // 2 min cooldown
            gameHelpers.play('timeRewind');
            return true; // Death was prevented
        }
    }
    return false; // Death was not prevented
}

/**
 * Applies Core effects when a power-up is collected.
 * @param {object} gameHelpers - An object containing helper functions.
 */
export function handleCoreOnPickup(gameHelpers) {
    const { addStatusEffect } = gameHelpers;
    const coreId = state.player.equippedAberrationCore;

    if (coreId === 'obelisk') {
        const currentCharges = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
        if (!currentCharges || currentCharges.count < 3) {
            addStatusEffect('Conduit Charge', '⚡', 99999);
        }
    }
}

/**
 * Handles core logic for using an empty ability slot.
 * @param {number} mx - mouse x
 * @param {number} my - mouse y
 * @param {object} gameHelpers - An object containing helper functions.
 * @returns {boolean} - True if a core action was taken.
 */
export function handleCoreOnEmptySlot(mx, my, gameHelpers) {
    const coreId = state.player.equippedAberrationCore;
    if (coreId === 'syphon' && state.player.talent_states.core_states.syphon.canUse) {
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

/**
 * Handles core logic when a defensive power is used.
 * @param {number} mx - mouse x
 * @param {number} my - mouse y
 * @param {object} gameHelpers - An object containing helper functions.
 */
export function handleCoreOnDefensivePower(mx, my, gameHelpers) {
     const { play } = gameHelpers;
     const coreId = state.player.equippedAberrationCore;

     if (coreId === 'looping_eye') {
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

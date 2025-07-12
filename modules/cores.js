// modules/cores.js
import { state } from './state.js';
import * as utils from './utils.js';
import { bossData } from './bosses.js';
import { showUnlockNotification } from './ui.js';
import { usePower } from './powers.js';

// Helper function to check for core presence (equipped or via Pantheon)
export function playerHasCore(coreId) {
    if (state.player.equippedAberrationCore === coreId) return true;
    return state.player.activePantheonBuffs.some(buff => buff.coreId === coreId);
}

// NEW: Master function to activate core powers on LMB+RMB click
export function activateCorePower(mx, my, gameHelpers) {
    const now = Date.now();
    const coreId = state.player.equippedAberrationCore;
    if (!coreId) return;

    const coreState = state.player.talent_states.core_states[coreId];
    if (!coreState || now < (coreState.cooldownUntil || 0)) {
        gameHelpers.play('talentError');
        return; // On cooldown
    }

    let abilityTriggered = false;

    // This acts as a router for all core active abilities
    switch (coreId) {
        case 'juggernaut':
            coreState.cooldownUntil = now + 8000;
            const angle = Math.atan2(my - state.player.y, mx - state.player.x);
            state.effects.push({ type: 'juggernaut_player_charge', startTime: now, duration: 700, angle: angle, hitEnemies: new Set() });
            gameHelpers.play('chargeDashSound');
            abilityTriggered = true;
            break;
        
        case 'syphon':
            coreState.cooldownUntil = now + 5000;
            gameHelpers.play('syphonFire');
            const syphonAngle = Math.atan2(my - state.player.y, mx - state.player.x);
            state.effects.push({ type: 'syphon_cone', startTime: now, duration: 1500, angle: syphonAngle, source: state.player });
            abilityTriggered = true;
            break;

        case 'gravity':
            coreState.cooldownUntil = now + 6000;
            state.effects.push({ type: 'player_pull_pulse', x: state.player.x, y: state.player.y, maxRadius: 600, startTime: now, duration: 500 });
            gameHelpers.play('gravitySound');
            abilityTriggered = true;
            break;
            
        case 'architect':
            coreState.cooldownUntil = now + 15000;
            gameHelpers.play('architectBuild');
            const ringRadius = 150;
            const pillarCount = 4;
            for (let i = 0; i < pillarCount; i++) {
                const pAngle = (i / pillarCount) * 2 * Math.PI;
                state.effects.push({ type: 'architect_pillar', x: state.player.x + ringRadius * Math.cos(pAngle), y: state.player.y + ringRadius * Math.sin(pAngle), r: 20, endTime: now + 10000 });
            }
            abilityTriggered = true;
            break;

        case 'annihilator':
            coreState.cooldownUntil = now + 25000;
            state.effects.push({ type: 'player_annihilation_beam', startTime: now, endTime: now + 4000 });
            gameHelpers.play('powerSirenSound');
            abilityTriggered = true;
            break;

        default:
            // Core has no active ability on this trigger
            break;
    }

    if (abilityTriggered) {
        // This makes sure the cooldown UI updates instantly
        updateUI();
    }
}


/**
 * Applies passive, per-tick effects for equipped Aberration Cores.
 */
export function applyCoreTickEffects(gameHelpers) {
    const now = Date.now();
    const { play } = gameHelpers;
    const ctx = document.getElementById("gameCanvas").getContext("2d");

    // --- PANTHEON CORE LOGIC ---
    if (state.player.equippedAberrationCore === 'pantheon') {
        const pantheonState = state.player.talent_states.core_states.pantheon;
        if (now > (pantheonState.lastCycleTime || 0) + 10000) {
            pantheonState.lastCycleTime = now;
            
            const unlockedCores = Array.from(state.player.unlockedAberrationCores);
            const activeBuffIds = state.player.activePantheonBuffs.map(b => b.coreId);
            const availablePool = unlockedCores.filter(id => id !== 'pantheon' && !activeBuffIds.includes(id));

            if (availablePool.length > 0) {
                const newCoreId = availablePool[Math.floor(Math.random() * availablePool.length)];
                const coreData = bossData.find(b => b.id === newCoreId);
                
                state.player.activePantheonBuffs.push({
                    coreId: newCoreId,
                    endTime: now + 30000
                });

                showUnlockNotification(`Pantheon Attuned: ${coreData.name}`, 'Aspect Gained');
                play('shaperAttune');
            }
        }
    }
    state.player.activePantheonBuffs = state.player.activePantheonBuffs.filter(buff => now < buff.endTime);


    // --- INDIVIDUAL CORE TICK LOGIC ---

    if (playerHasCore('vampire')) {
        if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 5000) {
            if (state.player.health < state.player.maxHealth) {
                 state.player.health = Math.min(state.player.maxHealth, state.player.health + (1 / 60));
            }
        }
    }

    if (playerHasCore('swarm_link')) {
        const swarmState = state.player.talent_states.core_states.swarm_link;
        let prev = state.player;
        swarmState.tail.forEach(c => {
            c.x += (prev.x - c.x) * 0.2;
            c.y += (prev.y - c.y) * 0.2;
            const segmentRadius = 6 + Math.sin(now / 200);
            utils.drawCircle(ctx, c.x, c.y, segmentRadius, "orange"); 
            utils.spawnParticles(state.particles, c.x, c.y, 'rgba(255, 165, 0, 0.5)', 1, 0.5, 10, 2);
            prev = c;
            state.enemies.forEach(e => {
                if (!e.isFriendly && Math.hypot(e.x - c.x, e.y - c.y) < e.r + segmentRadius) {
                    e.hp -= 0.2 * state.player.talent_modifiers.damage_multiplier;
                }
            });
        });
    }
    
    if (playerHasCore('miasma')) {
        const miasmaState = state.player.talent_states.core_states.miasma;
        const moveDist = Math.hypot(window.mousePosition.x - state.player.x, window.mousePosition.y - state.player.y);

        if (moveDist < state.player.r) {
            if (!miasmaState.stillStartTime) {
                 miasmaState.stillStartTime = now;
            }
            if (now - miasmaState.stillStartTime > 3000 && !miasmaState.isPurifying) {
                miasmaState.isPurifying = true;
                play('ventPurify');
            }
        } else {
            miasmaState.stillStartTime = null;
            miasmaState.isPurifying = false;
        }

        if (miasmaState.isPurifying && state.player.health < state.player.maxHealth) {
            state.player.health = Math.min(state.player.maxHealth, state.player.health + (1 / 60));
        }
    }
    
    if (playerHasCore('puppeteer')) {
        const puppeteerState = state.player.talent_states.core_states.puppeteer;
        if (now > (puppeteerState.lastConversion || 0) + 8000) {
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
                puppeteerState.lastConversion = now;
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
    }
    
    if (playerHasCore('helix_weaver')) {
        const helixState = state.player.talent_states.core_states.helix_weaver;
        if (now > (helixState.lastBolt || 0) + 5000) {
            helixState.lastBolt = now;
            state.effects.push({ type: 'helix_bolt', x: state.player.x, y: state.player.y, r: 8, speed: 2, angle: Math.random() * 2 * Math.PI, lifeEnd: now + 10000, caster: state.player });
            play('weaverCast');
        }
    }
}

export function handleCoreOnEnemyDeath(enemy, gameHelpers) {
    const now = Date.now();
    const { spawnEnemy } = gameHelpers;

    if (enemy.isFriendly) return;

    if (playerHasCore('splitter')) {
        const splitterState = state.player.talent_states.core_states.splitter;
        if (!enemy.boss && now > (splitterState.cooldownUntil || 0)) {
            splitterState.cooldownUntil = now + 500;
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                state.effects.push({
                    type: 'player_fragment',
                    x: enemy.x, y: enemy.y, dx: Math.cos(angle) * 4, dy: Math.sin(angle) * 4,
                    r: 10, speed: 5, damage: 8 * state.player.talent_modifiers.damage_multiplier,
                    life: 4000, startTime: now, targetIndex: i
                });
            }
            gameHelpers.play('splitterOnDeath');
        }
    }
    
    if (playerHasCore('swarm_link')) {
        const swarmState = state.player.talent_states.core_states.swarm_link;
        swarmState.enemiesForNextSegment = (swarmState.enemiesForNextSegment || 0) + 1;
        if (swarmState.enemiesForNextSegment >= 2 && swarmState.tail.length < 50) {
            swarmState.enemiesForNextSegment = 0;
            const lastSegment = swarmState.tail.length > 0 ? swarmState.tail[swarmState.tail.length - 1] : state.player;
            swarmState.tail.push({ x: lastSegment.x, y: lastSegment.y });
        }
    }
    
    if (playerHasCore('fractal_horror')) {
        const fractalState = state.player.talent_states.core_states.fractal_horror;
        fractalState.killCount = (fractalState.killCount || 0) + 1;
        if (fractalState.killCount >= 10) {
            fractalState.killCount = 0;
            gameHelpers.play('fractalSplit');
            for (let k = 0; k < 3; k++) {
                const bit = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
                if (bit) {
                    bit.isFriendly = true; bit.customColor = '#be2edd'; bit.r = 8; bit.hp = 5; bit.lifeEnd = now + 8000;
                }
            }
        }
    }
    
    if (playerHasCore('parasite')) {
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
    }
}

export function handleCoreOnPlayerDamage(damage, enemy, gameHelpers) {
    const now = Date.now();
    let damageTaken = damage;

    if (playerHasCore('obelisk')) {
        const conduitCharge = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
        if (conduitCharge && conduitCharge.count > 0) {
            damageTaken = 0;
            conduitCharge.count--;
            if (conduitCharge.count <= 0) {
                state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== 'Conduit Charge');
            }
            gameHelpers.play('conduitShatter');
            state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 200, speed: 1000, startTime: now, hitEnemies: new Set(), damage: 0, color: 'rgba(44, 62, 80, 0.7)' });
        }
    }

    if (damageTaken > 0) {
        if (playerHasCore('mirror_mirage')) {
            const mirrorState = state.player.talent_states.core_states.mirror_mirage;
            if (now > (mirrorState.lastDecoyTime || 0)) {
                mirrorState.lastDecoyTime = now + 12000;
                state.decoys.push({ 
                    x: state.player.x, y: state.player.y, r: 20, 
                    expires: now + 3000,
                    isTaunting: true, isMobile: false, hp: 1
                });
                gameHelpers.play('mirrorSwap');
                utils.spawnParticles(state.particles, state.player.x, state.player.y, '#ff00ff', 40, 4);
            }
        }
        
        if (playerHasCore('glitch')) {
            if (Math.random() < 0.25) {
                state.effects.push({ type: 'glitch_zone', x: enemy.x, y: enemy.y, r: 100, endTime: now + 4000 });
                state.enemies.forEach(e => {
                    if(Math.hypot(e.x - enemy.x, e.y - enemy.y) < 100 && !e.boss) {
                        e.glitchedUntil = now + 3000;
                    }
                });
                gameHelpers.play('glitchSound');
            }
        }
    }
    
    return damageTaken;
}

export function handleCoreOnCollision(enemy, gameHelpers) {
    const now = Date.now();
    if (enemy.isFriendly) return;

    if (playerHasCore('parasite')) {
         if (state.player.talent_states.phaseMomentum.active && !enemy.boss && !enemy.isInfected) {
            enemy.isInfected = true;
            enemy.infectionEnd = now + 10000;
         }
    }
}

export function handleCoreOnDamageDealt(target) {
    if (playerHasCore('vampire') && Math.random() < 0.10) {
        state.pickups.push({
            x: target.x, y: target.y, r: 10, type: 'custom', emoji: '🩸',
            lifeEnd: Date.now() + 8000, vx: 0, vy: 0,
            isSeeking: true,
            customApply: () => {
                state.player.health = Math.min(state.player.maxHealth, state.player.health + (state.player.maxHealth * 0.02));
                utils.spawnParticles(state.particles, state.player.x, state.player.y, "#800020", 20, 3, 30);
                window.gameHelpers.play('vampireHeal');
            }
        });
    }

    if(playerHasCore('parasite') && !target.boss) {
        target.isInfected = true;
        target.infectionEnd = Date.now() + 10000;
    }
}

export function handleCoreOnShieldBreak() {
    if (playerHasCore('emp')) {
        state.effects = state.effects.filter(ef => 
            ef.type !== 'nova_bullet' && 
            ef.type !== 'helix_bolt'
        );
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#3498db', 50, 4, 30);
        window.gameHelpers.play('empDischarge');
    }
}

export function handleCoreOnFatalDamage(enemy, gameHelpers) {
    const now = Date.now();

    if (playerHasCore('epoch_ender') && enemy.boss && now > (state.player.talent_states.core_states.epoch_ender.cooldownUntil || 0)) {
        const history = state.player.talent_states.core_states.epoch_ender.history;
        const rewindState = history[0];
        if (rewindState) {
            state.player.x = rewindState.x;
            state.player.y = rewindState.y;
            state.player.health = rewindState.health;
            state.player.talent_states.core_states.epoch_ender.cooldownUntil = now + 120000;
            gameHelpers.play('timeRewind');
            utils.spawnParticles(state.particles, state.player.x, state.player.y, '#bdc3c7', 80, 6, 40);
            return true;
        }
    }
    return false;
}

export function handleCoreOnPickup(gameHelpers) {
    const { addStatusEffect } = gameHelpers;

    if (playerHasCore('obelisk')) {
        const existing = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
        if (!existing || existing.count < 3) {
            addStatusEffect('Conduit Charge', '⚡', 999999); 
        }
    }
}

export function handleCoreOnEmptySlot(mx, my, gameHelpers) {
    // This function is now deprecated in favor of activateCorePower.
    return false;
}

export function handleCoreOnDefensivePower(powerKey, mx, my, gameHelpers) {
    const { play, addStatusEffect } = gameHelpers;

    if (playerHasCore('reflector')) {
        addStatusEffect('Reflective Ward', '🛡️', 2000);
    }

    if (playerHasCore('quantum_shadow')) {
        addStatusEffect('Phased', '👻', 2000);
        play('phaseShiftSound');
    }
    
    if (playerHasCore('looper')) {
        const looperState = state.player.talent_states.core_states.looper;
        if (!looperState.isShifting) {
            looperState.isShifting = true;
            addStatusEffect('Shifting', '🌀', 1000);
            play('chargeUpSound');
            setTimeout(() => {
                if(state.gameOver || !looperState.isShifting) return;
                state.player.x = mx;
                state.player.y = my;
                play('mirrorSwap');
                utils.spawnParticles(state.particles, mx, my, '#ecf0f1', 40, 4);
                looperState.isShifting = false;
            }, 1000);
        }
    }
}

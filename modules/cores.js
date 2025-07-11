// modules/cores.js
import { state } from './state.js';
import * as utils from './utils.js';
import { bossData } from './bosses.js';
import { showUnlockNotification } from './ui.js';
import { powers } from './powers.js';

// --- NEW HELPER FUNCTION ---
// Checks if the player has a specific core active, either equipped or from a Pantheon buff.
function playerHasCore(coreId) {
    if (state.player.equippedAberrationCore === coreId) {
        return true;
    }
    return state.player.activePantheonBuffs.some(buff => buff.coreId === coreId);
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
        if (now > (state.player.talent_states.core_states.pantheon.lastCycleTime || 0) + 10000) {
            state.player.talent_states.core_states.pantheon.lastCycleTime = now;
            
            if (state.player.activePantheonBuffs.length < 3) {
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
    }
    // Clean up expired Pantheon buffs
    state.player.activePantheonBuffs = state.player.activePantheonBuffs.filter(buff => now < buff.endTime);


    // --- INDIVIDUAL CORE TICK LOGIC ---

    if (playerHasCore('vampire')) {
        if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 5000) {
            state.player.health = Math.min(state.player.maxHealth, state.player.health + (1 / 60));
        }
    }
    
    if (playerHasCore('gravity')) {
        if (now > (state.player.talent_states.core_states.gravity?.lastPulseTime || 0) + 10000) {
            state.player.talent_states.core_states.gravity.lastPulseTime = now;
            state.effects.push({ 
                type: 'player_pull_pulse', 
                x: state.player.x, 
                y: state.player.y, 
                maxRadius: 600, 
                startTime: now, 
                duration: 500 // Make it visible
            });
            play('gravitySound');
        }
    }
    
    if (playerHasCore('swarm_link')) {
        let prev = state.player;
        state.player.talent_states.core_states.swarm_link.tail.forEach(c => {
            c.x += (prev.x - c.x) * 0.2;
            c.y += (prev.y - c.y) * 0.2;
            // Use orange color and add particle trail for visibility
            const segmentRadius = 6 + Math.sin(now / 200);
            utils.drawCircle(ctx, c.x, c.y, segmentRadius, "orange"); 
            utils.spawnParticles(state.particles, c.x, c.y, 'rgba(255, 165, 0, 0.5)', 1, 0.5, 10, 2);
            prev = c;
            state.enemies.forEach(e => {
                if (Math.hypot(e.x - c.x, e.y - c.y) < e.r + segmentRadius && !e.isFriendly) {
                    e.hp -= 0.2 * state.player.talent_modifiers.damage_multiplier;
                }
            });
        });
    }
    
    if (playerHasCore('architect')) {
        if (now > (state.player.talent_states.core_states.architect.lastPillarTime || 0) + 15000) {
            state.player.talent_states.core_states.architect.lastPillarTime = now;
            play('architectBuild');
            
            const ringRadius = 250;
            const pillarCount = 12;
            for (let i = 0; i < pillarCount; i++) {
                const angle = (i / pillarCount) * 2 * Math.PI;
                const pillarX = state.player.x + ringRadius * Math.cos(angle);
                const pillarY = state.player.y + ringRadius * Math.sin(angle);
                state.effects.push({ type: 'architect_pillar', x: pillarX, y: pillarY, r: 20, endTime: now + 10000 });
            }
        }
    }

    if (playerHasCore('annihilator')) {
        if (now > (state.player.talent_states.core_states.annihilator.cooldownUntil || 0)) {
            state.player.talent_states.core_states.annihilator.cooldownUntil = now + 25000;
            state.effects.push({ type: 'core_annihilation_event', startTime: now, endTime: now + 4000 });
            play('powerSirenSound');
        }
    }

    if (playerHasCore('miasma')) {
        const miasmaState = state.player.talent_states.core_states.miasma;
        const moveDist = Math.hypot(state.player.dx_for_miasma_check || 0, state.player.dy_for_miasma_check || 0);

        if (moveDist < 0.1) { // Player is considered still
            if (!miasmaState.lastMoveTime) {
                 miasmaState.lastMoveTime = now;
            }
            if (now - miasmaState.lastMoveTime > 3000 && !miasmaState.isPurifying) {
                miasmaState.isPurifying = true;
                play('ventPurify');
            }
        } else {
            miasmaState.lastMoveTime = now;
            miasmaState.isPurifying = false;
        }

        if (miasmaState.isPurifying) {
            state.player.health = Math.min(state.player.maxHealth, state.player.health + (0.5 / 60));
            // Visual effect will be handled in gameLoop.js
        }
    }
    
    if (playerHasCore('puppeteer')) {
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
    }
    
    if (playerHasCore('helix_weaver')) {
        if (now > (state.player.talent_states.core_states.helix_weaver?.lastBolt || 0) + 5000) {
            if (!state.player.talent_states.core_states.helix_weaver) state.player.talent_states.core_states.helix_weaver = {};
            state.player.talent_states.core_states.helix_weaver.lastBolt = now;
            state.effects.push({ type: 'helix_bolt', x: state.player.x, y: state.player.y, r: 8, speed: 2, angle: Math.random() * 2 * Math.PI, lifeEnd: now + 10000, caster: state.player });
        }
    }
}

export function handleCoreOnEnemyDeath(enemy, gameHelpers) {
    const now = Date.now();
    const { spawnEnemy } = gameHelpers;

    if (enemy.isFriendly) return;

    if (playerHasCore('splitter')) {
        if (!enemy.boss && now > (state.player.talent_states.core_states.splitter.cooldownUntil || 0)) {
            state.player.talent_states.core_states.splitter.cooldownUntil = now + 500;
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                state.effects.push({
                    type: 'player_fragment', // Changed from seeking_shrapnel
                    x: enemy.x,
                    y: enemy.y,
                    dx: Math.cos(angle) * 4,
                    dy: Math.sin(angle) * 4,
                    r: 10,
                    speed: 5,
                    damage: 8 * state.player.talent_modifiers.damage_multiplier,
                    life: 3000,
                    startTime: now,
                    targetIndex: i
                });
            }
        }
    }
    
    if (playerHasCore('swarm_link')) {
        state.player.talent_states.core_states.swarm_link.enemiesForNextSegment++;
        if (state.player.talent_states.core_states.swarm_link.enemiesForNextSegment >= 2 && state.player.talent_states.core_states.swarm_link.tail.length < 50) {
            state.player.talent_states.core_states.swarm_link.enemiesForNextSegment = 0;
            const lastSegment = state.player.talent_states.core_states.swarm_link.tail.length > 0 ? state.player.talent_states.core_states.swarm_link.tail[state.player.talent_states.core_states.swarm_link.tail.length - 1] : state.player;
            state.player.talent_states.core_states.swarm_link.tail.push({ x: lastSegment.x, y: lastSegment.y });
        }
    }
    
    if (playerHasCore('fractal_horror')) {
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
            damageTaken = 0; // Negate damage
            conduitCharge.count--;
            if (conduitCharge.count <= 0) {
                state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== 'Conduit Charge');
            } else {
                conduitCharge.emoji = '⚡'.repeat(conduitCharge.count);
            }
            gameHelpers.play('conduitShatter');
            state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 200, speed: 1000, startTime: now, hitEnemies: new Set(), damage: 0, color: 'rgba(44, 62, 80, 0.7)' });
        }
    }

    if (damageTaken > 0) {
        if (playerHasCore('mirror_mirage')) {
            if (state.decoys.length < 3 && now > (state.player.talent_states.core_states.mirror_mirage.lastDecoyTime || 0)) {
                state.player.talent_states.core_states.mirror_mirage.lastDecoyTime = now + 250; // Short internal cooldown
                const newDecoy = { 
                    x: state.player.x, y: state.player.y, r: 20, 
                    hp: 25, // Give decoy health
                    isTaunting: true, isMobile: false 
                };
                state.decoys.push(newDecoy);
                gameHelpers.play('mirrorSwap');
                state.effects.push({ type: 'shockwave', caster: newDecoy, x: newDecoy.x, y: newDecoy.y, radius: 0, maxRadius: 150, speed: 800, startTime: now, damage: 0, color: 'rgba(155, 89, 182, 0.5)' });
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
            }
        }
    }
    
    return damageTaken;
}

export function handleCoreOnCollision(enemy, gameHelpers) {
    const now = Date.now();

    if (enemy.isFriendly) return;

    if (playerHasCore('parasite')) {
         if (state.player.talent_states.phaseMomentum.active && !enemy.boss) {
            enemy.isInfected = true;
            enemy.infectionEnd = now + 10000;
         }
    }
    
    if (playerHasCore('juggernaut')) {
        const juggernautState = state.player.talent_states.core_states.juggernaut;
        if (juggernautState.isCharging && !enemy.boss) {
            enemy.hp = 0;
            state.effects.push({ type: 'shockwave', caster: state.player, x: enemy.x, y: enemy.y, radius: 0, maxRadius: 120, speed: 600, startTime: now, hitEnemies: new Set(), damage: 10 * state.player.talent_modifiers.damage_multiplier, color: 'rgba(99, 110, 114, 0.7)' });
            juggernautState.isCharging = false;
            juggernautState.lastMoveTime = 0;
        }
    }
}

export function handleCoreOnShieldBreak() {
    if (playerHasCore('emp')) {
        state.effects = state.effects.filter(ef => ef.type !== 'nova_bullet' && ef.type !== 'ricochet_projectile' && ef.type !== 'seeking_shrapnel');
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#3498db', 50, 4, 30);
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
            addStatusEffect('Conduit Charge', '⚡', 999999); // Duration is effectively infinite
        }
    }
}

export function handleCoreOnEmptySlot(mx, my, gameHelpers) {
    if (playerHasCore('syphon') && state.player.talent_states.core_states.syphon.canUse) {
        gameHelpers.play('gravitySound');
        state.effects.push({
            type: 'syphon_pull',
            source: state.player,
            endTime: Date.now() + 1000,
        });
        state.player.talent_states.core_states.syphon.canUse = false;
        return true;
    }
    return false;
}

export function handleCoreOnDefensivePower(powerKey, mx, my, gameHelpers) {
    const { play } = gameHelpers;

    if (playerHasCore('reflector')) {
        gameHelpers.addStatusEffect('Reflective Ward', '💎', 2000);
    }

    if (playerHasCore('quantum_shadow')) {
        gameHelpers.addStatusEffect('Phased', '👻', 2000);
        play('phaseShiftSound');
    }

    if (playerHasCore('looper')) {
        const looperState = state.player.talent_states.core_states.looper;
        looperState.lastDefensivePower = powerKey;

        // Visual feedback for the primed echo
        gameHelpers.addStatusEffect('Echo Primed', '🔁', 3000);

        setTimeout(() => {
            if (looperState.lastDefensivePower) {
                const powerToEcho = looperState.lastDefensivePower;
                looperState.lastDefensivePower = null; // Consume it
                
                // Check if the game is over before trying to cast
                if(state.gameOver) return;

                // Re-use the main power function, but mark it as a free cast
                const power = powers[powerToEcho];
                if (power) {
                    play('mirrorSwap'); // Echo sound
                    // Create a visual effect for the echo
                    state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 100, speed: 500, startTime: Date.now(), damage: 0, color: 'rgba(26, 188, 156, 0.5)' });
                    power.apply(utils, gameHelpers, mx, my);
                }
            }
        }, 3000);
    }
}

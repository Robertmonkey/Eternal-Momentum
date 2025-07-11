// modules/powers.js
import { state } from './state.js';
import * as utils from './utils.js';
import * as Cores from './cores.js';

export const offensivePowers = ['missile', 'nova', 'orbitalStrike', 'ricochetShot', 'black_hole'];

export const powers = {
    // Offensive Powers
    missile: {
        name: 'Missile', emoji: '🚀', type: 'offensive',
        apply: (utils, gameHelpers, mx, my, damageModifier = 1.0) => {
            const angle = Math.atan2(my - state.player.y, mx - state.player.x);
            const speed = 7;
            const damage = 10 * state.player.talent_modifiers.damage_multiplier * damageModifier;
            state.effects.push({ type: 'missile', x: state.player.x, y: state.player.y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, r: 8, damage: damage, caster: state.player, startTime: Date.now() });
            gameHelpers.play('shoot');
        }
    },
    nova: {
        name: 'Nova', emoji: '💥', type: 'offensive',
        apply: (utils, gameHelpers, mx, my, damageModifier = 1.0) => {
            const bulletCount = 24;
            const speed = 5;
            const damage = 6 * state.player.talent_modifiers.damage_multiplier * damageModifier;
            for (let i = 0; i < bulletCount; i++) {
                const angle = (i / bulletCount) * Math.PI * 2;
                state.effects.push({ type: 'nova_bullet', x: state.player.x, y: state.player.y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, r: 5, damage: damage, caster: state.player, startTime: Date.now() });
            }
            gameHelpers.play('nova');
        }
    },
    orbitalStrike: {
        name: 'Orbital Strike', emoji: '🛰️', type: 'offensive',
        apply: (utils, gameHelpers, mx, my, damageModifier = 1.0) => {
            const damage = 40 * state.player.talent_modifiers.damage_multiplier * damageModifier;
            state.effects.push({ type: 'orbital_strike_marker', x: mx, y: my, r: 50, endTime: Date.now() + 1500, damage: damage, caster: state.player });
            gameHelpers.play('orbitalStrike');
        }
    },
    ricochetShot: {
        name: 'Ricochet Shot', emoji: '🔄', type: 'offensive',
        apply: (utils, gameHelpers, mx, my, damageModifier = 1.0) => {
            const angle = Math.atan2(my - state.player.y, mx - state.player.x);
            const speed = 10;
            const damage = 12 * state.player.talent_modifiers.damage_multiplier * damageModifier;
            state.effects.push({ type: 'ricochet_projectile', x: state.player.x, y: state.player.y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, r: 10, damage: damage, bouncesLeft: 3, caster: state.player, hitEnemies: new Set(), startTime: Date.now() });
            gameHelpers.play('ricochet');
        }
    },
    black_hole: {
        name: 'Black Hole', emoji: '⚫', type: 'offensive',
        apply: (utils, gameHelpers, mx, my, damageModifier = 1.0) => {
            const damage = 0.2 * state.player.talent_modifiers.damage_multiplier * damageModifier;
            state.effects.push({ type: 'black_hole', x: mx, y: my, r: 20, maxRadius: 150, duration: 5000, damage: damage, pullForce: 0.15, caster: state.player, startTime: Date.now() });
            gameHelpers.play('blackhole');
        }
    },

    // Defensive Powers
    heal: {
        name: 'Heal', emoji: '❤️', type: 'defensive',
        apply: (utils, gameHelpers, mx, my) => {
            state.player.health = Math.min(state.player.maxHealth, state.player.health + 25);
            utils.spawnParticles(state.particles, state.player.x, state.player.y, '#2ecc71', 50, 2);
            gameHelpers.play('heal');
        }
    },
    shield: {
        name: 'Shield', emoji: '🛡️', type: 'defensive',
        apply: (utils, gameHelpers, mx, my) => {
            state.player.shield = true;
            state.player.shieldEndTime = Date.now() + 5000;
            gameHelpers.play('shield');
        }
    },
    shockwave: {
        name: 'Shockwave', emoji: '🌊', type: 'defensive',
        apply: (utils, gameHelpers, mx, my) => {
            const damage = 15 * state.player.talent_modifiers.damage_multiplier;
            state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 300, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: damage });
            gameHelpers.play('shockwave');
        }
    },
    decoy: {
        name: 'Decoy', emoji: '👻', type: 'defensive',
        apply: (utils, gameHelpers, mx, my) => {
            const now = Date.now();
            if (state.decoys.length < 3) {
                 const newDecoy = { 
                    x: mx, y: my, r: 20, 
                    hp: 50, // Give decoy health
                    isTaunting: true, isMobile: true // Make them mobile
                };
                state.decoys.push(newDecoy);
                gameHelpers.play('mirrorSwap');
                state.effects.push({ type: 'shockwave', caster: newDecoy, x: newDecoy.x, y: newDecoy.y, radius: 0, maxRadius: 150, speed: 800, startTime: now, damage: 0, color: 'rgba(52, 152, 219, 0.5)' });
            }
        }
    },
    freeze: {
        name: 'Freeze', emoji: '❄️', type: 'defensive',
        apply: (utils, gameHelpers, mx, my) => {
            state.effects.push({ type: 'freeze_zone', x: state.player.x, y: state.player.y, r: 200, endTime: Date.now() + 500, caster: state.player });
            gameHelpers.play('freeze');
        }
    },

    // Stack Powers
    berserk: {
        name: 'Berserk', emoji: '😡', type: 'stack',
        apply: (utils, gameHelpers, mx, my) => {
            state.player.berserkUntil = Date.now() + 5000;
            state.player.talent_modifiers.damage_multiplier *= 1.5;
            state.player.talent_modifiers.damage_taken_multiplier *= 1.25;
            gameHelpers.play('berserk');
        }
    }
};

export function usePower(powerKey, isFreeCast = false) {
    const power = powers[powerKey];
    const { addStatusEffect, play } = window.gameHelpers;
    let consumed = true;
    
    // --- SINGULARITY & RECYCLING TALENT LOGIC ---
    if (!isFreeCast) {
        let recycled = false;
        if (state.player.purchasedTalents.has('energetic-recycling') && Math.random() < 0.10) {
            recycled = true;
        }
        // Singularity Core Check
        if (Cores.playerHasCore('singularity') && Math.random() < 0.15) {
            recycled = true;
        }
        
        if (recycled) {
            addStatusEffect('Recycled', '♻️', 2000);
            utils.spawnParticles(state.particles, state.player.x, state.player.y, '#f1c40f', 30, 2);
            play('recycleSound');
            consumed = false;
        }
    }

    if (consumed && !isFreeCast) {
        const inv = power.type === 'offensive' ? state.offensiveInventory : state.defensiveInventory;
        const index = inv.indexOf(powerKey);
        if (index > -1) {
            inv[index] = null;
        }
    }

    // Determine target coordinates (mouse position)
    const canvas = document.getElementById("gameCanvas");
    const rect = canvas.getBoundingClientRect();
    const mx = window.mousePosition.x - rect.left;
    const my = window.mousePosition.y - rect.top;

    const applyArgs = [utils, window.gameHelpers, mx, my];

    // --- TEMPORAL PARADOX CORE LOGIC ---
    if (power.type === 'offensive' && Cores.playerHasCore('temporal_paradox')) {
        const echoEffect = { 
            type: 'paradox_player_echo', 
            x: state.player.x, y: state.player.y, 
            powerToCopy: powerKey, 
            mx: mx, my: my,
            startTime: Date.now()
        };
        state.effects.push(echoEffect);
        play('phaseShiftSound');
    }

    // --- DEFENSIVE CORE TRIGGERS ---
    if (power.type === 'defensive') {
        Cores.handleCoreOnDefensivePower(powerKey, mx, my, window.gameHelpers);
    }

    // Apply the main power effect
    power.apply(...applyArgs);

    // --- SINGULARITY DUPLICATION LOGIC ---
    if (power.type !== 'stack' && Cores.playerHasCore('singularity') && Math.random() < 0.05) {
        // Apply a second time!
        setTimeout(() => {
             if (state.gameOver) return;
             power.apply(...applyArgs);
             addStatusEffect('Duplicated', '✨', 2000);
             play('shaperAttune');
             utils.spawnParticles(state.particles, state.player.x, state.player.y, '#9b59b6', 40, 3);
        }, 100); // Small delay for effect
    }
}

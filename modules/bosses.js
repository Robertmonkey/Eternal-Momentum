// modules/bosses.js
import { STAGE_CONFIG } from './config.js';
import * as utils from './utils.js';

export const bossData = [{
    id: "splitter",
    name: "Splitter Sentinel",
    color: "#ff4500",
    maxHP: 96,
    difficulty_tier: 1,
    archetype: 'swarm',
    unlock_level: 10,
    core_desc: "The first non-boss enemy you defeat every 20 seconds shatters, releasing a wave of 3 friendly minions that attack enemies for 10 seconds.",
    description: "A fragile construct that shatters upon defeat, releasing waves of smaller entities.",
    lore: "From a reality woven from pure mathematics, this entity was a prime number given form—a concept of indivisible unity. The Unraveling fractured its very definition, forcing it into a horrifying, paradoxical state of constant, agonizing division. It shatters, yet each fragment believes it is the original, seeking to reclaim its impossible wholeness.",
    mechanics_desc: "Upon defeat, the Sentinel shatters into two waves of smaller enemies that spawn in expanding circles. Prioritize clearing the first wave before the second appears to avoid being overwhelmed.",
    onDeath: (b, state, spawnEnemy, spawnParticles, play) => {
        play('splitterOnDeath');
        spawnParticles(state.particles, b.x, b.y, "#ff4500", 100, 6, 40, 5);
        const spawnInCircle = (count, radius, center) => {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * 2 * Math.PI + Math.random() * 0.5;
                const spawnX = center.x + Math.cos(angle) * radius;
                const spawnY = center.y + Math.sin(angle) * radius;
                const newEnemy = spawnEnemy(false, null, {
                    x: spawnX,
                    y: spawnY
                });
                if (state.arenaMode && newEnemy) newEnemy.targetBosses = true;
            }
        };
        spawnInCircle(6, 60, b);
        setTimeout(() => spawnInCircle(6, 120, b), 1000);
    }
}, {
    id: "reflector",
    name: "Reflector Warden",
    color: "#2ecc71",
    maxHP: 120,
    difficulty_tier: 1,
    archetype: 'specialist',
    unlock_level: 15,
    core_desc: "After using any defensive power-up, gain a 'Reflective Ward' for 2 seconds. While active, all incoming enemy projectiles are nullified and reflected.",
    description: "Cycles between vulnerable and shielded states. Attacking while its Reflective Shield is active will turn your own power against you.",
    lore: "The last automated guardian of a crystalline archive-world where physics demanded perfect energy conservation. Its reality has long since shattered, but its core directive remains. It perceives all incoming force as a violation of physical law, which it must dutifully and instantly return to its source.",
    mechanics_desc: "The Warden moves relentlessly and periodically surrounds itself with a bright, reflective shield. Attacking while the shield is active will heal the boss and reflect significant damage back to you. Restraint is crucial; only attack during the brief windows when its shield is down.",
    init: b => {
        b.phase = "idle";
        b.last = Date.now();
        b.cycles = 0;
        b.reflecting = false;
    },
    logic: (b, ctx, state, utils) => {
        ctx.save();
        if (Date.now() - b.last > 2000) {
            b.phase = b.phase === "idle" ? "moving" : "idle";
            b.last = Date.now();
            if (b.phase === "moving") {
                b.cycles++;
                if (b.cycles % 3 === 0) {
                    b.reflecting = true;
                    utils.spawnParticles(state.particles, b.x, b.y, "#fff", 50, 4, 30);
                    setTimeout(() => b.reflecting = false, 2000);
                }
            }
        }
        if (b.phase === "moving") {
            ctx.fillStyle = "rgba(46, 204, 113, 0.3)";
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r + 10, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r + 5, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.restore();
    },
    onDamage: (b, dmg, source, state, spawnParticles, play) => {
        if (b.phase !== "idle") b.hp += dmg;
        if (b.reflecting) {
            play('reflectorOnHit');
            if(source && source.health) {
                source.health -= 10;
                if (source.health <= 0) state.gameOver = true;
            }
        }
    }
}, {
    id: "vampire",
    name: "Vampire Veil",
    color: "#800020",
    maxHP: 144,
    difficulty_tier: 1,
    archetype: 'aggressor',
    unlock_level: 20,
    core_desc: "After avoiding damage for 5 seconds, regenerate 1 health per second. Also, dealing damage has a 2% chance to spawn a small health pickup.",
    description: "A parasitic entity that rapidly regenerates vitality if left untouched. Sustained assault is the only path to victory.",
    lore: "A symbiotic organism from a timeline where life evolved without death, only the endless transfer of vitality. The Unraveling severed its connection to its ecosystem, leaving it in a state of perpetual starvation. It now drains the life force of anything it touches, not out of malice, but from a desperate, instinctual need to mend a wound that can never heal.",
    mechanics_desc: "Rapidly regenerates health if it hasn't taken damage for a few seconds. A sustained, constant assault is required to defeat it. Occasionally drops health pickups when hit.",
    init: b => {
        b.lastHit = Date.now();
        b.lastHeal = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const now = Date.now();
        if (now - b.lastHit > 3000 && now - b.lastHeal > 5000) {
            b.hp = Math.min(b.maxHP, b.hp + 5);
            b.lastHeal = now;
            gameHelpers.play('vampireHeal');
            utils.spawnParticles(state.particles, b.x, b.y, "#800020", 20, 1, 40);
        }
    },
    onDamage: (b, dmg, source, state, spawnParticles) => {
        b.lastHit = Date.now();
        if (Math.random() < 0.3) {
            state.pickups.push({
                x: b.x,
                y: b.y,
                r: 10,
                type: 'heal',
                emoji: '🩸',
                lifeEnd: Date.now() + 8000,
                vx: 0,
                vy: 0,
                customApply: () => {
                    source.health = Math.min(source.maxHealth || Infinity, source.health + 10);
                    spawnParticles(state.particles, source.x, source.y, "#800020", 20, 3, 30);
                }
            });
        }
    }
}, {
    id: "gravity",
    name: "Gravity Tyrant",
    color: "#9b59b6",
    maxHP: 168,
    difficulty_tier: 1,
    archetype: 'field_control',
    unlock_level: 25,
    core_desc: "Every 10 seconds, you pulse with gravitational force, briefly pulling all non-boss enemies and pickups towards you.",
    description: "Warps the battlefield with a ring of gravitational wells that impede movement.",
    lore: "The tormented ghost of a lead scientist who, in a desperate attempt to halt the Unraveling, tried to anchor their reality by creating a supermassive black hole. The experiment failed catastrophically, collapsing their universe and binding the scientist's consciousness to the resulting gravitational anomalies.",
    mechanics_desc: "Constantly surrounded by a ring of gravitational wells. These wells will significantly slow your movement and pull you towards their center if you enter their radius.",
    init: b => {
        b.wells = [];
        for (let i = 0; i < 8; i++) {
            b.wells.push({
                angle: i * (Math.PI / 4),
                dist: 150,
                r: 30
            });
        }
    },
    logic: (b, ctx, state, utils) => {
        b.wells.forEach(w => {
            const wellX = b.x + Math.cos(w.angle) * w.dist;
            const wellY = b.y + Math.sin(w.angle) * w.dist;
            utils.drawCircle(ctx, wellX, wellY, w.r, "rgba(155, 89, 182, 0.3)");
            const dx = state.player.x - wellX,
                dy = state.player.y - wellY;
            if (Math.hypot(dx, dy) < w.r + state.player.r) {
                state.player.x -= dx * 0.05;
                state.player.y -= dy * 0.05;
            }
        });
    }
}, {
    id: "swarm",
    name: "Swarm Link",
    color: "#c0392b",
    maxHP: 200,
    difficulty_tier: 1,
    archetype: 'swarm',
    unlock_level: 30,
    core_desc: "A phantom tail follows you. For every 2 non-boss enemies defeated, a new segment is added (max 50). The tail deals damage to enemies it touches.",
    description: "The alpha of a massive hive mind, its colossal, damaging tail follows its every move.",
    lore: "This was the alpha of a hive-mind that experienced reality as a single, shared consciousness across trillions of bodies. When the Unraveling consumed their timeline, the alpha's mind was the last to fade. Its colossal tail is a psychic scar—a phantom limb reaching for its lost hive.",
    mechanics_desc: "Followed by a long, invulnerable tail made of smaller segments. Colliding with any part of the tail will cause rapid, continuous damage. Keep your distance from both the main body and its tail.",
    init: b => {
        b.chain = [];
        for (let i = 0; i < 150; i++) b.chain.push({
            x: b.x,
            y: b.y
        });
    },
    logic: (b, ctx, state, utils) => {
        let prev = b;
        b.chain.forEach(c => {
            c.x += (prev.x - c.x) * 0.2;
            c.y += (prev.y - c.y) * 0.2;
            utils.drawCircle(ctx, c.x, c.y, 8, "orange");
            prev = c;
            
            const pDist = Math.hypot(state.player.x - c.x, state.player.y - c.y);
            if (pDist < state.player.r + 8) { 
                state.player.talent_states.phaseMomentum.lastDamageTime = Date.now();
                state.player.talent_states.phaseMomentum.active = false;
                if(!state.player.shield){
                    state.player.health -= 0.25;
                    if(state.player.health <= 0) state.gameOver = true;
                }
            }
        });
    }
}, {
    id: "mirror",
    name: "Mirror Mirage",
    color: "#ff00ff",
    maxHP: 240,
    difficulty_tier: 1,
    archetype: 'specialist',
    unlock_level: 35,
    core_desc: "When you take damage, you automatically create a Decoy at your location that lasts for 3 seconds. This effect has a 12-second cooldown.",
    description: "A master of illusion that creates identical phantoms, constantly shifting its consciousness between them to evade destruction.",
    lore: "Hailing from a universe of pure thought, this being could exist in multiple places at once. The Unraveling has pinned its fractured consciousness to physical space, forcing it to 'swap' its true self between tangible, fragile illusions in a panicked attempt to evade permanent decoherence.",
    mechanics_desc: "Creates multiple identical clones of itself. Only the true Mirage can be damaged. It will periodically and instantly swap positions with one of its clones, forcing you to reacquire the correct target.",
    init: (b, state, spawnEnemy, canvas) => {
        b.clones = [];
        for (let i = 0; i < 5; i++) b.clones.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: b.r
        });
        b.lastSwap = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        b.clones.forEach(c => utils.drawCircle(ctx, c.x, c.y, c.r, "rgba(255,0,255,0.5)"));
        if (Date.now() - b.lastSwap > 2000) {
            b.lastSwap = Date.now();
            gameHelpers.play('mirrorSwap');
            const i = Math.floor(Math.random() * b.clones.length);
            [b.x, b.clones[i].x] = [b.clones[i].x, b.x];
            [b.y, b.clones[i].y] = [b.clones[i].y, b.y];
        }
    },
    onDamage: (b, dmg, source, state, spawnParticles) => {
        spawnParticles(state.particles, b.x, b.y, "#f00", 10, 3, 20);
    }
}, {
    id: "emp",
    name: "EMP Overload",
    color: "#3498db",
    maxHP: 260,
    difficulty_tier: 1,
    archetype: 'specialist',
    unlock_level: 40,
    core_desc: "When your Shield breaks from damage, it releases a miniature EMP blast, destroying all enemy projectiles on screen.",
    description: "Periodically releases a massive electromagnetic pulse that wipes all collected powers and briefly stuns.",
    lore: "The core of a planet-wide AI that governed all energy and information. As its world collapsed, it experienced an eternity of system errors and logic failures in a single instant. The resulting crash corrupted its very being, turning it into a walking electromagnetic catastrophe that periodically purges all systems—including your own.",
    mechanics_desc: "Periodically unleashes a massive electromagnetic pulse across the entire arena. This pulse will destroy **all** of your currently held power-ups and will briefly stun and slow you.",
    init: b => {
        b.lastEMP = Date.now();
        b.bolts = [];
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const canvas = ctx.canvas;
        if (Date.now() - b.lastEMP > 8000) {
            b.lastEMP = Date.now();
            gameHelpers.play('empDischarge');
            state.offensiveInventory = [null, null, null];
            state.defensiveInventory = [null, null, null];
            
            gameHelpers.addStatusEffect('Slowed', '🐌', 1000);
            gameHelpers.addStatusEffect('Stunned', '😵', 500);

            b.bolts = [];
            for (let i = 0; i < 7; i++) {
                b.bolts.push({
                    x1: Math.random() * canvas.width,
                    y1: 0,
                    x2: Math.random() * canvas.width,
                    y2: canvas.height,
                    life: Date.now() + 300
                });
                b.bolts.push({
                    x1: 0,
                    y1: Math.random() * canvas.height,
                    x2: canvas.width,
                    y2: Math.random() * canvas.height,
                    life: Date.now() + 300
                });
            }
        }
        b.bolts = b.bolts.filter(bolt => Date.now() < bolt.life);
        b.bolts.forEach(bolt => utils.drawLightning(ctx, bolt.x1, bolt.y1, bolt.x2, bolt.y2, "#3498db"));
    }
}, {
    id: "architect",
    name: "The Architect",
    color: "#7f8c8d",
    maxHP: 280,
    difficulty_tier: 1,
    archetype: 'field_control',
    unlock_level: 45,
    core_desc: "Every 15 seconds, you manifest a formation of four impassable energy pillars around you. You can move through them, but enemies cannot. They last 10 seconds.",
    description: "A terraforming intelligence that reshapes the arena with impassable pillars, forcing a battle within its own creation.",
    lore: "A terraforming intelligence from a world where reality was programmable. Its purpose was to build, to create stable structures from raw data. Now, its code corrupted by the Unraveling, it compulsively builds nonsensical, impassable prisons, trapping others in a desperate, fleeting attempt to impose order on the chaos that consumed it.",
    mechanics_desc: "Periodically reshapes the battlefield by creating impassable pillar formations. These pillars will block both your movement and projectiles. Be prepared to navigate tight corridors and restricted spaces.",
    init: b => {
        b.pillars = [];
        b.lastBuild = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers, aspectState) => {
        const timer = aspectState ? 'lastActionTime' : 'lastBuild';
        const lastTime = aspectState ? aspectState[timer] : b[timer];

        if (Date.now() - (lastTime || 0) > 8000) {
            if (aspectState) aspectState[timer] = Date.now();
            else b[timer] = Date.now();

            gameHelpers.play('architectBuild');
            b.pillars = [];
            for (let i = 0; i < 10; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const startX = b.x + Math.cos(angle) * 100;
                const startY = b.y + Math.sin(angle) * 100;
                for (let j = 0; j < 8; j++) {
                    b.pillars.push({
                        x: startX + Math.cos(angle) * j * 40,
                        y: startY + Math.sin(angle) * j * 40,
                        r: 15
                    });
                }
            }
        }
        
        b.pillars.forEach(p => {
            utils.drawCircle(ctx, p.x, p.y, p.r, "#444");
            const dist = Math.hypot(state.player.x - p.x, state.player.y - p.y);
            if (dist < state.player.r + p.r) {
                const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
                state.player.x = p.x + Math.cos(angle) * (state.player.r + p.r);
                state.player.y = p.y + Math.sin(angle) * (state.player.r + p.r);
            }
        });
    },
    onDeath: (b) => {
        setTimeout(() => {
            if (!b.activeAspects || !b.activeAspects.has('architect')) {
                b.pillars = [];
            }
        }, 2000);
    }
}, {
    id: "aethel_and_umbra",
    name: "Aethel & Umbra",
    color: "#f39c12",
    maxHP: 280,
    difficulty_tier: 1,
    archetype: 'aggressor',
    unlock_level: 50,
    core_desc: "While health is above 50%, gain 10% movement speed (Aethel's Aspect). While below 50%, gain 10% damage (Umbra's Aspect).",
    description: "Two bonded entities, one swift and one resilient. The true challenge begins when one is vanquished, causing the survivor to enter a state of absolute rage.",
    lore: "In their timeline, bonds of loyalty were a tangible, physical force. Aethel & Umbra were a bonded pair of guardians. The Unraveling severed the metaphysical link between them, but not their consciousness. They now fight as two separate bodies with one shared, agonized soul, their rage amplifying when one is forced to witness the other's demise... again.",
    mechanics_desc: "A duo boss. Aethel is faster but more fragile; Umbra is slower but much tougher. When one is defeated, the survivor becomes enraged, gaining significantly enhanced stats and abilities. It is often wise to focus them down evenly.",
    init: (b, state, spawnEnemy) => {
        b.r = 50;
        b.enraged = false;
        
        const partner = state.enemies.find(e => e.id === 'aethel_and_umbra' && e !== b);
        
        if (!partner) {
            // This is the first twin, it defines both its own role and its partner's.
            b.role = Math.random() < 0.5 ? 'Aethel' : 'Umbra';
            
            const partnerBoss = spawnEnemy(true, 'aethel_and_umbra');
            if (partnerBoss) {
                partnerBoss.role = b.role === 'Aethel' ? 'Umbra' : 'Aethel';
                
                // Set up this boss (b)
                if (b.role === 'Aethel') {
                    b.r *= 0.75;
                    b.dx = (b.dx || (Math.random() - 0.5)) * 2.5;
                    b.dy = (b.dy || (Math.random() - 0.5)) * 2.5;
                } else { // Umbra
                    b.r *= 1.25;
                    b.maxHP *= 1.5;
                    b.hp = b.maxHP;
                }

                // Directly configure the partner
                if (partnerBoss.role === 'Aethel') {
                    partnerBoss.r *= 0.75;
                    partnerBoss.dx = (partnerBoss.dx || (Math.random() - 0.5)) * 2.5;
                    partnerBoss.dy = (partnerBoss.dy || (Math.random() - 0.5)) * 2.5;
                } else { // Umbra
                    partnerBoss.r *= 1.25;
                    partnerBoss.maxHP *= 1.5;
                    partnerBoss.hp = partnerBoss.maxHP;
                }
                
                b.partner = partnerBoss;
                partnerBoss.partner = b;
                b.name = b.role;
                partnerBoss.name = partnerBoss.role;
            }
        }
    },
    logic: (b, ctx) => {
        if (!ctx) return;
        const roleColor = b.role === 'Aethel' ? 'rgba(52, 152, 219, 0.7)' : 'rgba(192, 57, 43, 0.7)';
        ctx.strokeStyle = roleColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 4, 0, 2 * Math.PI);
        ctx.stroke();

        if (b.enraged) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r + 8, 0, 2 * Math.PI);
            ctx.stroke();
        }
    },
    onDeath: (b, state) => {
        const partner = state.enemies.find(e => e.id === 'aethel_and_umbra' && e !== b && e.hp > 0);
        if (partner && !partner.enraged) {
            partner.enraged = true;
            if (b.role === 'Aethel') { // Partner is Umbra, becomes faster
                partner.dx = (partner.dx || (Math.random() - 0.5)) * 2.5;
                partner.dy = (partner.dy || (Math.random() - 0.5)) * 2.5;
            } else { // Partner is Aethel, becomes larger and tougher
                partner.r *= 1.25;
                const healthBonus = partner.maxHP * 1.5;
                partner.maxHP += healthBonus;
                partner.hp += healthBonus;
            }
        }
    }
}, {
    id: "looper",
    name: "Looping Eye",
    color: "#ecf0f1",
    maxHP: 320,
    difficulty_tier: 1,
    archetype: 'specialist',
    unlock_level: 55,
    core_desc: "Activating a defensive power begins a 1-second 'Temporal Shift.' After the delay, you instantly warp to your cursor's location.",
    description: "An unstable being that defies spacetime, erratically teleporting across the arena.",
    lore: "An anomaly from a timeline that did not perceive time as linear. To this being, past, present, and future were all the same. The Unraveling has forced it into a linear existence, a state of being so alien and painful that it violently lurches between points in spacetime to escape the unbearable agony of 'now.'",
    mechanics_desc: "Teleports to a random location on the battlefield every few seconds. The teleportation frequency increases as it takes damage, making it a highly mobile and unpredictable target.",
    init: b => {
        b.lastTeleport = 0;
        b.teleportingAt = 0;
        b.teleportTarget = null;
    },
    logic: (b, ctx, state, utils, gameHelpers, aspectState) => {
        const timer = aspectState ? 'lastActionTime' : 'lastTeleport';
        let lastTime = aspectState ? aspectState[timer] : b[timer];
        const interval = b.hp < b.maxHP * 0.25 ? 1500 : (b.hp < b.maxHP * 0.5 ? 2000 : 2500);

        // Condition to start the teleport sequence
        if (Date.now() - (lastTime || 0) > interval && !b.teleportingAt) {
            b.teleportingAt = Date.now() + 1000; // 1 second warning
            b.teleportTarget = {
                x: utils.randomInRange(b.r, ctx.canvas.width - b.r),
                y: utils.randomInRange(b.r, ctx.canvas.height - b.r)
            };
            state.effects.push({
                type: 'teleport_indicator',
                x: b.teleportTarget.x,
                y: b.teleportTarget.y,
                r: b.r,
                endTime: b.teleportingAt
            });
            gameHelpers.play('chargeUpSound');
            utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20); // Particles on departure
        }

        // Condition to execute the teleport
        if (b.teleportingAt && Date.now() > b.teleportingAt) {
            b.x = b.teleportTarget.x;
            b.y = b.teleportTarget.y;

            if (aspectState) aspectState[timer] = Date.now();
            else b[timer] = Date.now();
            
            b.teleportingAt = 0;
            b.teleportTarget = null;
            
            gameHelpers.play('mirrorSwap');
            utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
        }
    }
}, 
// --- ALL OTHER BOSSES GO HERE, each with their unlock_level and core_desc added ---
// --- For brevity, I will only show the changes for the remaining bosses ---
{
    id: "juggernaut",
    name: "The Juggernaut",
    color: "#636e72",
    maxHP: 360,
    difficulty_tier: 2,
    archetype: 'aggressor',
    unlock_level: 60,
    core_desc: "After moving continuously for 3 seconds, build a 'Charge.' Your next collision with a non-boss enemy instantly destroys it and creates a small shockwave.",
    // ... rest of juggernaut properties
}, {
    id: "puppeteer",
    name: "The Puppeteer",
    color: "#a29bfe",
    maxHP: 320,
    difficulty_tier: 2,
    archetype: 'swarm',
    unlock_level: 65,
    core_desc: "Every 8 seconds, automatically convert the farthest non-boss enemy into a permanent friendly 'Puppet.' You can have a maximum of 3 puppets.",
    // ... rest of puppeteer properties
}, {
    id: "glitch",
    name: "The Glitch",
    color: "#fd79a8",
    maxHP: 336,
    difficulty_tier: 2,
    archetype: 'specialist',
    unlock_level: 70,
    core_desc: "When you take damage, there is a 25% chance to create a 'Glitch Zone' at the attacker's location for 4 seconds. Enemies inside have erratic movement.",
    // ... rest of glitch properties
}, {
    id: "sentinel_pair",
    name: "Sentinel Pair",
    color: "#f1c40f",
    maxHP: 400,
    difficulty_tier: 2,
    archetype: 'aggressor',
    unlock_level: 75,
    core_desc: "When a Decoy is active, a harmless energy tether connects you and the decoy. Enemies that touch the tether take continuous light damage.",
    // ... rest of sentinel_pair properties
}, {
    id: "basilisk",
    name: "The Basilisk",
    color: "#00b894",
    maxHP: 384,
    difficulty_tier: 2,
    archetype: 'field_control',
    unlock_level: 80,
    core_desc: "Enemies damaged by your Shockwave or Freeze powers are briefly 'Petrified,' causing them to take 15% more damage from all sources for 3 seconds.",
    // ... rest of basilisk properties
}, {
    id: "annihilator",
    name: "The Annihilator",
    color: "#d63031",
    maxHP: 480,
    difficulty_tier: 2,
    archetype: 'field_control',
    unlock_level: 85,
    core_desc: "Every 25 seconds, attune to a non-boss enemy, making it an invulnerable 'Pillar of Shadow' for 4s. At the end, fire a short-range Annihilation Beam.",
    // ... rest of annihilator properties
}, {
    id: "parasite",
    name: "The Parasite",
    color: "#55efc4",
    maxHP: 416,
    difficulty_tier: 2,
    archetype: 'swarm',
    unlock_level: 90,
    core_desc: "Damaging an enemy 'Infects' it. Infected enemies spawn a friendly spore on death. Passing through enemies with Phase Momentum also infects them.",
    // ... rest of parasite properties
}, {
    id: "quantum_shadow",
    name: "Quantum Shadow",
    color: "#81ecec",
    maxHP: 360,
    difficulty_tier: 2,
    archetype: 'specialist',
    unlock_level: 95,
    core_desc: "When you use a defensive power, you become 'Phased' for 2 seconds, allowing you to move through non-boss enemies and their projectiles unharmed.",
    // ... rest of quantum_shadow properties
}, {
    id: "time_eater",
    name: "Time Eater",
    color: "#dfe6e9",
    maxHP: 440,
    difficulty_tier: 2,
    archetype: 'field_control',
    unlock_level: 100,
    core_desc: "When you use the Black Hole power-up, it leaves behind a 'Dilation Field' for 30 seconds that slows enemy projectiles by 90%.",
    // ... rest of time_eater properties
}, {
    id: "singularity",
    name: "The Singularity",
    color: "#000000",
    maxHP: 600,
    difficulty_tier: 2,
    archetype: 'specialist',
    unlock_level: 105,
    core_desc: "Your core destabilizes reality, giving you a 5% chance to duplicate power-up effects and a 15% chance that using a power-up will not consume it.",
    // ... rest of singularity properties
}, {
    id: "miasma",
    name: "The Miasma",
    color: "#6ab04c",
    maxHP: 400,
    difficulty_tier: 3,
    archetype: 'field_control',
    unlock_level: 110,
    core_desc: "You are immune to all environmental damage-over-time. Standing still for 3 seconds creates a small zone around you that heals you slowly.",
    // ... rest of miasma properties
}, {
    id: "temporal_paradox",
    name: "The Temporal Paradox",
    color: "#81ecec",
    maxHP: 420,
    difficulty_tier: 3,
    archetype: 'specialist',
    unlock_level: 115,
    core_desc: "When you use an offensive power, a 'Paradox Echo' of you appears and repeats the action 1 second later for 50% of the damage.",
    // ... rest of temporal_paradox properties
}, {
    id: "syphon",
    name: "The Syphon",
    color: "#9b59b6",
    maxHP: 450,
    difficulty_tier: 3,
    archetype: 'specialist',
    unlock_level: 120,
    core_desc: "Attempting to use an empty inventory slot unleashes a 'Syphon Cone' that pulls all power-ups within its range to you. Can't be used again until inventory is full.",
    // ... rest of syphon properties
}, {
    id: "centurion",
    name: "The Centurion",
    color: "#d35400",
    maxHP: 480,
    difficulty_tier: 3,
    archetype: 'field_control',
    unlock_level: 125,
    core_desc: "When a boss appears, four 'Containment Pylons' are summoned at the corners of the arena. Enemies near a pylon are briefly slowed and tethered.",
    // ... rest of centurion properties
}, {
    id: "fractal_horror",
    name: "The Fractal Horror",
    color: "#be2edd",
    maxHP: 10000,
    difficulty_tier: 3,
    archetype: 'swarm',
    unlock_level: 130,
    core_desc: "Every 10th enemy you defeat shatters into 3 smaller, friendly 'Fractal Bits' that aggressively seek out and damage enemies for a short time.",
    // ... rest of fractal_horror properties
}, {
    id: "obelisk",
    name: "The Obelisk",
    color: "#2c3e50",
    maxHP: 800,
    difficulty_tier: 3,
    archetype: 'field_control',
    unlock_level: 135,
    core_desc: "Gain a 'Conduit Charge' for every power-up you collect (max 3). When you take damage, one charge is consumed to negate it and release a shockwave.",
    // ... rest of obelisk properties
}, {
    id: "helix_weaver",
    name: "The Helix Weaver",
    color: "#e74c3c",
    maxHP: 500,
    difficulty_tier: 3,
    archetype: 'swarm',
    unlock_level: 140,
    core_desc: "Every 5 seconds, you release a single, slow-moving 'Helix Bolt' that spirals outwards from you, damaging any enemy it touches.",
    // ... rest of helix_weaver properties
}, {
    id: "epoch_ender",
    name: "The Epoch-Ender",
    color: "#bdc3c7",
    maxHP: 550,
    difficulty_tier: 3,
    archetype: 'aggressor',
    unlock_level: 145,
    core_desc: "If you would be killed by direct collision with a boss, you instead 'Rewind,' restoring your health and position from 2 seconds prior. 2-minute cooldown.",
    // ... rest of epoch_ender properties
}, {
    id: "shaper_of_fate",
    name: "The Shaper of Fate",
    color: "#f1c40f",
    maxHP: 600,
    difficulty_tier: 3,
    archetype: 'specialist',
    unlock_level: 150,
    core_desc: "At the start of each stage, three 'Runes of Fate' (Damage, Defense, Utility) appear. Collecting one grants you a powerful, stage-long buff.",
    // ... rest of shaper_of_fate properties
}, {
    id: "pantheon",
    name: "The Pantheon",
    color: "#ecf0f1",
    maxHP: 3000,
    difficulty_tier: 3,
    archetype: 'aggressor',
    unlock_level: 155,
    core_desc: "Your core is a nexus of possibilities. Every 60 seconds, it randomly attunes to a different Aberration Core that you have unlocked for the next minute.",
    // ... rest of pantheon properties
}
// ... (Make sure the final array bracket is here)
];

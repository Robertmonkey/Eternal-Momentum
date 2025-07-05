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
            utils.drawCircle(ctx, wellX, wellY, "rgba(155, 89, 182, 0.3)");
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
    description: "A terraforming intelligence that reshapes the arena with impassable pillars, forcing a battle within its own creation.",
    lore: "A terraforming intelligence from a world where reality was programmable. Its purpose was to build, to create stable structures from raw data. Now, its code corrupted by the Unraveling, it compulsively builds nonsensical, impassable prisons, trapping others in a desperate, fleeting attempt to impose order on the chaos that consumed it.",
    mechanics_desc: "Periodically reshapes the battlefield by creating impassable pillar formations. These pillars will block both your movement and projectiles. Be prepared to navigate tight corridors and restricted spaces.",
    init: b => {
        b.pillars = [];
        b.lastBuild = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (Date.now() - b.lastBuild > 8000) {
            b.lastBuild = Date.now();
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
        b.pillars.forEach(p => utils.drawCircle(ctx, p.x, p.y, p.r, "#444"));
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
    description: "An unstable being that defies spacetime, erratically teleporting across the arena.",
    lore: "An anomaly from a timeline that did not perceive time as linear. To this being, past, present, and future were all the same. The Unraveling has forced it into a linear existence, a state of being so alien and painful that it violently lurches between points in spacetime to escape the unbearable agony of 'now.'",
    mechanics_desc: "Teleports to a random location on the battlefield every few seconds. The teleportation frequency increases as it takes damage, making it a highly mobile and unpredictable target.",
    init: b => {
        b.lastTeleport = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const canvas = ctx.canvas;
        const interval = b.hp < b.maxHP * 0.25 ? 1500 : (b.hp < b.maxHP * 0.5 ? 2000 : 2500);
        if (Date.now() - b.lastTeleport > interval) {
            b.lastTeleport = Date.now();
            gameHelpers.play('mirrorSwap');
            utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
            b.x = Math.random() * canvas.width;
            b.y = Math.random() * canvas.height;
            utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
        }
    }
}, {
    id: "juggernaut",
    name: "The Juggernaut",
    color: "#636e72",
    maxHP: 360,
    difficulty_tier: 2,
    archetype: 'aggressor',
    description: "A relentless force of nature. It periodically charges with immense speed, growing faster as it takes damage.",
    lore: "A creature of pure, unstoppable biological drive from a world where evolution's only law was 'survival of the strongest.' As its reality decayed, it was locked in a perpetual charge against an enemy it could never reach: the Unraveling itself. The more its existence frays (as it takes damage), the more desperate and reckless its charge becomes.",
    mechanics_desc: "A highly aggressive boss that moves faster as its health gets lower. Periodically, it will stop and charge a high-speed dash towards you that is difficult to avoid and deals heavy collision damage.",
    init: b => {
        b.lastCharge = Date.now();
        b.isCharging = false;
        b.baseDx = (Math.random() - 0.5) * 0.5;
        b.baseDy = (Math.random() - 0.5) * 0.5;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const speedMultiplier = 1 + (1 - b.hp / b.maxHP) * 2.5;
        if (!b.isCharging) {
            b.dx = b.baseDx * speedMultiplier;
            b.dy = b.baseDy * speedMultiplier;
            if (Date.now() - b.lastCharge > 7000) {
                b.isCharging = true;
                b.dx = 0;
                b.dy = 0;
                state.effects.push({
                    type: 'juggernaut_charge_ring',
                    source: b,
                    startTime: Date.now(),
                    duration: 1000
                });
                gameHelpers.play('chargeUpSound');
                setTimeout(() => {
                    if (b.hp <= 0) return;
                    const target = (state.arenaMode && b.target) ? b.target : state.player;
                    const angle = Math.atan2(target.y - b.y, target.x - b.x);
                    b.dx = Math.cos(angle) * 15;
                    b.dy = Math.sin(angle) * 15;
                    utils.triggerScreenShake(150, 3);
                    gameHelpers.play('chargeDashSound');
                    setTimeout(() => {
                        b.isCharging = false;
                        b.lastCharge = Date.now();
                        b.baseDx = (Math.random() - 0.5) * 0.5;
                        b.baseDy = (Math.random() - 0.5) * 0.5;
                    }, 500);
                }, 1000);
            }
        } else {
            state.enemies.forEach(e => {
                if (e !== b && !e.boss) {
                    const dist = Math.hypot(b.x - e.x, b.y - e.y);
                    if (dist < b.r + e.r) {
                        const angle = Math.atan2(e.y - b.y, e.x - b.x);
                        e.dx = Math.cos(angle) * 10;
                        e.dy = Math.sin(angle) * 10;
                    }
                }
            });
        }
    }
}, {
    id: "puppeteer",
    name: "The Puppeteer",
    color: "#a29bfe",
    maxHP: 320,
    difficulty_tier: 2,
    archetype: 'swarm',
    description: "Corrupts lesser entities with its influence, turning your own enemies into powerful, puppeted minions.",
    lore: "Once a benevolent 'Dream Weaver,' this entity could soothe and guide the collective unconscious of its reality. The Unraveling inverted its abilities, transforming its guidance into corruption. It now 'converts' lesser beings, not to control them, but out of a twisted, instinctual loneliness, trying to rebuild a collective from the broken fragments it finds.",
    mechanics_desc: "Does not attack directly. Instead, it converts the farthest non-boss enemy on screen into a powerful, puppeted minion with increased health and speed. Eliminate its puppets quickly before their numbers become overwhelming.",
    init: b => {
        b.lastConvert = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (Date.now() - b.lastConvert > 1500) {
            let farthestEnemy = null;
            let maxDist = 0;
            state.enemies.forEach(e => {
                if (!e.boss && !e.isPuppet) {
                    const d = Math.hypot(b.x - e.x, b.y - e.y);
                    if (d > maxDist) {
                        maxDist = d;
                        farthestEnemy = e;
                    }
                }
            });
            if (farthestEnemy) {
                b.lastConvert = Date.now();
                gameHelpers.play('puppeteerConvert');
                farthestEnemy.isPuppet = true;
                farthestEnemy.customColor = b.color;
                farthestEnemy.r *= 1.5;
                farthestEnemy.hp = 80;
                farthestEnemy.dx *= 2;
                farthestEnemy.dy *= 2;
                state.effects.push({
                    type: 'transient_lightning',
                    x1: b.x, y1: b.y,
                    x2: farthestEnemy.x, y2: farthestEnemy.y,
                    color: b.color,
                    endTime: Date.now() + 200
                });
            }
        }
    },
    onDeath: (b, state, spawnEnemy, spawnParticles, play) => {
        play('magicDispelSound');
        state.enemies.forEach(e => {
            if (e.isPuppet) e.hp = 0;
        });
    }
}, {
    id: "glitch",
    name: "The Glitch",
    color: "#fd79a8",
    maxHP: 336,
    difficulty_tier: 2,
    archetype: 'specialist',
    description: "A living error in reality. Its erratic teleportation leaves behind unstable Glitch Zones that invert motor functions.",
    lore: "Not a being, but a living wound in spacetime where multiple corrupted data-streams from digital realities intersect. Its erratic movements are the result of conflicting positional data, and its very presence overwrites local physical laws, causing the sensory confusion you experience. It is an error message given lethal form.",
    mechanics_desc: "Erratic and unpredictable. It teleports frequently, leaving behind Glitch Zones on the ground. Entering a zone will temporarily invert your movement controls, so watch your positioning carefully.",
    hasCustomDraw: true,
    init: b => {
        b.lastTeleport = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const canvas = ctx.canvas;
        if (Date.now() - b.lastTeleport > 3000) {
            b.lastTeleport = Date.now();
            gameHelpers.play('glitchSound');
            utils.spawnParticles(state.particles, b.x, b.y, b.color, 40, 4, 30);
            const oldX = b.x;
            const oldY = b.y;
            b.x = Math.random() * canvas.width;
            b.y = Math.random() * canvas.height;
            state.effects.push({
                type: 'glitch_zone',
                x: oldX,
                y: oldY,
                r: 100,
                endTime: Date.now() + 5000
            });
        }
        const size = b.r * 0.4;
        for (let i = 0; i < 10; i++) {
            const glitchX = b.x + (Math.random() - 0.5) * b.r * 1.5;
            const glitchY = b.y + (Math.random() - 0.5) * b.r * 1.5;
            ctx.fillStyle = ['#fd79a8', '#81ecec', '#f1c40f'][Math.floor(Math.random() * 3)];
            ctx.fillRect(glitchX - size / 2, glitchY - size / 2, size, size);
        }
    },
    onDeath: (b, state) => {
        state.player.controlsInverted = false;
    }
}, {
    id: "sentinel_pair",
    name: "Sentinel Pair",
    color: "#f1c40f",
    maxHP: 400,
    difficulty_tier: 2,
    archetype: 'aggressor',
    description: "Two guardians locked in a deadly bond. They generate a lethal energy beam between them, forcing constant repositioning.",
    lore: "These guardians were forged to be the twin poles of a planetary shield generator. Their perfect symmetry and constant distance were the source of their world's protection. The Unraveling destroyed their planet but not them, locking them in a deadly dance where the energy beam that once protected their home has become a weapon of indiscriminate destruction.",
    mechanics_desc: "Two bosses that share a single health pool and are connected by a constant, lethal energy beam. The beam will damage you on contact. The bosses will attempt to reposition themselves to keep the beam on you.",
    hasCustomMovement: true,
    init: (b, state, spawnEnemy) => {
        if (!state.enemies.find(e => e.id === 'sentinel_pair' && e !== b)) {
            const partner = spawnEnemy(true, 'sentinel_pair');
            if (partner) {
                b.partner = partner;
                partner.partner = b;
            }
        }
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (b.partner && b.partner.hp > 0) {
            const P_VEC = {
                x: state.player.x - b.x,
                y: state.player.y - b.y
            };
            const PERP_VEC = {
                x: -P_VEC.y,
                y: P_VEC.x
            };
            const dist = Math.hypot(PERP_VEC.x, PERP_VEC.y) || 1;
            PERP_VEC.x /= dist;
            PERP_VEC.y /= dist;
            const offset = 200;
            const targetPos = {
                x: state.player.x + PERP_VEC.x * offset,
                y: state.player.y + PERP_VEC.y * offset
            };
            b.dx = (targetPos.x - b.x) * 0.01;
            b.dy = (targetPos.y - b.y) * 0.01;
            const partnerDist = Math.hypot(b.x - b.partner.x, b.y - b.partner.y);
            if (partnerDist < 300) {
                b.dx -= (b.partner.x - b.x) * 0.01;
                b.dy -= (b.partner.y - b.y) * 0.01;
            }
            if (!b.frozen) {
                b.x += b.dx;
                b.y += b.dy;
            }
            if (!b.frozen && !b.partner.frozen) {
                const p1 = b;
                const p2 = b.partner;
                utils.drawLightning(ctx, p1.x, p1.y, p2.x, p2.y, b.color, 5);
                const L2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
                if (L2 !== 0) {
                    let t = ((state.player.x - p1.x) * (p2.x - p1.x) + (state.player.y - p1.y) * (p2.y - p1.y)) / L2;
                    t = Math.max(0, Math.min(1, t));
                    const closestX = p1.x + t * (p2.x - p1.x);
                    const closestY = p1.y + t * (p2.y - p1.y);
                    const allTargets = state.arenaMode ? [state.player, ...state.enemies.filter(t => t !== p1 && t !== p2)] : [state.player];
                    allTargets.forEach(target => {
                        const isPlayer = target === state.player;
                        const isAlive = isPlayer ? target.health > 0 : target.hp > 0;
                        if (isAlive && Math.hypot(target.x - closestX, target.y - closestY) < target.r + 5) {
                            let damage = (state.player.berserkUntil > Date.now()) ? 2 : 1;
                            if (isPlayer && state.player.shield) return;
                            if (isPlayer) {
                                target.health -= damage;
                                if (target.health <= 0) state.gameOver = true;
                            } else {
                                target.hp -= damage;
                            }
                        }
                    });
                }
                gameHelpers.playLooping('beamHumSound');
            } else {
                gameHelpers.stopLoopingSfx('beamHumSound');
            }
        }
    },
    onDeath: (b, state, spawnEnemy, spawnParticles, play, stopLoopingSfx) => {
        stopLoopingSfx('beamHumSound');
        if (b.partner) b.partner.hp = 0;
    },
    onDamage: (b, dmg) => {
        if (b.partner) {
            b.partner.hp -= dmg;
            b.hp = b.partner.hp;
        }
    }
}, {
    id: "basilisk",
    name: "The Basilisk",
    color: "#00b894",
    maxHP: 384,
    difficulty_tier: 2,
    archetype: 'field_control',
    description: "Its presence crystallizes spacetime, generating expanding Stasis Fields that petrify any who linger within.",
    lore: "The collective memory of a race that had transcended physical form, existing as living history. To prevent their memories from being erased by the Unraveling, they attempted to crystallize their entire timeline into a static, unchanging moment. They are now trapped in that moment, their very presence slowing spacetime to a crawl as a defense mechanism.",
    mechanics_desc: "Generates large Stasis Fields in the four quadrants of the arena that grow larger as the Basilisk loses health. Standing inside an active field will rapidly build a stun meter; if it fills, you will be petrified for a few seconds.",
    init: (b, state, spawnEnemy, canvas) => {
        b.petrifyZones = [];
        const w = canvas.width;
        const h = canvas.height;
        const centers = [
            { x: w / 4, y: h / 4 }, { x: w * 3 / 4, y: h / 4 },
            { x: w / 4, y: h * 3 / 4 }, { x: w * 3 / 4, y: h * 3 / 4 }
        ];
        centers.forEach(center => {
            b.petrifyZones.push({
                x: center.x,
                y: center.y,
                sizeW: 0,
                sizeH: 0,
                playerInsideTime: null
            });
        });
    },
    logic: (b, ctx, state) => {
        const canvas = ctx.canvas;
        const hpPercent = Math.max(0, b.hp / b.maxHP);
        const growthRange = 1.0 - 0.3; 
        const currentGrowthProgress = 1.0 - hpPercent;
        const scaledGrowth = Math.min(1.0, currentGrowthProgress / growthRange);

        const w = canvas.width;
        const h = canvas.height;
        const maxSizeW = w / 2;
        const maxSizeH = h / 2;
        
        b.petrifyZones.forEach(zone => {
            zone.sizeW = maxSizeW * scaledGrowth;
            zone.sizeH = maxSizeH * scaledGrowth;
        });
    }
}, {
    id: "annihilator",
    name: "The Annihilator",
    color: "#d63031",
    maxHP: 480,
    difficulty_tier: 2,
    archetype: 'field_control',
    description: "Creates an unassailable Obelisk and unleashes an Annihilation Beam that erases anything not shielded by the pillar's shadow.",
    lore: "In its timeline, the Obelisk was a monument of salvation—a device that could cast a 'reality shadow' to shield its world from the Unraveling. The Annihilator was its sworn guardian. When the Obelisk failed, the guardian's mind shattered, inverting its purpose. It now endlessly recreates its catastrophic failure, attempting to erase the universe that its sacred pillar could not save.",
    mechanics_desc: "Creates a permanent, impassable Obelisk in the center of the arena. It will periodically charge and fire an arena-wide Annihilation Beam. The Obelisk is the only safe place; use it to block the beam's line of sight.",
    init: (b, state, spawnEnemy, canvas) => {
        b.lastBeam = Date.now();
        b.isChargingBeam = false;
        b.pillar = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            r: 75
        };
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (Date.now() - b.lastBeam > 12000 && !b.isChargingBeam) {
            b.isChargingBeam = true;
            if (b.activeAspects) b.activeAspects.forEach(aspect => {
                if (aspect.id === 'annihilator') b.isChargingAnnihilatorBeam = true;
            });

            gameHelpers.play('powerSirenSound');
            setTimeout(() => {
                if(b.hp <= 0) {
                    if (b.activeAspects) b.activeAspects.forEach(aspect => {
                        if (aspect.id === 'annihilator') b.isChargingAnnihilatorBeam = false;
                    });
                    return;
                }
                gameHelpers.play('annihilatorBeamSound');
                state.effects.push({
                    type: 'annihilator_beam',
                    source: b,
                    pillar: { ...b.pillar },
                    endTime: Date.now() + 1200
                });
                b.lastBeam = Date.now();
                b.isChargingBeam = false;
                if (b.activeAspects) b.activeAspects.forEach(aspect => {
                    if (aspect.id === 'annihilator') b.isChargingAnnihilatorBeam = false;
                });
            }, 4000);
        }
        if (b.pillar) {
            utils.drawCircle(ctx, b.pillar.x, b.pillar.y, b.pillar.r, "#2d3436");
            const bossDist = Math.hypot(b.x - b.pillar.x, b.y - b.pillar.y);
            if (bossDist < b.r + b.pillar.r) {
                const angle = Math.atan2(b.y - b.pillar.y, b.x - b.pillar.x);
                b.x = b.pillar.x + Math.cos(angle) * (b.r + b.pillar.r);
                b.y = b.pillar.y + Math.sin(angle) * (b.r + b.pillar.r);
            }
        }
    },
    onDeath: b => {
        setTimeout(() => {
            if (!b.activeAspects || !b.activeAspects.has('annihilator')) {
                b.pillar = null;
            }
        }, 2000);
    }
}, {
    id: "parasite",
    name: "The Parasite",
    color: "#55efc4",
    maxHP: 416,
    difficulty_tier: 2,
    archetype: 'swarm',
    description: "A virulent entity that spreads a debilitating infection on contact, causing its host to spawn hostile spores.",
    lore: "From a virulent ecosystem where every lifeform was a host for another, this being was the apex of symbiosis. When its timeline collapsed, it was left alone. It now seeks to spread its 'gift' of infection, desperately trying to create a new symbiotic ecosystem to escape the crushing silence of solitude.",
    mechanics_desc: "Inflicts a long-lasting Infection on contact with you or other enemies. While you are infected, you will periodically spawn hostile spores from your own body. The Infection spreads between enemies on contact.",
    onCollision: (b, p, addStatusEffect) => {
        if (!p.infected) addStatusEffect('Infected', '☣️', 10000);
        p.infected = true;
        p.infectionEnd = Date.now() + 10000;
        p.lastSpore = Date.now();
    },
    logic: (b, ctx, state) => {
        state.enemies.forEach(e => {
            if (e !== b && !e.boss && !e.isInfected) {
                const dist = Math.hypot(b.x - e.x, b.y - e.y);
                if (dist < b.r + e.r) {
                    e.isInfected = true;
                    e.infectionEnd = Date.now() + 10000;
                    e.lastSpore = Date.now();
                }
            }
        });
    },
    onDeath: (b, state) => {
        state.player.infected = false;
    }
}, {
    id: "quantum_shadow",
    name: "Quantum Shadow",
    color: "#81ecec",
    maxHP: 360,
    difficulty_tier: 2,
    archetype: 'specialist',
    description: "Phases between realities, creating quantum echoes of itself. It is only vulnerable when it collapses its wave function to a single location.",
    lore: "This entity existed in a state of quantum superposition, a being of pure potential spread across all possibilities. The Unraveling is forcing it to collapse into a single, defined state—a process that is the conceptual equivalent of death for it. It flickers between its potential forms, only becoming truly 'real' and vulnerable for brief, agonizing moments.",
    mechanics_desc: "Phasing in and out of reality makes it invulnerable for long periods. It will periodically create multiple echoes of itself before collapsing its wave function to the location of one of them. It is only vulnerable for a short time after collapsing. The other echoes will explode.",
    hasCustomDraw: true,
    init: b => {
        b.phase = 'seeking';
        b.lastPhaseChange = Date.now();
        b.echoes = [];
        b.invulnerable = false;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const canvas = ctx.canvas;
        if (b.phase === 'seeking' && Date.now() - b.lastPhaseChange > 7000) {
            b.phase = 'superposition';
            b.lastPhaseChange = Date.now();
            b.invulnerable = true;
            gameHelpers.play('phaseShiftSound');

            const missingHealthPercent = 1 - (b.hp / b.maxHP);
            const extraEchoes = Math.floor(missingHealthPercent * 10);
            const totalEchoes = 3 + extraEchoes;
            b.echoes = [];
            
            const placedEchoes = [];
            for (let i = 0; i < totalEchoes; i++) {
                let bestCandidate = null;
                let maxMinDist = -1;

                if (placedEchoes.length === 0) {
                    bestCandidate = { x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: b.r };
                } else {
                    for (let j = 0; j < 10; j++) {
                        const candidate = { x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: b.r };
                        let minDistanceToPlaced = Infinity;

                        placedEchoes.forEach(placed => {
                            const dist = Math.hypot(candidate.x - placed.x, candidate.y - placed.y);
                            if (dist < minDistanceToPlaced) {
                                minDistanceToPlaced = dist;
                            }
                        });
                        
                        if (minDistanceToPlaced > maxMinDist) {
                            maxMinDist = minDistanceToPlaced;
                            bestCandidate = candidate;
                        }
                    }
                }
                placedEchoes.push(bestCandidate);
                b.echoes.push(bestCandidate);
            }
        } else if (b.phase === 'superposition') {
            ctx.globalAlpha = 0.5;
            utils.drawCircle(ctx, b.x, b.y, b.r, b.color);
            ctx.globalAlpha = 1;
            b.echoes.forEach(e => {
                ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 200) * 0.2;
                utils.drawCircle(ctx, e.x, e.y, e.r, b.color);
                ctx.globalAlpha = 1;
            });
            if (Date.now() - b.lastPhaseChange > 3000) {
                b.phase = 'seeking';
                b.lastPhaseChange = Date.now();
                b.invulnerable = false;
                const targetEcho = b.echoes.splice(Math.floor(Math.random() * b.echoes.length), 1)[0];
                b.x = targetEcho.x;
                b.y = targetEcho.y;
                b.echoes.forEach(e => {
                    utils.spawnParticles(state.particles, e.x, e.y, '#ff4757', 50, 6, 40);
                    state.effects.push({
                        type: 'shockwave',
                        caster: b,
                        x: e.x,
                        y: e.y,
                        radius: 0,
                        maxRadius: 250,
                        speed: 600,
                        startTime: Date.now(),
                        hitEnemies: new Set(),
                        damage: 60
                    });
                });
                b.echoes = [];
            }
        }
        if (!b.invulnerable) {
            utils.drawCircle(ctx, b.x, b.y, b.r, b.color);
        }
    },
    onDamage: (b, dmg) => {
        if (b.invulnerable) b.hp += dmg;
    }
}, {
    id: "time_eater",
    name: "Time Eater",
    color: "#dfe6e9",
    maxHP: 440,
    difficulty_tier: 2,
    archetype: 'field_control',
    description: "Devours time, creating zones of temporal distortion that drastically slow all matter and consume any powers or entities within.",
    lore: "In a timeline where time itself was a consumable resource, this creature was a predator that fed on moments to sustain its existence. Now that its native temporal stream has been devoured by the Unraveling, it is ravenous, creating pockets of distorted time to 'tenderize' reality before consuming it and anything caught within.",
    mechanics_desc: "Creates multiple zones of temporal distortion that drift around the arena. These zones will drastically slow you, your projectiles, and any enemies inside them. Power-ups that drift into these zones will be consumed, healing the boss.",
    init: b => {
        b.lastAbility = Date.now();
    },
    logic: (b, ctx, state, utils) => {
        const canvas = ctx.canvas;
        if (Date.now() - b.lastAbility > 5000) {
            b.lastAbility = Date.now();
            for (let i = 0; i < 4; i++) {
                state.effects.push({
                    type: 'slow_zone',
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: 150,
                    endTime: Date.now() + 6000
                });
            }
        }
    }
}, {
    id: "singularity",
    name: "The Singularity",
    color: "#000000",
    maxHP: 600,
    difficulty_tier: 2,
    archetype: 'specialist',
    description: "The convergence of multiple timelines. Its combat patterns are an unpredictable amalgamation of other powerful entities.",
    lore: "The focal point where a dozen timelines collapsed simultaneously. It is not a single entity but a chaotic amalgamation—the gravitational pull of the Gravity Tyrant, the teleporting agony of the Looping Eye, the infectious despair of the Parasite. It is a legion of lost worlds condensed into a single point of failure.",
    mechanics_desc: "A multi-phase encounter that mimics other bosses. Its abilities will change as its health is depleted, incorporating mechanics from the Gravity Tyrant, The Glitch, and The Parasite in increasingly dangerous combinations.",
    init: (b, state, spawnEnemy) => {
        b.phase = 1;
        b.lastAction = 0;
        b.wells = [];
        b.beamTarget = null;
        b.teleportingAt = null;
        b.teleportTarget = null;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const canvas = ctx.canvas;
        const hpPercent = b.hp / b.maxHP;

        if (b.beamTarget && Date.now() > b.lastAction + 1000) {
            b.beamTarget = null;
        }

        if (hpPercent <= 0.33 && b.phase < 3) {
            b.phase = 3;
            gameHelpers.play('finalBossPhaseSound');
            utils.triggerScreenShake(500, 15);
            utils.spawnParticles(state.particles, b.x, b.y, "#d63031", 150, 8, 50);
            b.lastAction = Date.now();
            b.wells = [];
        } else if (hpPercent <= 0.66 && b.phase < 2) {
            b.phase = 2;
            gameHelpers.play('finalBossPhaseSound');
            utils.triggerScreenShake(500, 10);
            utils.spawnParticles(state.particles, b.x, b.y, "#6c5ce7", 150, 8, 50);
            b.lastAction = Date.now();
            b.wells = [];
        }
        
        switch (b.phase) {
            case 1:
                if (Date.now() - b.lastAction > 5000) {
                    b.lastAction = Date.now();
                    b.wells = [];
                    for (let i = 0; i < 4; i++) {
                        b.wells.push({
                            x: Math.random() * canvas.width,
                            y: Math.random() * canvas.height,
                            r: 40,
                            endTime: Date.now() + 4000
                        });
                    }
                }
                b.wells.forEach(w => {
                    if (Date.now() < w.endTime) {
                        utils.drawCircle(ctx, w.x, w.y, w.r, "rgba(155, 89, 182, 0.3)");
                        const dx = state.player.x - w.x,
                            dy = state.player.y - w.y;
                        if (Math.hypot(dx, dy) < w.r + state.player.r) {
                            state.player.x -= dx * 0.08;
                            state.player.y -= dy * 0.08;
                        }
                    }
                });
                break;
            case 2:
                if (Date.now() - b.lastAction > 4000) {
                    b.lastAction = Date.now();
                    state.effects.push({
                        type: 'glitch_zone',
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        r: 100,
                        endTime: Date.now() + 3000
                    });
                    b.beamTarget = { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
                }
                break;
            case 3:
                if (!b.teleportingAt && Date.now() - b.lastAction > 2000) {
                    b.teleportingAt = Date.now() + 1000;
                    const targetX = Math.random() * canvas.width;
                    const targetY = Math.random() * canvas.height;
                    b.teleportTarget = { x: targetX, y: targetY };
                    state.effects.push({ type: 'teleport_indicator', x: targetX, y: targetY, r: b.r, endTime: b.teleportingAt });
                }
                if (b.teleportingAt && Date.now() > b.teleportingAt) {
                    utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
                    b.x = b.teleportTarget.x;
                    b.y = b.teleportTarget.y;
                    utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
                    b.teleportingAt = null;
                    b.lastAction = Date.now();
                    for (let i = 0; i < 3; i++) {
                        const spore = gameHelpers.spawnEnemy(false, null, {
                            x: b.x,
                            y: b.y
                        });
                        if (spore) {
                            spore.r = 10;
                            spore.hp = 1;
                            spore.dx = (Math.random() - 0.5) * 8;
                            spore.dy = (Math.random() - 0.5) * 8;
                            spore.ignoresPlayer = true;
                        }
                    }
                }
                break;
        }

        if (b.beamTarget) {
            utils.drawLightning(ctx, b.x, b.y, b.beamTarget.x, b.beamTarget.y, '#fd79a8', 8);
            const p1 = b, p2 = b.beamTarget, p3 = state.player; const L2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
            if (L2 !== 0) {
                let t = ((p3.x - p1.x) * (p2.x - p1.x) + (p3.y - p1.y) * (p2.y - p1.y)) / L2; t = Math.max(0, Math.min(1, t));
                const closestX = p1.x + t * (p2.x - p1.x); const closestY = p1.y + t * (p2.y - p1.y);
                if (Math.hypot(p3.x - closestX, p3.y - closestY) < p3.r + 5) { 
                    if (state.player.shield) { 
                        state.player.shield = false; 
                        gameHelpers.play('shieldBreak'); 
                    } else { 
                        state.player.health -= 2; 
                        if (state.player.health <= 0) state.gameOver = true;
                    } 
                }
            }
        }
    }
}, {
    id: "miasma",
    name: "The Miasma",
    color: "#6ab04c",
    maxHP: 400,
    difficulty_tier: 3,
    archetype: 'field_control',
    description: "Fills the arena with a toxic Miasma, dealing constant damage unless its purifying vents are overloaded.",
    lore: "The collective consciousness of a vibrant forest-world that, in its final moments, attempted to merge with its own toxic flora to survive the Unraveling. The attempt failed, leaving only a cycle of poison and purification. It suffocates the arena with its toxic grief, and only by overloading the last remnants of its purifying vents can you make it vulnerable.",
    mechanics_desc: "Periodically fills the entire arena with a toxic gas that deals constant damage to you. To stop the gas, you must lure the Miasma near one of the four purifying vents and damage the vent while the boss is on top of it. While the gas is active, the Miasma is immune to damage.",
    init: (b, state, spawnEnemy, canvas) => {
        b.vents = [{x: canvas.width * 0.2, y: canvas.height * 0.2}, {x: canvas.width * 0.8, y: canvas.height * 0.2}, {x: canvas.width * 0.2, y: canvas.height * 0.8}, {x: canvas.width * 0.8, y: canvas.height * 0.8}].map(v => ({...v, cooldownUntil: 0}));
        b.isGasActive = false;
        b.lastGasAttack = Date.now();
        b.isChargingSlam = false;
    },
    hasCustomDraw: true,
    hasCustomMovement: true,
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (!b.frozen) {
            const target = state.player;
            const vx = (target.x - b.x) * 0.005;
            const vy = (target.y - b.y) * 0.005;
            b.x += vx;
            b.y += vy;
        }
        
        const pulsatingSize = b.r + Math.sin(Date.now() / 300) * 5;
        utils.drawCircle(ctx, b.x, b.y, pulsatingSize, b.isGasActive ? '#6ab04c' : '#a4b0be');
        
        b.vents.forEach(v => {
            const isOnCooldown = Date.now() < v.cooldownUntil;
            const color = isOnCooldown ? 'rgba(127, 140, 141, 0.4)' : '#7f8c8d';
            
            if (b.isGasActive && !isOnCooldown) {
                const pulse = Math.abs(Math.sin(Date.now() / 200));
                ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.3})`;
                ctx.beginPath();
                ctx.arc(v.x, v.y, 30 + pulse * 10, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            utils.drawCrystal(ctx, v.x, v.y, 30, color);
        });
        
        ctx.globalAlpha = 1.0;
        if (!b.isGasActive && Date.now() - b.lastGasAttack > 10000) {
            b.isGasActive = true;
            state.effects.push({ type: 'miasma_gas', endTime: Date.now() + 99999, id: b.id });
            gameHelpers.play('miasmaGasRelease');
        }
        if (b.isGasActive && !b.isChargingSlam) {
            b.isChargingSlam = true;
            state.effects.push({ type: 'charge_indicator', source: b, duration: 2000, radius: 120, color: 'rgba(106, 176, 76, 0.5)' });
            gameHelpers.play('chargeUpSound');
            setTimeout(() => {
                if (!state.enemies.includes(b)) return;
                if (b.hp <= 0) return;
                gameHelpers.play('miasmaSlam');
                utils.spawnParticles(state.particles, b.x, b.y, '#6ab04c', 50, 4, 30);
                b.vents.forEach(v => {
                    if (Date.now() > v.cooldownUntil && Math.hypot(b.x - v.x, b.y - v.y) < 120) {
                        v.cooldownUntil = Date.now() + 10000;
                        b.isGasActive = false;
                        state.effects = state.effects.filter(e => e.type !== 'miasma_gas' || e.id !== b.id);
                        b.lastGasAttack = Date.now();
                        gameHelpers.play('ventPurify');
                        utils.spawnParticles(state.particles, v.x, v.y, '#ffffff', 100, 6, 50, 5);
                        state.effects.push({ type: 'shockwave', caster:b, x: v.x, y: v.y, radius: 0, maxRadius: 400, speed: 1200, startTime: Date.now(), damage: 0, hitEnemies: new Set() });
                    }
                });
                b.isChargingSlam = false;
            }, 2000);
        }
    },
    onDamage: (b, dmg) => { if (b.isGasActive) b.hp += dmg; },
    onDeath: (b, state) => { state.effects = state.effects.filter(e => e.type !== 'miasma_gas' || e.id !== b.id); }
}, {
    id: "temporal_paradox",
    name: "The Temporal Paradox",
    color: "#81ecec",
    maxHP: 420,
    difficulty_tier: 3,
    archetype: 'specialist',
    description: "This Aberration weaponizes causality by pulling your own movements from parallel timelines. These after-images are not ghosts; they are tangible matter from another reality. Occupying the same space as one of these echoes will create a fatal paradox.",
    lore: "Once a 'historian' entity that could perceive and walk through its own past, it tried to flee the Unraveling by hiding in a previous point in its own timeline. The Unraveling followed, corrupting its ability. Now, it doesn't leave an echo of its own past, but rips a lethal 'snapshot' of YOURS from a parallel reality and forces it into the present.",
    mechanics_desc: "The Paradox periodically creates a 'Paradox Echo,' a recording of your recent movements. The echo will then replay your path, leaving a deadly, damaging trail behind it. You must avoid your own ghost and its trail at all costs.",
    hasCustomDraw: true,
    init: (b) => {
        b.playerHistory = [];
        b.lastEcho = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (state.player) {
            b.playerHistory.push({x: state.player.x, y: state.player.y, time: Date.now()});
            b.playerHistory = b.playerHistory.filter(p => Date.now() - p.time < 5000);
        }
        if (Date.now() - b.lastEcho > 8000) {
            b.lastEcho = Date.now();
            gameHelpers.play('phaseShiftSound');
            const historyToReplay = [...b.playerHistory];
            state.effects.push({ type: 'paradox_echo', history: historyToReplay, startTime: Date.now(), trail: [], playerR: state.player.r });
            gameHelpers.playLooping('paradoxTrailHum');
        }
        ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 200) * 0.2;
        utils.drawCircle(ctx, b.x, b.y, b.r, b.color);
        for(let i = 0; i < 3; i++) {
            const offset = (i - 1) * 5;
            ctx.globalAlpha = 0.3;
            utils.drawCircle(ctx, b.x + offset, b.y, b.r, ['#ff4757', '#3498db', '#ffffff'][i]);
        }
        ctx.globalAlpha = 1;
    },
    onDeath: (b, state, sE, sP, play, stopLoopingSfx) => {
        stopLoopingSfx('paradoxTrailHum');
        play('paradoxShatter');
        state.effects = state.effects.filter(e => e.type !== 'paradox_echo');
    }
}, {
    id: "syphon",
    name: "The Syphon",
    color: "#9b59b6",
    maxHP: 450,
    difficulty_tier: 3,
    archetype: 'specialist',
    description: "Targets and drains power directly, stealing your most powerful offensive ability and unleashing a corrupted version of it.",
    lore: "In its universe, abstract concepts like knowledge and power were tangible energies that could be 'siphoned.' This Aberration was a librarian-priest, a guardian of sacred powers. Corrupted by the Unraveling, its instinct to 'archive' has become a hungry desire to steal and corrupt the powers of others, unleashing twisted versions of their own strengths.",
    mechanics_desc: "Targets you with a telegraphed cone attack. If you are hit, it will steal your primary offensive power-up and unleash a powerful, corrupted version of it. Evade the cone to protect your abilities.",
    init: (b) => { b.lastSyphon = Date.now(); b.isCharging = false; },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (!b.isCharging && Date.now() - b.lastSyphon > 7500) {
            b.isCharging = true;
            b.lastSyphon = Date.now();
            gameHelpers.play('chargeUpSound');
            const targetAngle = Math.atan2(state.player.y - b.y, state.player.x - b.x);
            state.effects.push({ type: 'syphon_cone', source: b, angle: targetAngle, endTime: Date.now() + 2500 });
            setTimeout(() => {
                if (b.hp <= 0) return;
                b.isCharging = false;
            }, 2500);
        }
    }
}, {
    id: "centurion",
    name: "The Centurion",
    color: "#d35400",
    maxHP: 480,
    difficulty_tier: 3,
    archetype: 'field_control',
    description: "Constructs a shrinking prison of energy walls, forcing a desperate battle in an ever-constricting space.",
    lore: "The warden of a prison reality designed to contain conceptual threats. Its walls were made of absolute law. When the Unraveling broke the prison from the outside, the Centurion's logic shattered. It now identifies everything, including you and itself, as a threat to be contained, relentlessly shrinking its prison of light in an attempt to enforce an order that no longer exists.",
    mechanics_desc: "Periodically summons a massive, shrinking energy box that traps you inside. The box has a single, randomly placed gap for you to escape through before it fully constricts.",
    init: (b) => {
        b.lastWallSummon = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (Date.now() - b.lastWallSummon > 12000) {
            b.lastWallSummon = Date.now();
            gameHelpers.play('wallSummon');
            const boxSize = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.8;
            state.effects.push({
                type: 'shrinking_box',
                startTime: Date.now(),
                duration: 6000,
                x: state.player.x,
                y: state.player.y,
                initialSize: boxSize,
                gapSide: Math.floor(Math.random() * 4),
                gapPosition: Math.random()
            });
        }
    },
    onDeath: (b, state, sE, sP, play, stopLoopingSfx) => {
        stopLoopingSfx('wallShrink');
        state.effects = state.effects.filter(e => e.type !== 'shrinking_box');
    }
}, {
    id: "fractal_horror",
    name: "The Fractal Horror",
    color: "#be2edd",
    maxHP: 10000,
    difficulty_tier: 3,
    archetype: 'swarm',
    description: "A being of infinite complexity that splits into smaller, autonomous fragments as it takes damage, overwhelming its foe with sheer numbers.",
    lore: "This being was once a 'Mathematician,' an entity that perceived all of existence as a single, elegant equation. In a desperate attempt to comprehend the Unraveling—a variable it could not solve—it began to recursively analyze its own consciousness. The process never stopped. It is now an equation devouring itself, an infinite fractal of self-doubt given monstrous form. The whole is the sum of its broken parts.",
    mechanics_desc: "Shares a single, massive health pool among all its fragments. As its health depletes, the largest fragments will split into smaller, more numerous copies. The swarm's movement patterns will shift between surrounding you and aggressively attacking.",
    hasCustomMovement: true,
    hasCustomDraw: true,
    init: (b, state) => {
        if (state.fractalHorrorSharedHp === undefined) {
            state.fractalHorrorSharedHp = b.maxHP;
            state.fractalHorrorSplits = 0;
            state.fractalHorrorAi = {
                state: 'positioning',
                attackTarget: null,
                lastStateChange: Date.now()
            };
        }
        b.r = 110;
        b.generation = b.generation || 1;
        delete b.aiState;
        delete b.aiTimer;
        delete b.attackTarget;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (state.fractalHorrorSharedHp !== undefined) {
            b.hp = state.fractalHorrorSharedHp;
        }
        if (b.hp <= 0 || !state.fractalHorrorAi) return;

        const target = state.player;
        let allFractals = state.enemies.filter(e => e.id === 'fractal_horror');
        const hpPercent = state.fractalHorrorSharedHp / b.maxHP;
        const expectedSplits = Math.floor((1 - hpPercent) / 0.02);
        
        while (expectedSplits > state.fractalHorrorSplits && allFractals.length < 50) {
            let biggestFractal = allFractals.sort((a, b) => b.r - a.r)[0];
            if (!biggestFractal) break;

            gameHelpers.play('fractalSplit');
            utils.spawnParticles(state.particles, biggestFractal.x, biggestFractal.y, biggestFractal.color, 25, 3, 20);

            const newRadius = biggestFractal.r / Math.SQRT2;
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const child = gameHelpers.spawnEnemy(true, 'fractal_horror', {
                    x: biggestFractal.x + Math.cos(angle) * biggestFractal.r * 0.25,
                    y: biggestFractal.y + Math.sin(angle) * biggestFractal.r * 0.25
                });
                if (child) {
                    child.r = newRadius;
                    child.generation = biggestFractal.generation + 1;
                }
            }
            biggestFractal.hp = 0;
            state.fractalHorrorSplits++;
            allFractals = state.enemies.filter(e => e.id === 'fractal_horror');
        }

        const myIndex = allFractals.indexOf(b);
        const isLeader = myIndex === 0;

        if (isLeader) {
            const now = Date.now();
            const timeInState = now - state.fractalHorrorAi.lastStateChange;
            if (state.fractalHorrorAi.state === 'positioning' && timeInState > 4000) {
                state.fractalHorrorAi.state = 'attacking';
                state.fractalHorrorAi.attackTarget = { x: target.x, y: target.y };
                state.fractalHorrorAi.lastStateChange = now;
            } else if (state.fractalHorrorAi.state === 'attacking' && timeInState > 5000) {
                state.fractalHorrorAi.state = 'positioning';
                state.fractalHorrorAi.attackTarget = null;
                state.fractalHorrorAi.lastStateChange = now;
            }
        }
        
        if (!b.frozen) {
            let baseVelX, baseVelY;

            if (state.fractalHorrorAi.state === 'positioning') {
                if (myIndex !== -1) {
                    const totalFractals = allFractals.length;
                    const surroundRadius = 350 + totalFractals * 12;

                    const targetAngle = (myIndex / totalFractals) * 2 * Math.PI;
                    const targetX = target.x + surroundRadius * Math.cos(targetAngle);
                    const targetY = target.y + surroundRadius * Math.sin(targetAngle);
                    
                    baseVelX = (targetX - b.x) * 0.02;
                    baseVelY = (targetY - b.y) * 0.02;

                    allFractals.forEach(other => {
                        if (b === other) return;
                        const dist = Math.hypot(b.x - other.x, b.y - other.y);
                        const spacing = (b.r + other.r) * 0.8;
                        if (dist < spacing) {
                            const angle = Math.atan2(b.y - other.y, b.x - other.x);
                            const force = (spacing - dist) * 0.1;
                            b.x += Math.cos(angle) * force;
                            b.y += Math.sin(angle) * force;
                        }
                    });
                }
            } else if (state.fractalHorrorAi.state === 'attacking') {
                const attackTarget = state.fractalHorrorAi.attackTarget;
                if (attackTarget) {
                    const pullMultiplier = 0.015;

                    const vecX = attackTarget.x - b.x;
                    const vecY = attackTarget.y - b.y;
                    const dist = Math.hypot(vecX, vecY) || 1;
                    
                    const swirlForce = dist * 0.03;

                    const pullX = vecX * pullMultiplier;
                    const pullY = vecY * pullMultiplier;
                    
                    const perpX = -vecY / dist;
                    const perpY =  vecX / dist;
                    const spiralDirection = myIndex % 2 === 0 ? 1 : -1;
                    const swirlX = perpX * swirlForce * spiralDirection;
                    const swirlY = perpY * swirlForce * spiralDirection;

                    baseVelX = pullX + swirlX;
                    baseVelY = pullY + swirlY;
                }
            }

            const distToPlayer = Math.hypot(b.x - state.player.x, b.y - state.player.y);
            const safetyRadius = 600;
            let slowingMultiplier = 1.0;

            if (distToPlayer < safetyRadius) {
                slowingMultiplier = Math.max(0.01, (distToPlayer / safetyRadius)**2);
            }
            
            if (baseVelX) b.x += baseVelX * slowingMultiplier;
            if (baseVelY) b.y += baseVelY * slowingMultiplier;
        }
        
        utils.drawCircle(ctx, b.x, b.y, b.r, b.color);

        if (b.frozen) {
            ctx.fillStyle = "rgba(173, 216, 230, 0.4)";
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, 2 * Math.PI);
            ctx.fill();
        }
    },
    onDamage: (b, dmg, source, state) => {
        if (state.fractalHorrorSharedHp !== undefined) {
            state.fractalHorrorSharedHp -= dmg;
        }
    },
    onDeath: (b, state) => {
        const remaining = state.enemies.filter(e => e.id === 'fractal_horror' && e !== b);
        if (remaining.length === 0) {
            delete state.fractalHorrorSharedHp;
            delete state.fractalHorrorSplits;
            delete state.fractalHorrorAi;
        }
    }
}, {
    id: "obelisk",
    name: "The Obelisk",
    color: "#2c3e50",
    maxHP: 800,
    difficulty_tier: 3,
    archetype: 'field_control',
    description: "An invulnerable monument powered by three remote Conduits. It cannot be damaged until its power sources are severed.",
    lore: "An automated planetary defense system from a hyper-advanced civilization. The central Obelisk was invulnerable, powered by three remote Conduits that drew energy from different dimensions. The Unraveling severed the Obelisk's connection to its masters, leaving it to run its final, frantic defense protocol on an endless loop against a threat it cannot comprehend.",
    mechanics_desc: "An invulnerable boss powered by three orbital Conduits. You cannot damage the Obelisk until all three Conduits are destroyed. Each Conduit has its own unique attack pattern and aura effect. Once the conduits are gone, the Obelisk becomes vulnerable and will attack with a sweeping beam.",
    hasCustomDraw: true,
    hasCustomMovement: true,
    init: (b, state, spawnEnemy, canvas) => {
        b.x = canvas.width / 2;
        b.y = canvas.height / 2;
        b.invulnerable = true;
        b.conduits = [];
        b.beamAngle = 0;
        b.isFiringBeam = false;
        b.beamColors = ['#f1c40f', '#9b59b6', '#e74c3c'];
        
        const conduitTypes = [
            { type: 'lightning', color: '#f1c40f' },
            { type: 'gravity', color: '#9b59b6' },
            { type: 'explosion', color: '#e74c3c' }
        ];

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * 2 * Math.PI;
            const conduit = spawnEnemy(true, 'obelisk_conduit', {x: b.x + Math.cos(angle) * 250, y: b.y + Math.sin(angle) * 250});
            if (conduit) {
                conduit.parentObelisk = b;
                conduit.conduitType = conduitTypes[i].type;
                conduit.color = conduitTypes[i].color;
                conduit.orbitalAngle = angle;
                conduit.r = 30;
                b.conduits.push(conduit);
            }
        }
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        b.dx = 0; b.dy = 0;

        const height = b.r * 2.5;
        const topWidth = b.r * 0.2;
        const baseWidth = b.r * 0.8;
        const pyramidHeight = b.r * 0.4;
        const topY = b.y - height / 2;
        const topCenter = { x: b.x, y: topY + pyramidHeight/2 };

        ctx.fillStyle = b.invulnerable ? b.color : '#ecf0f1';
        ctx.beginPath();
        ctx.moveTo(b.x - baseWidth/2, b.y + height/2);
        ctx.lineTo(b.x + baseWidth/2, b.y + height/2);
        ctx.lineTo(b.x + topWidth/2, topY + pyramidHeight);
        ctx.lineTo(b.x - topWidth/2, topY + pyramidHeight);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(b.x, topY);
        ctx.lineTo(b.x + topWidth/2, topY + pyramidHeight);
        ctx.lineTo(b.x - topWidth/2, topY + pyramidHeight);
        ctx.closePath();
        ctx.fill();
        
        if (b.invulnerable) {
            gameHelpers.playLooping('obeliskHum');
            const livingConduits = state.enemies.filter(e => e.id === 'obelisk_conduit' && e.parentObelisk === b);
            livingConduits.forEach(conduit => {
                utils.drawLightning(ctx, topCenter.x, topCenter.y, conduit.x, conduit.y, conduit.color, 3);
            });
        } else {
            gameHelpers.stopLoopingSfx('obeliskHum');
            b.isFiringBeam = true;
            b.beamAngle += 0.005;
            
            const beamLength = Math.hypot(ctx.canvas.width, ctx.canvas.height);
            const beamEndX = topCenter.x + Math.cos(b.beamAngle) * beamLength;
            const beamEndY = topCenter.y + Math.sin(b.beamAngle) * beamLength;
            const beamColor = b.beamColors[Math.floor(Math.random() * b.beamColors.length)];

            utils.drawLightning(ctx, topCenter.x, topCenter.y, beamEndX, beamEndY, beamColor, 10);
        }
    },
    onDamage: (b, dmg) => { 
        if (b.invulnerable) {
            b.hp += dmg; 
        } else {
            b.hp -= dmg * 9;
        }
    },
    onDeath: (b, state, spawnEnemy, spawnParticles, play, stopLoopingSfx) => {
        stopLoopingSfx('obeliskHum');
        b.conduits.forEach(c => { if(c) c.hp = 0; });
    }
}, {
    id: "obelisk_conduit",
    name: "Obelisk Conduit",
    color: "#8e44ad",
    maxHP: 150,
    hasCustomMovement: true,
    init: (b) => {
        b.orbitalAngle = 0;
        b.lastExplosion = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if(b.parentObelisk && b.parentObelisk.hp > 0) {
            const rotation = Date.now() / 3000;
            const baseDistance = 300;
            const oscillation = Math.sin(Date.now() / 800) * 150;
            const dynamicDistance = baseDistance + oscillation;

            b.x = b.parentObelisk.x + Math.cos(b.orbitalAngle + rotation) * dynamicDistance;
            b.y = b.parentObelisk.y + Math.sin(b.orbitalAngle + rotation) * dynamicDistance;
        } else {
            b.hp = 0;
            return;
        }
        
        switch (b.conduitType) {
            case 'lightning':
                const distToPlayer = Math.hypot(state.player.x - b.x, state.player.y - b.y);
                const auraRadius = 250;
                if (distToPlayer < auraRadius) {
                     for(let i = 0; i < 5; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const endX = b.x + Math.cos(angle) * auraRadius;
                        const endY = b.y + Math.sin(angle) * auraRadius;
                        utils.drawLightning(ctx, b.x, b.y, endX, endY, `rgba(241, 196, 15, 0.5)`, 2);
                    }
                    if (!state.player.shield) {
                        state.player.health -= 0.5;
                        if(state.player.health <= 0) state.gameOver = true;
                    } else {
                        state.player.shield = false;
                        gameHelpers.play('shieldBreak');
                    }
                }
                break;
            case 'gravity':
                for (let i = 1; i <= 3; i++) {
                    const pulse = (Date.now() / 500 + i) % 1;
                    ctx.strokeStyle = `rgba(155, 89, 182, ${1 - pulse})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, 250 * pulse, 0, 2 * Math.PI);
                    ctx.stroke();
                }
                 if (Math.hypot(state.player.x - b.x, state.player.y - b.y) < 250) {
                    const pullStrength = 0.04;
                    state.player.x += (b.x - state.player.x) * pullStrength;
                    state.player.y += (b.y - state.player.y) * pullStrength;
                }
                break;
            case 'explosion':
                if (Date.now() - b.lastExplosion > 5000) {
                    b.lastExplosion = Date.now();
                    utils.spawnParticles(state.particles, b.x, b.y, b.color, 100, 8, 50, 5);
                    utils.triggerScreenShake(200, 10);
                    state.effects.push({ type: 'shockwave', caster: b, x: b.x, y: b.y, radius: 0, maxRadius: 150, speed: 400, startTime: Date.now(), hitEnemies: new Set(), damage: 25, color: 'rgba(231, 76, 60, 0.7)' });
                }
                const timeToExplosion = 5000 - (Date.now() - b.lastExplosion);
                if (timeToExplosion < 1000) {
                    const progress = 1 - (timeToExplosion / 1000);
                    ctx.fillStyle = `rgba(231, 76, 60, ${progress * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, 150 * progress, 0, 2 * Math.PI);
                    ctx.fill();
                }
                break;
        }
    },
    onDeath: (b, state, sE, sP, play) => {
        play('conduitShatter');
        if (b.parentObelisk) {
            const remainingConduits = state.enemies.filter(e => e.id === 'obelisk_conduit' && e.hp > 0 && e.parentObelisk === b.parentObelisk);
            if (remainingConduits.length === 0) {
                b.parentObelisk.invulnerable = false;
            }
        }
    }
}, {
    id: "helix_weaver",
    name: "The Helix Weaver",
    color: "#e74c3c",
    maxHP: 500,
    difficulty_tier: 3,
    archetype: 'swarm',
    description: "Unleashes relentless, spiraling waves of projectiles. The number of active helices increases as its integrity fails.",
    lore: "This machine was designed to weave the very fabric of spacetime, repairing minor tears in its home reality. Overwhelmed by the Unraveling, its repair protocols overloaded and inverted. It now mindlessly *unweaves* reality, firing off the spiraling threads of spacetime it pulls apart as relentless projectiles.",
    mechanics_desc: "Remains stationary in the center of the arena while firing relentless, spiraling waves of projectiles. The number of projectile helices increases as its health decreases, creating an intense bullet-hell environment.",
    hasCustomMovement: true,
    init: (b, state, spawnEnemy, canvas) => {
        b.x = canvas.width / 2;
        b.y = canvas.height / 2;
        b.angle = 0;
        b.lastShot = 0;
        b.activeArms = 1;
    },
    logic: (b, ctx, state, utils) => {
        b.dx = 0; b.dy = 0;
        if (Date.now() - b.lastShot > 100) {
            b.lastShot = Date.now();
            const speed = 4;
            const totalArms = 4;
            for (let i = 0; i < totalArms; i++) {
                if (i < b.activeArms) {
                    const angle = b.angle + (i * (2 * Math.PI / totalArms));
                    state.effects.push({ type: 'nova_bullet', caster: b, x: b.x, y: b.y, r: 5, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, color: '#e74c3c', damage: 13 });
                }
            }
            b.angle += 0.2;
        }
    },
    onDamage: (b, dmg, source, state, spawnParticles, play) => {
        const hpPercent = b.hp / b.maxHP;
        const oldArms = b.activeArms;

        if (hpPercent < 0.8 && b.activeArms < 2) {
            b.activeArms = 2;
        } else if (hpPercent < 0.6 && b.activeArms < 3) {
            b.activeArms = 3;
        } else if (hpPercent < 0.4 && b.activeArms < 4) {
            b.activeArms = 4;
        }
        if (b.activeArms > oldArms) {
            play('weaverCast');
        }
    }
}, {
    id: "epoch_ender",
    name: "The Epoch-Ender",
    color: "#bdc3c7",
    maxHP: 550,
    difficulty_tier: 3,
    archetype: 'aggressor',
    description: "Warps causality, generating a Dilation Field behind it where time moves slower. It can rewind its own timeline to negate recent damage.",
    lore: "A Chronomancer who foresaw the Unraveling and attempted to escape it by creating a personal time-loop. The paradox of its own existence now acts as a shield, allowing it to rewind its own state to negate injury. The field it projects is a wake of distorted causality, a field of 'slow time' left behind by its constant temporal manipulation.",
    mechanics_desc: "Projects a Dilation Field behind it where you and your projectiles are slowed. After taking a significant amount of damage, the boss will rewind time, restoring its health and position to a previous state. This rewind has a long cooldown.",
    init: (b) => {
        b.lastDilation = Date.now();
        b.damageWindow = 0;
        b.lastKnownState = { x: b.x, y: b.y, hp: b.hp };
        b.dilationFieldEffect = null;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const angleToPlayer = Math.atan2(state.player.y - b.y, state.player.x - b.x);
        const fieldAngle = angleToPlayer + Math.PI;

        if (!b.dilationFieldEffect || !state.effects.includes(b.dilationFieldEffect)) {
             const field = {
                type: 'dilation_field',
                source: b,
                x: b.x,
                y: b.y,
                r: 300,
                shape: 'horseshoe',
                angle: fieldAngle,
                endTime: Infinity
            };
            state.effects.push(field);
            b.dilationFieldEffect = field;
        } else {
            b.dilationFieldEffect.x = b.x;
            b.dilationFieldEffect.y = b.y;
            b.dilationFieldEffect.angle = fieldAngle;
        }

        const playerDist = Math.hypot(state.player.x - b.x, state.player.y - b.y);
        if (playerDist < 300) {
            let playerAngle = Math.atan2(state.player.y - b.y, state.player.x - b.x);
            let targetAngle = b.dilationFieldEffect.angle;
            let diff = Math.atan2(Math.sin(playerAngle - targetAngle), Math.cos(playerAngle - targetAngle));
            
            if (Math.abs(diff) > (Math.PI / 4)) {
                 if (!state.player.statusEffects.some(e => e.name === 'Epoch-Slow')) {
                     gameHelpers.addStatusEffect('Epoch-Slow', '🐌', 500);
                 }
            }
        }
    },
    onDamage: (b, dmg, source, state, sP, play) => {
        const now = Date.now();
        if (!b.rewindCooldownUntil || now > b.rewindCooldownUntil) {
            b.damageWindow += dmg;
            if (b.damageWindow > 100) {
                play('timeRewind');
                b.hp = b.lastKnownState.hp;
                b.x = b.lastKnownState.x;
                b.y = b.lastKnownState.y;
                b.rewindCooldownUntil = now + 15000;
                b.damageWindow = 0;
            }
        }
        if (!b.lastStateUpdate || now > b.lastStateUpdate + 2000) {
            b.lastStateUpdate = now;
            b.lastKnownState = { x: b.x, y: b.y, hp: b.hp };
        }
    },
    onDeath: (b, state) => {
        state.effects = state.effects.filter(e => e !== b.dilationFieldEffect);
        b.dilationFieldEffect = null;
    }
}, {
    id: "shaper_of_fate",
    name: "The Shaper of Fate",
    color: "#f1c40f",
    maxHP: 600,
    difficulty_tier: 3,
    archetype: 'specialist',
    description: "Foretells its attacks by manifesting reality-altering Runes. The player's position relative to the Runes determines the Shaper's next devastating assault.",
    lore: "This being did not experience time but rather saw all potential futures as tangible 'Runes' of possibility. The Unraveling shattered its omniscience, leaving it with only fragmented glimpses of what might be. It projects these shattered prophecies onto the battlefield, and your interaction with them forces one of a thousand devastating futures into reality.",
    mechanics_desc: "Creates three Runes on the field, each corresponding to a different attack. The Rune you are closest to when they disappear determines which powerful ability the Shaper will use. You can influence its next move by positioning yourself carefully.",
    init: (b) => {
        b.phase = 'idle';
        b.phaseTimer = Date.now() + 3000;
        b.activeRunes = [];
        b.chosenAttack = null;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const now = Date.now();

        if (b.phase === 'idle' && now > b.phaseTimer) {
            b.phase = 'prophecy';
            gameHelpers.play('shaperAppear');
            
            const runeTypes = ['nova', 'shockwave', 'lasers', 'heal', 'speed_buff'];
            const shuffledRunes = runeTypes.sort(() => Math.random() - 0.5);
            
            const margin = 150;
            const positions = [
                { x: utils.randomInRange(margin, ctx.canvas.width / 3), y: utils.randomInRange(margin, ctx.canvas.height - margin) },
                { x: utils.randomInRange(ctx.canvas.width / 3, ctx.canvas.width * 2 / 3), y: utils.randomInRange(margin, ctx.canvas.height - margin)},
                { x: utils.randomInRange(ctx.canvas.width * 2 / 3, ctx.canvas.width - margin), y: utils.randomInRange(margin, ctx.canvas.height - margin) }
            ].sort(() => Math.random() - 0.5);

            for (let i = 0; i < 3; i++) {
                const rune = {
                    type: 'shaper_rune',
                    runeType: shuffledRunes[i],
                    x: positions[i].x,
                    y: positions[i].y,
                    r: 60,
                    endTime: now + 4000,
                    sourceBoss: b
                };
                state.effects.push(rune);
                b.activeRunes.push(rune);
            }
            b.phaseTimer = now + 4000;
        }
        
        else if (b.phase === 'prophecy' && now > b.phaseTimer) {
            b.phase = 'fulfillment';
            
            let closestRune = null;
            let minPlayerDist = Infinity;
            
            b.activeRunes.forEach(rune => {
                const dist = Math.hypot(state.player.x - rune.x, state.player.y - rune.y);
                if (dist < minPlayerDist) {
                    minPlayerDist = dist;
                    closestRune = rune;
                }
            });
            
            b.chosenAttack = closestRune ? closestRune.runeType : 'shockwave';
            
            const runesToRemove = new Set(b.activeRunes);
            state.effects = state.effects.filter(e => !runesToRemove.has(e));
            b.activeRunes = [];

            b.phaseTimer = now + 3000;
            
            switch (b.chosenAttack) {
                case 'nova':
                    state.effects.push({ type: 'nova_controller', startTime: now, duration: 2500, lastShot: 0, angle: Math.random() * Math.PI * 2, caster: b, color: b.color, r: 8, damage: 25 });
                    break;
                case 'shockwave':
                     state.effects.push({ type: 'shockwave', caster: b, x: b.x, y: b.y, radius: 0, maxRadius: Math.max(ctx.canvas.width, ctx.canvas.height), speed: 1000, startTime: now, hitEnemies: new Set(), damage: 90, color: 'rgba(241, 196, 15, 0.7)' });
                    break;
                case 'lasers':
                    for(let i = 0; i < 5; i++) {
                        setTimeout(() => {
                           if (b.hp > 0) state.effects.push({ type: 'orbital_target', x: state.player.x, y: state.player.y, startTime: Date.now(), caster: b, damage: 45, radius: 100, color: 'rgba(241, 196, 15, 0.8)' });
                        }, i * 400);
                    }
                    break;
                case 'heal':
                    b.hp = Math.min(b.maxHP, b.hp + b.maxHP * 0.1);
                    utils.spawnParticles(state.particles, b.x, b.y, '#2ecc71', 50, 4, 30);
                    break;
                case 'speed_buff':
                    b.dx *= 2;
                    b.dy *= 2;
                    setTimeout(() => { b.dx /= 2; b.dy /= 2; }, 5000);
                    utils.spawnParticles(state.particles, b.x, b.y, '#3498db', 50, 4, 30);
                    break;
            }
            gameHelpers.play('shaperAttune');
        }

        else if (b.phase === 'fulfillment' && now > b.phaseTimer) {
            b.phase = 'idle';
            b.phaseTimer = now + 5000;
        }
    },
    onDeath: (b, state) => {
        state.effects = state.effects.filter(e => e.type !== 'shaper_rune' || e.sourceBoss !== b);
    }
}, {
    id: "pantheon",
    name: "The Pantheon",
    color: "#ecf0f1",
    maxHP: 3000,
    difficulty_tier: 3,
    archetype: 'aggressor',
    description: "An ultimate being that channels the Aspects of other powerful entities, cycling through their abilities to create an unpredictable, multi-faceted threat.",
    lore: "At the precipice of total non-existence, the final consciousnesses of a thousand collapsing timelines merged into a single, gestalt being to survive. The Pantheon is not one entity, but a chorus of dying gods, heroes, and monsters screaming in unison. It wields the memories and powers of the worlds it has lost, making it an unpredictable and tragic echo of a thousand apocalypses.",
    mechanics_desc: "Does not have its own attacks. Instead, it channels the Aspects of other Aberrations, cycling through their primary abilities. Pay close attention to the visual cues of its active Aspects, as its attack patterns will change completely throughout the fight.",
    hasCustomMovement: true,
    hasCustomDraw: true,
    init: (b, state, spawnEnemy, canvas) => {
        b.x = canvas.width / 2;
        b.y = 150;
        b.phase = 1;
        b.actionCooldown = 8000;
        b.nextActionTime = Date.now() + 3000;
        
        b.activeAspects = new Map();
        b.isChargingAnnihilatorBeam = false;

        const blacklist = new Set(['aethel_and_umbra', 'sentinel_pair', 'fractal_horror', 'pantheon', 'shaper_of_fate', 'obelisk_conduit']);

        const stageConfig = STAGE_CONFIG;
        b.aspectPools = {
            primary: ['juggernaut', 'annihilator', 'syphon', 'centurion'],
            ambient: ['swarm', 'basilisk', 'architect', 'glitch'],
            projectile: ['helix_weaver', 'emp', 'puppeteer', 'vampire', 'looper', 'mirror'],
        };
        
        b.getAspectData = (aspectId) => bossData.find(boss => boss.id === aspectId);
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const now = Date.now();

        if (now > b.nextActionTime && b.activeAspects.size < 3) {
            let availablePools = ['primary', 'ambient', 'projectile'].filter(p => !Array.from(b.activeAspects.values()).some(asp => asp.type === p));
            
            if (availablePools.length > 0) {
                const poolToUse = availablePools[Math.floor(Math.random() * availablePools.length)];
                const aspectId = b.aspectPools[poolToUse][Math.floor(Math.random() * b.aspectPools[poolToUse].length)];
                
                const aspectData = b.getAspectData(aspectId);
                if (aspectData) {
                    if (aspectData.init) {
                        aspectData.init(b, state, gameHelpers.spawnEnemy, ctx.canvas);
                    }
                    b.activeAspects.set(aspectId, {
                        id: aspectId,
                        type: poolToUse,
                        endTime: now + (poolToUse === 'primary' ? 16000 : 15000),
                    });
                    gameHelpers.play('pantheonSummon');
                }
            }
            b.nextActionTime = now + b.actionCooldown;
        }

        b.activeAspects.forEach((aspectState, aspectId) => {
            if (now > aspectState.endTime) {
                const aspectData = b.getAspectData(aspectId);
                if (aspectData?.onDeath) {
                    const spawnParticlesCallback = (x, y, c, n, spd, life, r) => utils.spawnParticles(state.particles, x, y, c, n, spd, life, r);
                    aspectData.onDeath(b, state, gameHelpers.spawnEnemy, spawnParticlesCallback, gameHelpers.play, gameHelpers.stopLoopingSfx);
                }
                b.activeAspects.delete(aspectId);
            } else {
                const aspectData = b.getAspectData(aspectId);
                if (aspectData) {
                    const teleportAspects = new Set(['mirror', 'glitch', 'looper']);
                    if (teleportAspects.has(aspectId) && b.isChargingAnnihilatorBeam) {
                        // Skip teleport logic if Annihilator is charging
                    } else if (aspectData.logic) {
                        ctx.save();
                        aspectData.logic(b, ctx, state, utils, gameHelpers);
                        ctx.restore();
                    }
                }
            }
        });

        if (b.pillars) {
            b.pillars.forEach(pillar => {
                const playerDist = Math.hypot(state.player.x - pillar.x, state.player.y - pillar.y);
                if (playerDist < state.player.r + pillar.r) {
                    const angle = Math.atan2(state.player.y - pillar.y, state.player.x - pillar.x);
                    state.player.x = pillar.x + Math.cos(angle) * (state.player.r + pillar.r);
                    state.player.y = pillar.y + Math.sin(angle) * (state.player.r + pillar.r);
                }
            });
        }

        if (b.pillar) {
            const allEntities = [state.player, ...state.enemies];
            allEntities.forEach(entity => {
                if (entity === b && b.activeAspects.has('architect')) {
                    return;
                }
                
                const entityRadius = entity.r || state.player.r;
                
                const dist = Math.hypot(entity.x - b.pillar.x, entity.y - b.pillar.y);
                if (dist < entityRadius + b.pillar.r) {
                    const angle = Math.atan2(entity.y - b.pillar.y, entity.x - b.pillar.x);
                    entity.x = b.pillar.x + Math.cos(angle) * (entityRadius + b.pillar.r);
                    entity.y = b.pillar.y + Math.sin(angle) * (entityRadius + b.pillar.r);
                }
            });
        }

        if (!b.activeAspects.has('juggernaut')) {
             b.dx = (state.player.x - b.x) * 0.005;
             b.dy = (state.player.y - b.y) * 0.005;
             b.x += b.dx;
             b.y += b.dy;
        } else {
            b.x += b.dx;
            b.y += b.dy;
            if(b.x < b.r || b.x > ctx.canvas.width-b.r) {
                b.x = Math.max(b.r, Math.min(ctx.canvas.width - b.r, b.x));
                b.dx*=-1;
            }
            if(b.y < b.r || b.y > ctx.canvas.height-b.r) {
                b.y = Math.max(b.r, Math.min(ctx.canvas.height - b.r, b.y));
                b.dy*=-1;
            }
        }
        
        ctx.save();
        
        // 1. Draw the OPAQUE Psychedelic Core FIRST
        ctx.globalAlpha = 1.0; 
        const corePulse = Math.sin(now / 400) * 5;
        const coreRadius = b.r + corePulse;
        const hue = (now / 20) % 360;
        
        const outerColor = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowColor = outerColor;
        ctx.shadowBlur = 30;
        utils.drawCircle(ctx, b.x, b.y, coreRadius, outerColor);
        
        const innerColor = `hsl(${(hue + 40) % 360}, 100%, 80%)`;
        ctx.shadowColor = innerColor;
        ctx.shadowBlur = 20;
        utils.drawCircle(ctx, b.x, b.y, coreRadius * 0.7, innerColor);
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 2. Draw the SEMI-TRANSPARENT Aspect Rings on TOP
        ctx.globalCompositeOperation = 'lighter';
        
        let aspectColors = [];
        b.activeAspects.forEach(aspect => {
            const aspectData = b.getAspectData(aspect.id);
            if (aspectData && aspect.id !== 'glitch') aspectColors.push(aspectData.color);
        });

        if (aspectColors.length > 0) {
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = 10;
            
            aspectColors.forEach((color, i) => {
                ctx.beginPath();
                const radius = coreRadius + 10 + (i * 15) + Math.sin(now / (300 + i * 50)) * 3;
                const rotationSpeed = (i % 2 === 0 ? 1 : -1) * (6000 + i * 1000);
                const angle = now / rotationSpeed;
                
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 15;

                ctx.arc(b.x, b.y, radius, angle, angle + Math.PI * 1.5);
                ctx.stroke();
            });
        }
        
        // 3. Draw a special, always-visible ring for The Glitch
        if (b.activeAspects.has('glitch')) {
            ctx.globalAlpha = 1.0;
            const glitchColors = ['#fd79a8', '#81ecec', '#f1c40f'];
            const segmentCount = 40;
            const ringRadius = coreRadius + 15 + (aspectColors.length * 15);

            for (let i = 0; i < segmentCount; i++) {
                if (Math.random() < 0.75) continue;
                
                const angle = (i / segmentCount) * 2 * Math.PI + (now / 2000);
                const jitter = (Math.random() - 0.5) * 15;

                const x = b.x + Math.cos(angle) * (ringRadius + jitter);
                const y = b.y + Math.sin(angle) * (ringRadius + jitter);

                ctx.fillStyle = glitchColors[Math.floor(Math.random() * glitchColors.length)];
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(x, y, Math.random() * 4 + 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        
        ctx.restore();
    },
    onDamage: (b, dmg, source, state, sP, play, stopLoopingSfx, gameHelpers) => { 
        if (b.invulnerable) {
            return;
        };
        b.hp -= dmg

        const hpPercent = b.hp / b.maxHP;
        
        const phaseThresholds = [0.8, 0.6, 0.4, 0.2];
        const currentPhase = b.phase || 1;
        let nextPhase = -1;

        for(let i = 0; i < phaseThresholds.length; i++) {
            if (hpPercent <= phaseThresholds[i] && currentPhase === (i + 1)) {
                nextPhase = i + 2;
                break;
            }
        }

        if (nextPhase !== -1) {
            b.phase = nextPhase;
            b.actionCooldown *= 0.85;
            b.invulnerable = true;
            utils.spawnParticles(state.particles, b.x, b.y, '#fff', 150, 8, 50);
            state.effects.push({ type: 'shockwave', caster: b, x: b.x, y: b.y, radius: 0, maxRadius: 1200, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: 50, color: 'rgba(255, 255, 255, 0.7)' });
            setTimeout(() => b.invulnerable = false, 2000);
        }
    },
    onDeath: (b, state, spawnEnemy, spawnParticles, play, stopLoopingSfx) => {
        b.activeAspects.forEach((aspectState, aspectId) => {
            if (b.getAspectData(aspectId)?.onDeath) {
                b.getAspectData(aspectId).onDeath(b, state, spawnEnemy, spawnParticles, play, stopLoopingSfx);
            }
        });
        delete b.pillar;
        delete b.pillars;
        delete b.chain;
        delete b.clones;
        delete b.petrifyZones;
    }
}
];

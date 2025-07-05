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
        // Player-pillar collision logic is now handled here
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
    init: b => {
        b.lastTeleport = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers, aspectState) => {
        // Use aspect-specific timer if available (for Pantheon)
        const timer = aspectState ? 'lastActionTime' : 'lastTeleport';
        const lastTime = aspectState ? aspectState[timer] : b[timer];
        
        const interval = b.hp < b.maxHP * 0.25 ? 1500 : (b.hp < b.maxHP * 0.5 ? 2000 : 2500);
        if (Date.now() - (lastTime || 0) > interval) {
            if (aspectState) aspectState[timer] = Date.now();
            else b[timer] = Date.now();

            gameHelpers.play('mirrorSwap');
            utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
            b.x = utils.randomInRange(b.r, ctx.canvas.width - b.r);
            b.y = utils.randomInRange(b.r, ctx.canvas.height - b.r);
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
        b.lastConvert = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers, aspectState) => {
        const timer = aspectState ? 'lastActionTime' : 'lastConvert';
        const lastTime = aspectState ? aspectState[timer] : b[timer];

        if (Date.now() - (lastTime || 0) > 1500) {
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
                if (aspectState) aspectState[timer] = Date.now();
                else b[timer] = Date.now();

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
        b.lastTeleport = 0;
    },
    logic: (b, ctx, state, utils, gameHelpers, aspectState) => {
        const timer = aspectState ? 'lastActionTime' : 'lastTeleport';
        const lastTime = aspectState ? aspectState[timer] : b[timer];
        
        const canvas = ctx.canvas;
        if (Date.now() - (lastTime || 0) > 3000) {
            if (aspectState) aspectState[timer] = Date.now();
            else b[timer] = Date.now();

            gameHelpers.play('glitchSound');
            utils.spawnParticles(state.particles, b.x, b.y, b.color, 40, 4, 30);
            const oldX = b.x;
            const oldY = b.y;
            b.x = utils.randomInRange(b.r, canvas.width - b.r);
            b.y = utils.randomInRange(b.r, canvas.height - b.r);
            state.effects.push({
                type: 'glitch_zone',
                x: oldX,
                y: oldY,
                r: 100,
                endTime: Date.now() + 5000
            });
        }

        // The custom drawing part is only for the standalone boss
        if (!aspectState) {
            const size = b.r * 0.4;
            for (let i = 0; i < 10; i++) {
                const glitchX = b.x + (Math.random() - 0.5) * b.r * 1.5;
                const glitchY = b.y + (Math.random() - 0.5) * b.r * 1.5;
                ctx.fillStyle = ['#fd79a8', '#81ecec', '#f1c40f'][Math.floor(Math.random() * 3)];
                ctx.fillRect(glitchX - size / 2, glitchY - size / 2, size, size);
            }
        }
    },
    onDeath: (b, state) => {
        state.player.controlsInverted = false;
    }
}, 
// ... (All bosses up to Annihilator) ...
{
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
        b.lastBeam = 0;
        b.isChargingBeam = false;
        b.pillar = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            r: 75
        };
    },
    logic: (b, ctx, state, utils, gameHelpers, aspectState) => {
        const timer = aspectState ? 'lastActionTime' : 'lastBeam';
        const lastTime = aspectState ? aspectState[timer] : b[timer];

        if (Date.now() - (lastTime || 0) > 12000 && !b.isChargingBeam) {
            b.isChargingBeam = true;
            if (b.id === 'pantheon') {
                b.isChargingAnnihilatorBeam = true;
            }

            gameHelpers.play('powerSirenSound');
            setTimeout(() => {
                if(b.hp <= 0) {
                    if (b.id === 'pantheon') b.isChargingAnnihilatorBeam = false;
                    return;
                }
                gameHelpers.play('annihilatorBeamSound');
                state.effects.push({
                    type: 'annihilator_beam',
                    source: b,
                    pillar: { ...b.pillar },
                    endTime: Date.now() + 1200
                });
                if (aspectState) aspectState[timer] = Date.now();
                else b[timer] = Date.now();
                b.isChargingBeam = false;
                if (b.id === 'pantheon') {
                    b.isChargingAnnihilatorBeam = false;
                }
            }, 4000);
        }
        if (b.pillar) {
            utils.drawCircle(ctx, b.pillar.x, b.pillar.y, b.pillar.r, "#2d3436");
            
            // Player collision with pillar
            const playerDist = Math.hypot(state.player.x - b.pillar.x, state.player.y - b.pillar.y);
             if (playerDist < state.player.r + b.pillar.r) {
                const angle = Math.atan2(state.player.y - b.pillar.y, state.player.x - b.pillar.x);
                state.player.x = b.pillar.x + Math.cos(angle) * (state.player.r + b.pillar.r);
                state.player.y = b.pillar.y + Math.sin(angle) * (state.player.r + b.pillar.r);
            }

            // Boss collision with pillar
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
},
// ... (All bosses up to Pantheon) ...
{
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

        b.aspectPools = {
            primary: ['juggernaut', 'annihilator', 'syphon', 'centurion'],
            ambient: ['swarm', 'basilisk', 'architect', 'glitch'],
            projectile: ['helix_weaver', 'emp', 'puppeteer', 'vampire', 'looper', 'mirror'],
        };
        
        b.getAspectData = (aspectId) => bossData.find(boss => boss.id === aspectId);
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const now = Date.now();

        // --- Aspect Acquisition ---
        if (now > b.nextActionTime && b.activeAspects.size < 3) {
            let availablePools = ['primary', 'ambient', 'projectile'].filter(p => !Array.from(b.activeAspects.values()).some(asp => asp.type === p));
            
            if (availablePools.length > 0) {
                const poolToUse = availablePools[Math.floor(Math.random() * availablePools.length)];
                let aspectId = b.aspectPools[poolToUse][Math.floor(Math.random() * b.aspectPools[poolToUse].length)];
                
                // Ensure no duplicate aspects
                while (b.activeAspects.has(aspectId)) {
                    aspectId = b.aspectPools[poolToUse][Math.floor(Math.random() * b.aspectPools[poolToUse].length)];
                }
                
                const aspectData = b.getAspectData(aspectId);
                if (aspectData) {
                    const aspectState = {
                        id: aspectId,
                        type: poolToUse,
                        endTime: now + (poolToUse === 'primary' ? 16000 : 15000),
                        lastActionTime: 0, // Independent timer for each aspect
                    };
                    b.activeAspects.set(aspectId, aspectState);

                    if (aspectData.init) {
                        aspectData.init(b, state, gameHelpers.spawnEnemy, ctx.canvas);
                    }
                    
                    state.effects.push({
                        type: 'aspect_summon_ring',
                        source: b, color: aspectData.color, startTime: now,
                        duration: 1000, maxRadius: 200
                    });

                    gameHelpers.play('pantheonSummon');
                }
            }
            b.nextActionTime = now + b.actionCooldown;
        }

        // --- Aspect Execution ---
        b.activeAspects.forEach((aspectState, aspectId) => {
            if (now > aspectState.endTime) {
                const aspectData = b.getAspectData(aspectId);
                if (aspectData?.onDeath) {
                    aspectData.onDeath(b, state, gameHelpers.spawnEnemy, (x,y,c,n,spd,life,r)=>utils.spawnParticles(state.particles,x,y,c,n,spd,life,r), gameHelpers.play, gameHelpers.stopLoopingSfx);
                }
                b.activeAspects.delete(aspectId);
                return; // continue to next aspect
            }

            const aspectData = b.getAspectData(aspectId);
            if (aspectData) {
                const isTeleportAspect = new Set(['mirror', 'glitch', 'looper']).has(aspectId);
                if (isTeleportAspect && b.isChargingAnnihilatorBeam) {
                    return; // Skip this aspect's logic
                }
                
                if (aspectData.logic) {
                    ctx.save();
                    // Pass the aspect's unique state to its logic function
                    aspectData.logic(b, ctx, state, utils, gameHelpers, aspectState);
                    ctx.restore();
                }
            }
        });

        // --- Pantheon Movement ---
        if (!b.activeAspects.has('juggernaut')) {
             b.dx = (state.player.x - b.x) * 0.005;
             b.dy = (state.player.y - b.y) * 0.005;
             b.x += b.dx;
             b.y += b.dy;
        } else { // Juggernaut aspect handles its own movement
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
        
        // --- Pantheon Drawing ---
        ctx.save();
        
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

        ctx.globalAlpha = 0.5;
        let ringIndex = 0;
        b.activeAspects.forEach(aspect => {
            const aspectData = b.getAspectData(aspect.id);
            if (aspectData && aspectData.color && aspect.id !== 'glitch') {
                ringIndex++;
                ctx.strokeStyle = aspectData.color;
                ctx.lineWidth = 4 + (ringIndex * 2);
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r + 10 + (ringIndex * 12), 0, 2 * Math.PI);
                ctx.stroke();
            }
        });
        
        if (b.activeAspects.has('glitch')) {
            ctx.globalAlpha = 1.0;
            const glitchColors = ['#fd79a8', '#81ecec', '#f1c40f'];
            const segmentCount = 40;
            const ringRadius = coreRadius + 15 + (ringIndex * 15);

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

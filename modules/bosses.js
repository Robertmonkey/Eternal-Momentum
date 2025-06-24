// modules/bosses.js
export const bossData = [{
    id: "splitter",
    name: "Splitter Sentinel",
    color: "#ff4500",
    maxHP: 96,
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
            if(source && source.health) source.health -= 10;
        }
    }
}, {
    id: "vampire",
    name: "Vampire Veil",
    color: "#800020",
    maxHP: 144,
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
        });
    }
}, {
    id: "mirror",
    name: "Mirror Mirage",
    color: "#ff00ff",
    maxHP: 240,
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
    }
}, {
    id: "twins",
    name: "Vortex Twins",
    color: "#f39c12",
    maxHP: 280,
    init: (b, state, spawnEnemy) => {
        if (!state.enemies.find(e => e.id === 'twins' && e !== b)) {
            spawnEnemy(true, 'twins');
        }
    },
    onDeath: (b, state) => {
        const remainingTwins = state.enemies.filter(e => e.id === 'twins' && e.hp > 0 && e !== b);
        if (remainingTwins.length > 0) {
            remainingTwins.forEach(twin => {
                twin.enraged = true;
            });
        }
    }
}, {
    id: "looper",
    name: "Looping Eye",
    color: "#ecf0f1",
    maxHP: 320,
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
    init: b => {
        b.lastConvert = Date.now();
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (Date.now() - b.lastConvert > 1000) {
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
                farthestEnemy.hp = 10;
                farthestEnemy.dx *= 2;
                farthestEnemy.dy *= 2;
                utils.drawLightning(ctx, b.x, b.y, farthestEnemy.x, farthestEnemy.y, b.color, 5);
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
    init: b => {
        b.lastPetrifyZone = Date.now();
    },
    logic: (b, ctx, state) => {
        const canvas = ctx.canvas;
        if (Date.now() - b.lastPetrifyZone > 7000) {
            b.lastPetrifyZone = Date.now();
            for (let i = 0; i < 4; i++) {
                state.effects.push({
                    type: 'petrify_zone',
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: 120,
                    startTime: Date.now()
                });
            }
        }
    }
}, {
    id: "annihilator",
    name: "The Annihilator",
    color: "#d63031",
    maxHP: 480,
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
            gameHelpers.play('powerSirenSound');
            setTimeout(() => {
                gameHelpers.play('annihilatorBeamSound');
                state.effects.push({
                    type: 'annihilator_beam',
                    source: b,
                    pillar: b.pillar,
                    endTime: Date.now() + 1200
                });
                b.lastBeam = Date.now();
                b.isChargingBeam = false;
            }, 4000);
        }
        if (b.pillar) {
            utils.drawCircle(ctx, b.pillar.x, b.pillar.y, b.pillar.r, "#2d3436");
        }
    },
    onDeath: b => {
        b.pillar = null;
    }
}, {
    id: "parasite",
    name: "The Parasite",
    color: "#55efc4",
    maxHP: 416,
    onCollision: (b, p, addStatusEffect) => {
        if (!p.infected) addStatusEffect('Infected', '☣️', 10000);
        p.infected = true;
        p.infectionEnd = Date.now() + 10000;
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
            for (let i = 0; i < 3; i++) {
                b.echoes.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: b.r
                });
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
                        damage: 10
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
                    const beamTarget = { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
                    state.effects.push({ type: 'singularity_beam', source: b, target: beamTarget, endTime: Date.now() + 500 });
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
    }
}];

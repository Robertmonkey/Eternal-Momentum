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
    id: "aethel_and_umbra",
    name: "Aethel & Umbra",
    color: "#f39c12",
    maxHP: 280,
    init: (b, state, spawnEnemy) => {
        const partner = state.enemies.find(e => e.id === 'aethel_and_umbra' && e !== b);
        b.r = 50;
        if (!partner) {
            b.role = Math.random() < 0.5 ? 'Aethel' : 'Umbra';
            const partnerBoss = spawnEnemy(true, 'aethel_and_umbra');
            if (partnerBoss) {
                partnerBoss.role = b.role === 'Aethel' ? 'Umbra' : 'Aethel';
                b.partner = partnerBoss;
                partnerBoss.partner = b;
                partnerBoss.name = partnerBoss.role;
            }
        }
        b.name = b.role;
        
        if (b.role === 'Aethel') {
            b.r *= 0.75;
            b.dx = (b.dx || (Math.random() - 0.5)) * 2.5;
            b.dy = (b.dy || (Math.random() - 0.5)) * 2.5;
        } else {
            b.r *= 1.25;
            b.maxHP *= 1.5;
            b.hp = b.maxHP;
        }
        b.enraged = false;
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
            if (b.role === 'Aethel') {
                partner.dx = (partner.dx || (Math.random() - 0.5)) * 2.5;
                partner.dy = (partner.dy || (Math.random() - 0.5)) * 2.5;
            } else {
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
                if(b.hp <= 0) return;
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
    color: "#1abc9c",
    maxHP: 500,
    init: (b) => {
        b.r = 156;
        b.isSplitting = false;
    },
    logic: (b, ctx, state) => {
        // All logic is now in onDamage to handle splitting correctly
    },
    onDamage: (b, dmg, source, state, spawnParticles, play, stopLoopingSfx, gameHelpers) => {
        // Apply damage to all fractal instances to maintain a linked health pool
        state.enemies.forEach(e => {
            if (e.id === 'fractal_horror') {
                e.hp -= dmg;
            }
        });

        // Prevent splitting into fragments that are too small
        if (b.r < 5) {
            return;
        }

        // This fractal will now split. Mark it for removal.
        b.hp = 0;
        play('fractalSplit');
        spawnParticles(state.particles, b.x, b.y, b.color, 50, 4, 30);
        
        const newRadius = b.r / Math.SQRT2;
        const children = [];
        for (let i = 0; i < 2; i++) {
            const angle = Math.random() * 2 * Math.PI;
            // Spawn children slightly offset from the parent
            const child = gameHelpers.spawnEnemy(true, 'fractal_horror', { 
                x: b.x + Math.cos(angle) * b.r * 0.5, 
                y: b.y + Math.sin(angle) * b.r * 0.5 
            });
            if (child) {
                child.r = newRadius;
                // All fragments share the same collective HP pool
                child.hp = Math.max(1, b.hp); // Ensure hp doesn't drop below 1 from this split
                child.maxHP = b.maxHP;
                children.push(child);
            }
        }
        
        // Push children apart if they overlap
        if (children.length === 2) {
            const [c1, c2] = children;
            const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
            const min_dist = c1.r + c2.r;
            if (dist < min_dist) {
                const overlap = min_dist - dist;
                const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
                c1.x -= Math.cos(angle) * overlap / 2;
                c1.y -= Math.sin(angle) * overlap / 2;
                c2.x += Math.cos(angle) * overlap / 2;
                c2.y += Math.sin(angle) * overlap / 2;
            }
        }
    }
}, {
    id: "obelisk",
    name: "The Obelisk",
    color: "#2c3e50",
    maxHP: 800,
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
                b.conduits.push(conduit);
            }
        }
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        b.dx = 0; b.dy = 0;
        
        if (b.invulnerable) {
            gameHelpers.playLooping('obeliskHum');
            const livingConduits = state.enemies.filter(e => e.id === 'obelisk_conduit' && e.parentObelisk === b);
            livingConduits.forEach(conduit => {
                utils.drawLightning(ctx, b.x, b.y, conduit.x, conduit.y, conduit.color, 3);
            });
        } else {
            gameHelpers.stopLoopingSfx('obeliskHum');
            b.isFiringBeam = true;
            b.beamAngle += 0.005;
            
            const beamLength = Math.hypot(ctx.canvas.width, ctx.canvas.height);
            const beamEndX = b.x + Math.cos(b.beamAngle) * beamLength;
            const beamEndY = b.y + Math.sin(b.beamAngle) * beamLength;
            const beamColor = b.beamColors[Math.floor(Math.random() * b.beamColors.length)];

            utils.drawLightning(ctx, b.x, b.y, beamEndX, beamEndY, beamColor, 10);
        }

        const color = b.invulnerable ? b.color : '#ecf0f1';
        utils.drawCircle(ctx, b.x, b.y, b.r, color);
        if(!b.invulnerable) utils.spawnParticles(state.particles, b.x, b.y, '#fff', 3, 1, 10);
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
        b.angle = Math.random() * Math.PI * 2;
        b.distance = 250 + Math.random() * 50;
        b.conduitType = 'none';
        b.lastExplosion = Date.now();
    },
    logic: (b, ctx, state, utils) => {
        if(b.parentObelisk && b.parentObelisk.hp > 0) {
            b.angle += 0.01;
            b.x = b.parentObelisk.x + Math.cos(b.angle) * b.distance;
            b.y = b.parentObelisk.y + Math.sin(b.angle) * b.distance;
        } else {
            b.hp = 0;
            return;
        }
        
        switch (b.conduitType) {
            case 'lightning':
                // --- FIX: Draw a circle to represent the AoE ---
                const pulse = Math.abs(Math.sin(Date.now() / 400));
                ctx.strokeStyle = `rgba(241, 196, 15, ${pulse * 0.5})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 250, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            case 'gravity':
                for (let i = 1; i <= 3; i++) {
                    const pulse = (Date.now() / 500 + i) % 1;
                    ctx.strokeStyle = `rgba(155, 89, 182, ${1 - pulse})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.r + pulse * 250, 0, 2 * Math.PI);
                    ctx.stroke();
                }
                break;
            case 'explosion':
                if (Date.now() - b.lastExplosion > 5000) {
                    b.lastExplosion = Date.now();
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
    maxHP: 1000,
    hasCustomMovement: true,
    init: (b, state, spawnEnemy, canvas) => {
        b.x = canvas.width / 2;
        b.y = canvas.height / 2;
        b.phase = 1;
        b.aspects = [];
        b.aspectInfo = {};
        
        const blacklist = new Set(['aethel_and_umbra', 'sentinel_pair', 'annihilator', 'obelisk', 'fractal_horror', 'pantheon', 'shaper_of_fate', 'obelisk_conduit', 'miasma', 'basilisk']);

        b.bossPools = {
            tier1: bossData.filter(boss => boss.maxHP < 280 && !blacklist.has(boss.id)).map(boss => boss.id),
            tier2: bossData.filter(boss => boss.maxHP >= 280 && boss.maxHP < 420 && !blacklist.has(boss.id)).map(boss => boss.id),
            tier3: bossData.filter(boss => boss.maxHP >= 420 && !blacklist.has(boss.id)).map(boss => boss.id),
        };

        b.selectNewAspects = (state, gameHelpers) => {
            b.aspects = [];
            b.aspectInfo = {};
            const getUniqueAspect = (tier) => {
                if(tier.length === 0) return;
                let aspectId;
                do {
                    aspectId = tier[Math.floor(Math.random() * tier.length)];
                } while (b.aspects.includes(aspectId));
                b.aspects.push(aspectId);
            };

            getUniqueAspect(b.bossPools.tier1);
            getUniqueAspect(b.bossPools.tier1);
            getUniqueAspect(b.bossPools.tier2);
            getUniqueAspect(b.bossPools.tier3);
            
            if (gameHelpers) gameHelpers.play('pantheonSummon');
            
            b.aspects.forEach(id => {
                b.aspectInfo[id] = { lastUsed: Date.now() + Math.random() * 5000, isCharging: false, chargeDx: 0, chargeDy: 0 };
            });
        };
        
        b.selectNewAspects(state, null);
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        const infoFor = (id) => b.aspectInfo[id];
        const isCharging = b.aspects.some(id => infoFor(id) && infoFor(id).isCharging);

        if (!isCharging) {
            b.dx = (state.player.x - b.x) * 0.0005;
            b.dy = (state.player.y - b.y) * 0.0005;
        } else {
            b.dx = 0;
            b.dy = 0;
        }
        b.x += b.dx;
        b.y += b.dy;

        b.aspects.forEach((id, i) => {
            const aspectData = bossData.find(boss => boss.id === id);
            if (aspectData) {
                const angle = (Date.now() / 2000) + (i * (2 * Math.PI / b.aspects.length));
                const orbX = b.x + Math.cos(angle) * (b.r * 0.6);
                const orbY = b.y + Math.sin(angle) * (b.r * 0.6);
                utils.drawCircle(ctx, orbX, orbY, 15, aspectData.color);
            }
        });
        
        const now = Date.now();
        b.aspects.forEach(id => {
            const info = infoFor(id);
            if (!info) return;

            switch(id) {
                case 'juggernaut':
                    if (now > info.lastUsed + 8000 && !info.isCharging) {
                        info.isCharging = true;
                        gameHelpers.play('chargeUpSound');
                        setTimeout(() => {
                            if (b.hp <= 0) return;
                            const angle = Math.atan2(state.player.y - b.y, state.player.x - b.x);
                            info.chargeDx = Math.cos(angle) * 15;
                            info.chargeDy = Math.sin(angle) * 15;
                            gameHelpers.play('chargeDashSound');
                            setTimeout(() => { info.isCharging = false; info.chargeDx = 0; info.chargeDy = 0; info.lastUsed = now; }, 500);
                        }, 1000);
                    }
                    if(info.isCharging && info.chargeDx) {
                        b.x += info.chargeDx;
                        b.y += info.chargeDy;
                    }
                    break;
                case 'vampire':
                    if (now > info.lastUsed + 7000) {
                        info.lastUsed = now;
                        b.hp = Math.min(b.maxHP, b.hp + 25);
                        utils.spawnParticles(state.particles, b.x, b.y, '#800020', 20, 1, 40);
                        gameHelpers.play('vampireHeal');
                    }
                    break;
                case 'looper':
                    if (now > info.lastUsed + 5000) {
                        info.lastUsed = now;
                        gameHelpers.play('mirrorSwap');
                        utils.spawnParticles(state.particles, b.x, b.y, b.color, 30, 4, 20);
                        b.x = utils.randomInRange(b.r, ctx.canvas.width - b.r);
                        b.y = utils.randomInRange(b.r, ctx.canvas.height - b.r);
                        utils.spawnParticles(state.particles, b.x, b.y, '#fff', 30, 4, 20);
                    }
                    break;
                case 'helix_weaver':
                    if (now > info.lastUsed + 6000) {
                        info.lastUsed = now;
                        gameHelpers.play('weaverCast');
                        state.effects.push({ type: 'nova_controller', startTime: now, duration: 1500, lastShot: 0, angle: Math.random() * Math.PI * 2, caster: b, color: '#e74c3c', r: 5, damage: 10 });
                    }
                    break;
            }
        });

    },
    onDamage: (b, dmg, source, state, sP, play, stopLoopingSfx, gameHelpers) => { 
        const hpPercent = b.hp / b.maxHP;
        let didPhaseChange = false;
        if (hpPercent < 0.7 && b.phase === 1) {
            b.phase = 2;
            didPhaseChange = true;
        } else if (hpPercent < 0.4 && b.phase === 2) {
            b.phase = 3;
            didPhaseChange = true;
        }
        
        if (didPhaseChange) {
            b.selectNewAspects(state, gameHelpers);
        }
    }
}
];

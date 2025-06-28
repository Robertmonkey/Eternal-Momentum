// modules/bosses.js
export const bossData = [
// --- Original 20 Bosses (with Aethel & Umbra rework) ---
{
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
                const newEnemy = spawnEnemy(false, null, { x: spawnX, y: spawnY });
                if (state.arenaMode && newEnemy) newEnemy.targetBosses = true;
            }
        };
        spawnInCircle(6, 60, b);
        setTimeout(() => spawnInCircle(6, 120, b), 1000);
    }
},
// ... (The first 8 original bosses remain unchanged) ...
{
    id: "architect",
    name: "The Architect",
    color: "#7f8c8d",
    maxHP: 280,
    init: b => { b.pillars = []; b.lastBuild = 0; },
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
                    b.pillars.push({ x: startX + Math.cos(angle) * j * 40, y: startY + Math.sin(angle) * j * 40, r: 15 });
                }
            }
        }
        b.pillars.forEach(p => utils.drawCircle(ctx, p.x, p.y, p.r, "#444"));
    }
},
{
    id: "aethel_and_umbra",
    name: "Aethel & Umbra",
    color: "#f39c12",
    maxHP: 280,
    init: (b, state, spawnEnemy) => {
        const partner = state.enemies.find(e => e.id === 'aethel_and_umbra' && e !== b);
        if (!partner) {
            b.role = Math.random() < 0.5 ? 'Aethel' : 'Umbra';
            const partnerBoss = spawnEnemy(true, 'aethel_and_umbra');
            if (partnerBoss) {
                partnerBoss.role = b.role === 'Aethel' ? 'Umbra' : 'Aethel';
                b.partner = partnerBoss;
                partnerBoss.partner = b;
                if (partnerBoss.logic) partnerBoss.logic(partnerBoss, null, state, null, null);
            }
        }
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
        if (b.enraged && ctx) {
            const absorbedColor = b.role === 'Aethel' ? '#e74c3c' : '#3498db';
            ctx.strokeStyle = absorbedColor;
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
},
// ... (The other original bosses remain unchanged) ...
{
    id: "singularity",
    name: "The Singularity",
    color: "#000000",
    maxHP: 600,
    init: (b, state, spawnEnemy, canvas) => {
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
        if (b.beamTarget && Date.now() > b.lastAction + 1000) { b.beamTarget = null; }
        if (hpPercent <= 0.33 && b.phase < 3) {
            b.phase = 3; gameHelpers.play('finalBossPhaseSound'); utils.triggerScreenShake(500, 15); utils.spawnParticles(state.particles, b.x, b.y, "#d63031", 150, 8, 50); b.lastAction = Date.now(); b.wells = [];
        } else if (hpPercent <= 0.66 && b.phase < 2) {
            b.phase = 2; gameHelpers.play('finalBossPhaseSound'); utils.triggerScreenShake(500, 10); utils.spawnParticles(state.particles, b.x, b.y, "#6c5ce7", 150, 8, 50); b.lastAction = Date.now(); b.wells = [];
        }
        switch (b.phase) {
            case 1:
                if (Date.now() - b.lastAction > 5000) {
                    b.lastAction = Date.now(); b.wells = [];
                    for (let i = 0; i < 4; i++) { b.wells.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 40, endTime: Date.now() + 4000 }); }
                }
                b.wells.forEach(w => {
                    if (Date.now() < w.endTime) {
                        utils.drawCircle(ctx, w.x, w.y, w.r, "rgba(155, 89, 182, 0.3)");
                        const dx = state.player.x - w.x, dy = state.player.y - w.y;
                        if (Math.hypot(dx, dy) < w.r + state.player.r) { state.player.x -= dx * 0.08; state.player.y -= dy * 0.08; }
                    }
                });
                break;
            case 2:
                if (Date.now() - b.lastAction > 4000) {
                    b.lastAction = Date.now();
                    state.effects.push({ type: 'glitch_zone', x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 100, endTime: Date.now() + 3000 });
                    b.beamTarget = { x: Math.random() * canvas.width, y: Math.random() * canvas.height };
                }
                break;
            case 3:
                if (!b.teleportingAt && Date.now() - b.lastAction > 2000) {
                    b.teleportingAt = Date.now() + 1000;
                    const targetX = Math.random() * canvas.width, targetY = Math.random() * canvas.height;
                    b.teleportTarget = { x: targetX, y: targetY };
                    state.effects.push({ type: 'teleport_indicator', x: targetX, y: targetY, r: b.r, endTime: b.teleportingAt });
                }
                if (b.teleportingAt && Date.now() > b.teleportingAt) {
                    utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
                    b.x = b.teleportTarget.x; b.y = b.teleportTarget.y;
                    utils.spawnParticles(state.particles, b.x, b.y, "#fff", 30, 4, 20);
                    b.teleportingAt = null; b.lastAction = Date.now();
                    for (let i = 0; i < 3; i++) {
                        const spore = gameHelpers.spawnEnemy(false, null, { x: b.x, y: b.y });
                        if (spore) { spore.r = 10; spore.hp = 1; spore.dx = (Math.random() - 0.5) * 8; spore.dy = (Math.random() - 0.5) * 8; spore.ignoresPlayer = true; }
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
                    if (state.player.shield) { state.player.shield = false; gameHelpers.play('shieldBreak'); } else { state.player.health -= 2; }
                }
            }
        }
    }
},
// --- STAGES 21-30: NEW HARD MODE BOSSES (WITH FIXES) ---
{
    id: "miasma",
    name: "The Miasma",
    color: "#6ab04c",
    maxHP: 400,
    hasCustomMovement: true, // ADDED: To ensure it ignores decoys
    init: (b, state, spawnEnemy, canvas) => {
        b.vents = [{x: canvas.width * 0.2, y: canvas.height * 0.2}, {x: canvas.width * 0.8, y: canvas.height * 0.2}, {x: canvas.width * 0.2, y: canvas.height * 0.8}, {x: canvas.width * 0.8, y: canvas.height * 0.8}].map(v => ({...v, cooldownUntil: 0}));
        b.isGasActive = false;
        b.lastGasAttack = Date.now();
        b.isChargingSlam = false;
    },
    hasCustomDraw: true,
    logic: (b, ctx, state, utils, gameHelpers) => {
        // MOVEMENT LOGIC: Always target player, ignore decoys
        const speed = 0.005;
        const vx = (state.player.x - b.x) * speed;
        const vy = (state.player.y - b.y) * speed;
        b.x += vx;
        b.y += vy;
        
        const pulsatingSize = b.r + Math.sin(Date.now() / 300) * 5;
        utils.drawCircle(ctx, b.x, b.y, pulsatingSize, b.isGasActive ? '#6ab04c' : '#a4b0be');
        b.vents.forEach(v => {
            ctx.globalAlpha = Date.now() < v.cooldownUntil ? 0.3 : 1.0;
            utils.drawCircle(ctx, v.x, v.y, 30, '#7f8c8d');
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
},
// ... (The other 9 new bosses follow here, with their canvas fixes) ...
{
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
            // FIX: Use ctx.canvas instead of canvas
            const boxSize = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.8;
            state.effects.push({
                type: 'shrinking_box',
                startTime: Date.now(),
                duration: 6000, // FASTER: Was 8000
                x: state.player.x,
                y: state.player.y,
                initialSize: boxSize,
            });
        }
    },
    onDeath: (b, state, sE, sP, play, stopLoopingSfx) => {
        // ADDED: Cleanup logic
        state.effects = state.effects.filter(e => e.type !== 'shrinking_box');
        stopLoopingSfx('wallShrink');
    }
},
{
    id: "shaper_of_fate",
    name: "The Shaper of Fate",
    color: "#f1c40f",
    maxHP: 600,
    init: (b) => {
        b.lastZoneSpawn = 0;
        b.zonesActive = false;
    },
    logic: (b, ctx, state, utils, gameHelpers) => {
        if (!b.zonesActive && Date.now() - b.lastZoneSpawn > 10000) {
            b.zonesActive = true;
            b.lastZoneSpawn = Date.now();
            gameHelpers.play('shaperAppear');
            const zonePositions = [{x: 0.2, y: 0.5}, {x: 0.5, y: 0.2}, {x: 0.8, y: 0.8}];
            const types = ['reckoning', 'alacrity', 'ruin'];
            zonePositions.forEach((pos, i) => {
                state.effects.push({
                    type: 'shaper_zone',
                    zoneType: types[i],
                    // FIX: Use ctx.canvas instead of canvas
                    x: ctx.canvas.width * pos.x,
                    y: ctx.canvas.height * pos.y,
                    r: 100,
                    attuneTime: 3000,
                    playerInsideTime: null,
                    boss: b,
                    endTime: Date.now() + 8000
                });
            });
        }
    }
},
// (The other new boss definitions with their canvas fixes would be here too)
];

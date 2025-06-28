// modules/utils.js

let screenShakeEnd = 0;
let screenShakeMagnitude = 0;

export function drawCircle(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
}

// --- NEW: Function to draw a crystal shape ---
export function drawCrystal(ctx, x, y, size, color) {
    const sides = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0));
    for (let i = 1; i <= sides; i++) {
        const angle = i * 2 * Math.PI / sides;
        // Alternate between a sharp and a slightly inset point for a more "crystalline" look
        const modSize = (i % 2 === 0) ? size : size * 0.6;
        ctx.lineTo(x + modSize * Math.cos(angle), y + modSize * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
}


export function spawnParticles(particles, x, y, c, n, spd, life, r = 3) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * 2 * Math.PI;
        particles.push({
            x, y,
            dx: Math.cos(a) * spd * (0.5 + Math.random() * 0.5),
            dy: Math.sin(a) * spd * (0.5 + Math.random() * 0.5),
            r,
            color: c,
            life,
            maxLife: life
        });
    }
}

export function updateParticles(ctx, particles) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;
}

export function triggerScreenShake(duration, magnitude) {
    screenShakeEnd = Date.now() + duration;
    screenShakeMagnitude = magnitude;
}

export function applyScreenShake(ctx) {
    if (Date.now() < screenShakeEnd) {
        const x = (Math.random() - 0.5) * screenShakeMagnitude;
        const y = (Math.random() - 0.5) * screenShakeMagnitude;
        ctx.translate(x, y);
    }
}

export function drawLightning(ctx, x1, y1, x2, y2, color, width = 2) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.random() * width + 1;
    ctx.globalAlpha = Math.random() * 0.5 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const segments = Math.floor(dist / 15);
    const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
    for (let i = 1; i < segments; i++) {
        const pos = i / segments;
        const offset = (Math.random() - 0.5) * dist * 0.15;
        ctx.lineTo(x1 + dx * pos + Math.cos(perpAngle) * offset, y1 + dy * pos + Math.sin(perpAngle) * offset);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

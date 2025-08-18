// modules/utils.js
//
// Utility drawing and particle helpers.  This file is a near verbatim
// reproduction of the upstream project's utils.js but with additional
// helper functions to draw rings and fog used by the redesigned
// aberration core system.  Having these helpers in one place keeps
// rendering logic encapsulated and easier to maintain.

let screenShakeEnd = 0;
let screenShakeMagnitude = 0;

export function drawCircle(ctx, x, y, r, c) {
  if (r <= 0) return; // Safeguard to prevent negative radius errors
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}

export function drawCrystal(ctx, x, y, size, color) {
  const sides = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0));
  for (let i = 1; i <= sides; i++) {
    const angle = i * 2 * Math.PI / sides;
    const modSize = (i % 2 === 0) ? size : size * 0.6;
    ctx.lineTo(x + modSize * Math.cos(angle), y + modSize * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws a player‑shaped circle.  Used for echoes and shadow copies.
 */
export function drawPlayer(ctx, player, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, 2 * Math.PI);
  ctx.fill();
}

/**
 * Draws a shadow cone from a source point, occluded by a shadow‑casting
 * object.  Used for the player's Annihilator core effect.
 */
export function drawShadowCone(ctx, sourceX, sourceY, shadowCaster, color) {
  const distToCaster = Math.hypot(shadowCaster.x - sourceX, shadowCaster.y - sourceY);
  const safeRadius = shadowCaster.r * 1.5;
  if (distToCaster <= safeRadius) return; // Source is inside the caster's safe zone
  const angleToCaster = Math.atan2(shadowCaster.y - sourceY, shadowCaster.x - sourceX);
  const angleToTangent = Math.asin(safeRadius / distToCaster);
  const angle1 = angleToCaster - angleToTangent;
  const angle2 = angleToCaster + angleToTangent;
  const t1x = shadowCaster.x + safeRadius * Math.cos(angle1);
  const t1y = shadowCaster.y + safeRadius * Math.sin(angle1);
  const t2x = shadowCaster.x + safeRadius * Math.cos(angle2);
  const t2y = shadowCaster.y + safeRadius * Math.sin(angle2);
  const maxDist = Math.hypot(ctx.canvas.width, ctx.canvas.height) * 2;
  const p1x = t1x + maxDist * (t1x - sourceX) / distToCaster;
  const p1y = t1y + maxDist * (t1y - sourceY) / distToCaster;
  const p2x = t2x + maxDist * (t2x - sourceX) / distToCaster;
  const p2y = t2y + maxDist * (t2y - sourceY) / distToCaster;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(t1x, t1y);
  ctx.lineTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.lineTo(t2x, t2y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Determines whether a point lies within the shadow cast by an object.
 */
export function isPointInShadow(shadowCaster, point, sourceX, sourceY) {
  const distToCaster = Math.hypot(shadowCaster.x - sourceX, shadowCaster.y - sourceY);
  const safeRadius = shadowCaster.r * 1.5;
  if (distToCaster <= safeRadius) return false;
  const angleToCaster = Math.atan2(shadowCaster.y - sourceY, shadowCaster.x - sourceX);
  const angleToTangent = Math.asin(safeRadius / distToCaster);
  const pointAngle = Math.atan2(point.y - sourceY, point.x - sourceX);
  let angleDiff = (pointAngle - angleToCaster);
  while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  return Math.abs(angleDiff) < angleToTangent && Math.hypot(point.x - sourceX, point.y - sourceY) > distToCaster;
}

export function spawnParticles(particles, x, y, c, n, spd, life, r = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 2 * Math.PI;
    particles.push({
      x,
      y,
      dx: Math.cos(a) * spd * (0.5 + Math.random() * 0.5),
      dy: Math.sin(a) * spd * (0.5 + Math.random() * 0.5),
      r,
      color: c,
      life,
      maxLife: life,
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
    if (p.r > 0) {
      ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
      ctx.fill();
    }
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
  const dx = x2 - x1,
    dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const segments = Math.floor(dist / 15);
  const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
  for (let i = 1; i < segments; i++) {
    const pos = i / segments;
    const offset = (Math.random() - 0.5) * dist * 0.15;
    ctx.lineTo(
      x1 + dx * pos + Math.cos(perpAngle) * offset,
      y1 + dy * pos + Math.sin(perpAngle) * offset,
    );
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function randomInRange(min, max) {
  // Guard against callers accidentally passing arguments in the wrong order.
  if (min > max) [min, max] = [max, min];
  return Math.random() * (max - min) + min;
}

export function lineCircleCollision(x1, y1, x2, y2, cx, cy, r) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len === 0) return Math.hypot(cx - x1, cy - y1) <= r; // Handle case where line is a point
  const dot = (((cx - x1) * (x2 - x1)) + ((cy - y1) * (y2 - y1))) / Math.pow(len, 2);
  const closestX = x1 + dot * (x2 - x1);
  const closestY = y1 + dot * (y2 - y1);
  const onSegment = () => {
    const d1 = Math.hypot(closestX - x1, closestY - y1);
    const d2 = Math.hypot(closestX - x2, closestY - y2);
    // Compare using an absolute tolerance to avoid floating point drift.
    return Math.abs(d1 + d2 - len) <= 0.1;
  };
  if (!onSegment()) {
    const dist1 = Math.hypot(cx - x1, cy - y1);
    const dist2 = Math.hypot(cx - x2, cy - y2);
    return dist1 <= r || dist2 <= r;
  }
  const dist = Math.hypot(cx - closestX, cy - closestY);
  return dist <= r;
}

/* -------------------------------------------------------------------------- */
/* Additional helpers                             */
/*
 * These helpers provide higher level drawing primitives used by the new
 * aberration core effects.  Rings are used for gravity pulses, while fog
 * overlays are used for the miasma gas effect.  Keeping them here allows
 * gameLoop.js to remain focused on logic rather than drawing details.
 */

/**
 * Draw an annulus (ring) with separate inner and outer radii.  Useful for
 * representing expanding pulses.  An optional alpha value can be used to
 * fade the ring over time.
 */
export function drawRing(ctx, x, y, innerR, outerR, color, alpha = 1.0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, outerR, 0, Math.PI * 2);
  ctx.arc(x, y, innerR, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a full‑screen fog overlay.  The colour and alpha determine the
 * appearance of the fog.  This helper is used by the miasma effect to
 * tint the screen when the player or enemies are affected.
 */
export function drawFog(ctx, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// modules/gameLoop.js
import { state } from './state.js';
import { THEMATIC_UNLOCKS, SPAWN_WEIGHTS } from './config.js';
import { powers, offensivePowers } from './powers.js';
import { bossData } from './bosses.js';
import { updateUI, showBossBanner } from './ui.js';
import * as utils from './utils.js';
import { AudioManager } from './audio.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Helper to simplify audio calls within this module
function play(soundId) {
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) {
        AudioManager.playSfx(soundElement);
    }
}
function stopLoopingSfx(soundId) {
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) {
        AudioManager.stopLoopingSfx(soundElement);
    }
}


// --- Progression System ---

export function addStatusEffect(name, emoji, duration) {
    const now = Date.now();
    state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== name);
    state.player.statusEffects.push({ name, emoji, startTime: now, endTime: now + duration });
}

function handleThematicUnlock(level) {
    const unlock = THEMATIC_UNLOCKS[level];
    if (!unlock) return;

    if (unlock.type === 'power') {
        state.player.unlockedPowers.add(unlock.id);
    }
}

function levelUp() {
    state.player.level++;
    state.player.essence -= state.player.essenceToNextLevel;
    state.player.essenceToNextLevel = Math.floor(state.player.essenceToNextLevel * 1.5);
    state.player.ascensionPoints += 2;
    handleThematicUnlock(state.player.level);
    utils.spawnParticles(state.player.x, state.player.y, '#00ffff', 80, 6, 50, 5);
}

export function addEssence(amount) {
    if (state.gameOver) return;
    state.player.essence += amount;
    while (state.player.essence >= state.player.essenceToNextLevel) {
        levelUp();
    }
}

// --- Spawning Logic ---

export function spawnEnemy(isBoss = false, bossId = null, location = null) {
    const e = {
        x: location ? location.x : Math.random() * canvas.width,
        y: location ? location.y : Math.random() * canvas.height,
        dx: (Math.random() - 0.5) * 0.75,
        dy: (Math.random() - 0.5) * 0.75,
        r: isBoss ? 50 : 15,
        hp: isBoss ? 200 : 1,
        maxHP: isBoss ? 200 : 1,
        boss: isBoss,
        frozen: false,
        targetBosses: false
    };

    if (isBoss) {
        const bossIndex = (state.player.level - 1) % bossData.length;
        const bd = bossId ? bossData.find(b => b.id === bossId) : bossData[state.arenaMode ? Math.floor(Math.random() * bossData.length) : bossIndex];
        if (!bd) { console.error("Boss data not found for level", state.player.level); return null; }
        Object.assign(e, bd);
        e.maxHP = bd.maxHP || e.maxHP;
        e.hp = e.maxHP;
        state.enemies.push(e);
        if (bd.init) bd.init(e, state, spawnEnemy);
        if (!state.currentBoss || state.currentBoss.hp <= 0) { state.currentBoss = e; }
        state.bossActive = true;
        if (!bossId || (bossId && !e.partner && !e.shadow)) { showBossBanner(e); }
    } else {
        state.enemies.push(e);
    }
    if (state.arenaMode) { e.target = null; e.lastTargetCheck = 0; }
    return e;
}

export function spawnPickup() {
    const available = [...state.player.unlockedPowers];
    if (available.length === 0) return;

    const types = [];
    for (const type of available) {
        const weight = SPAWN_WEIGHTS[type] || 1;
        for (let i = 0; i < weight; i++) types.push(type);
    }
    const type = types[Math.floor(Math.random() * types.length)];
    state.pickups.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, dx: (Math.random() - 0.5) * 1, dy: (Math.random() - 0.5) * 1, r: 12, type });
}


// --- The Main Game Tick ---
export function gameTick(mx, my) {
    if (state.isPaused) return true;
    if (state.gameOver) {
        stopLoopingSfx("beamHum");
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "48px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "left";
        return false;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    utils.applyScreenShake(ctx);
    
    let finalMx = mx; let finalMy = my;
    if (state.player.controlsInverted) { finalMx = state.player.x - (mx - state.player.x); finalMy = state.player.y - (my - state.player.y); ctx.strokeStyle = '#fd79a8'; ctx.lineWidth = 5; ctx.strokeRect(0, 0, canvas.width, canvas.height); }
    
    let playerSpeedMultiplier = 1;
    state.effects.forEach(effect => { if(effect.type === 'slow_zone' && Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r) { playerSpeedMultiplier = 0.5; } });

    if (Date.now() > state.player.stunnedUntil) { state.player.x+=(finalMx-state.player.x)*0.015*state.player.speed * playerSpeedMultiplier; state.player.y+=(finalMy-state.player.y)*0.015*state.player.speed * playerSpeedMultiplier; }
    
    const architect = state.enemies.find(e => e.id === 'architect');
    if(architect && architect.pillars) {
        architect.pillars.forEach(pillar => {
            const dist = Math.hypot(state.player.x - pillar.x, state.player.y - pillar.y);
            if (dist < state.player.r + pillar.r) {
                const angle = Math.atan2(state.player.y - pillar.y, state.player.x - pillar.x);
                state.player.x = pillar.x + Math.cos(angle) * (state.player.r + pillar.r);
                state.player.y = pillar.y + Math.sin(angle) * (state.player.r + pillar.r);
            }
        });
    }

    if (state.player.infected) { if (Date.now() > state.player.infectionEnd) { state.player.infected = false; } else if (Date.now() - state.player.lastSpore > 2000) { state.player.lastSpore = Date.now(); const spore = spawnEnemy(false, null, {x: state.player.x, y: state.player.y}); if(spore){ spore.r = 8; spore.hp = 2; spore.dx = (Math.random() - 0.5) * 8; spore.dy = (Math.random() - 0.5) * 8; spore.ignoresPlayer = true; } } }
    
    const annihilator = state.enemies.find(e => e.id === 'annihilator' && e.pillar);
    if (annihilator) { const pillar = annihilator.pillar; const dx = state.player.x - pillar.x; const dy = state.player.y - pillar.y; const dist = Math.hypot(dx, dy); if (dist < state.player.r + pillar.r) { const angle = Math.atan2(dy, dx); state.player.x = pillar.x + Math.cos(angle) * (state.player.r + pillar.r); state.player.y = pillar.y + Math.sin(angle) * (state.player.r + pillar.r); } }
    
    const isBerserk = state.player.berserkUntil > Date.now();
    if(state.player.shield){ ctx.strokeStyle="rgba(241,196,15,0.7)"; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(state.player.x,state.player.y,state.player.r+8,0,2*Math.PI); ctx.stroke(); }
    utils.drawCircle(ctx, state.player.x,state.player.y,state.player.r, state.player.shield?"#f1c40f": (isBerserk ? '#e74c3c' : (state.player.infected ? '#55efc4' : "#3498db")));
    if(state.decoy){ utils.drawCircle(ctx, state.decoy.x,state.decoy.y,state.decoy.r,"#9b59b6"); if(Date.now()>state.decoy.expires) state.decoy=null; }
    const gravOn = state.gravityActive && Date.now()<state.gravityEnd;
    if(gravOn){ const t=(state.gravityEnd-Date.now())/1000; ctx.strokeStyle=`rgba(155, 89, 182, ${t * 0.5})`; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2, 50+(1-t)*400,0,2*Math.PI); ctx.stroke(); }
    
    for(let i=state.enemies.length-1;i>=0;i--){
      const e=state.enemies[i];
      if(e.hp<=0){ 
        if(e.boss) { 
            utils.triggerScreenShake(250, 5);
            addEssence(250); // Grant essence for boss kill
            if(e.onDeath) e.onDeath(e, state, spawnEnemy, utils.spawnParticles, play, stopLoopingSfx); 
            state.enemies.splice(i,1); 
            if (state.currentBoss === e) { state.currentBoss = state.enemies.find(en => en.boss) || null; } 
            if (!state.enemies.some(en => en.boss)) { state.bossActive = false; } 
        } else { 
            addEssence(5); // Grant essence for normal kill
            state.enemies.splice(i,1); 
        } 
        continue; 
    }
      
      if (e.eatenBy) { 
          const pullX = e.eatenBy.x - e.x; const pullY = e.eatenBy.y - e.y;
          const pullDist = Math.hypot(pullX, pullY) || 1;
          e.dx = (pullX / pullDist) * 3; e.dy = (pullY / pullDist) * 3;
          e.x += e.dx; e.y += e.dy;
          e.r *= 0.95; 
          if(e.r < 2) {
              const timeEater = state.enemies.find(b => b.id === 'time_eater'); 
              if (timeEater) { timeEater.hp -= 5; }
              utils.spawnParticles(e.x, e.y, "#d63031", 10, 2, 15); 
              state.enemies.splice(i, 1); 
              continue;
          }
      }
      
      if (state.arenaMode) {
          const now = Date.now();
          if (now - e.lastTargetCheck > 10000) {
              e.lastTargetCheck = now;
              const potentialTargets = [state.player, ...state.enemies.filter(other => other !== e)];
              let closestTarget = null;
              let minDistance = Infinity;
              potentialTargets.forEach(pTarget => {
                  if (pTarget.hp > 0 || pTarget.health > 0) {
                      const dist = Math.hypot(e.x - pTarget.x, e.y - pTarget.y);
                      if (dist < minDistance) {
                          minDistance = dist;
                          closestTarget = pTarget;
                      }
                  }
              });
              e.target = closestTarget;
          }
      }

      if(!e.frozen && !e.hasCustomMovement){ 
          let tgt; 
          let pullFactor = 0.005; 
          let baseDx = e.dx; 
          let baseDy = e.dy; 
          if (!e.ignoresPlayer) { 
              if (state.arenaMode && e.target) {
                  tgt = e.target;
              } else if (gravOn && !e.boss) { 
                  tgt = { x: canvas.width / 2, y: canvas.height / 2 }; pullFactor = 0.1; baseDx = 0; baseDy = 0; 
              } else { 
                  tgt = state.decoy || state.player; 
              } 
              if (tgt) {
                const vx = (tgt.x - e.x) * pullFactor; 
                const vy = (tgt.y - e.y) * pullFactor; 
                e.x += vx; e.y += vy; 
              }
          } 
          let enemySpeedMultiplier = 1; 
          state.effects.forEach(effect => { if(effect.type === 'slow_zone' && Math.hypot(e.x - effect.x, e.y - effect.y) < effect.r) { enemySpeedMultiplier = 0.5; } }); 
          e.x += baseDx * enemySpeedMultiplier; e.y += baseDy * enemySpeedMultiplier; 
          if(e.x<e.r || e.x>canvas.width-e.r) e.dx*=-1; 
          if(e.y<e.r || e.y>canvas.height-e.r) e.dy*=-1; 
      }

      if (state.arenaMode) {
          for (let j = i - 1; j >= 0; j--) {
              const other = state.enemies[j];
              const enemyDist = Math.hypot(e.x - other.x, e.y - other.y);
              if (enemyDist < e.r + other.r) {
                  e.hp -= 1;
                  other.hp -= 1;
                  const angle = Math.atan2(e.y - other.y, e.x - other.x);
                  const overlap = e.r + other.r - enemyDist;
                  e.x += Math.cos(angle) * overlap * 0.5;
                  e.y += Math.sin(angle) * overlap * 0.5;
                  other.x -= Math.cos(angle) * overlap * 0.5;
                  other.y -= Math.sin(angle) * overlap * 0.5;
              }
          }
      }

      if (annihilator) { const pillar = annihilator.pillar; const dx = e.x - pillar.x; const dy = e.y - pillar.y; const dist = Math.hypot(dx, dy); if (dist < e.r + pillar.r) { const angle = Math.atan2(dy, dx); e.x = pillar.x + Math.cos(angle) * (e.r + pillar.r); e.y = pillar.y + Math.sin(angle) * (e.r + pillar.r); }}
      if (e.isInfected) { if (Date.now() > e.infectionEnd) { e.isInfected = false; } else if (Date.now() - e.lastSpore > 3000) { e.lastSpore = Date.now(); const spore = spawnEnemy(false, null, {x: e.x, y: e.y}); if (spore) { spore.r = 6; spore.hp = 1; spore.dx = (Math.random() - 0.5) * 8; spore.dy = (Math.random() - 0.5) * 8; spore.ignoresPlayer = true; } } }
      if(e.boss && e.logic) e.logic(e, ctx, state, utils, play, stopLoopingSfx);
      
      let color = e.customColor || (e.boss ? e.color : "#c0392b"); if(e.isInfected) color = '#55efc4'; if(e.frozen) color = '#add8e6';
      if(!e.hasCustomDraw) { utils.drawCircle(ctx, e.x,e.y,e.r, color); }
      if(e.enraged) { ctx.strokeStyle = "yellow"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x,e.y,e.r+5,0,2*Math.PI); ctx.stroke(); }
      
      const pDist=Math.hypot(state.player.x-e.x,state.player.y-e.y);
      if(pDist < e.r+state.player.r){ 
          if (e.onCollision) e.onCollision(e, state.player, addStatusEffect); 
          if(!state.player.shield){ 
              let damage = e.boss ? (e.enraged ? 20 : 10) : 1; 
              if (isBerserk) damage *= 2; 
              state.player.health -= damage; 
              play('hit'); 
              if(e.onDamage) e.onDamage(e, damage, state.player, state, utils.spawnParticles); 
              if(state.player.health<=0) state.gameOver=true; 
            } else { 
                state.player.shield=false; 
            } 
            const ang=Math.atan2(state.player.y-e.y,state.player.x-e.x); 
            state.player.x=e.x+Math.cos(ang)*(e.r+state.player.r); 
            state.player.y=e.y+Math.sin(ang)*(e.r+state.player.r); 
        }
    }

    for(let i=state.pickups.length-1;i>=0;i--){
      const p=state.pickups[i]; if(p.eatenBy) { const pullX = p.eatenBy.x - p.x; const pullY = p.eatenBy.y - p.y; p.dx = (pullX / (Math.hypot(pullX, pullY) || 1)) * 3; p.dy = (pullY / (Math.hypot(pullX, pullY) || 1)) * 3; p.r *= 0.95; if(p.r < 2) { const timeEater = state.enemies.find(e => e.id === 'time_eater'); if (timeEater) timeEater.hp = Math.min(timeEater.maxHP, timeEater.hp + 10); utils.spawnParticles(p.x, p.y, "#fff", 10, 2, 15); state.pickups.splice(i, 1); continue; } }
      if (p.life && Date.now() > p.life) { state.pickups.splice(i, 1); continue; }
      p.x += p.dx || 0; p.y += p.dy || 0;
      let radius = p.r; let color = "#2ecc71"; if (p.life) { radius = p.r + Math.sin(Date.now() / 200) * 2; color = "#800020"; }
      utils.drawCircle(ctx, p.x,p.y,radius,color); ctx.fillStyle="#fff"; ctx.font="16px sans-serif"; ctx.textAlign = "center"; ctx.fillText(powers[p.type].emoji, p.x, p.y+6); ctx.textAlign = "left";
      const d=Math.hypot(state.player.x-p.x,state.player.y-p.y);
      if(d<state.player.r+radius && !p.eatenBy){ if(p.customApply) { p.customApply(); play('pickup'); state.pickups.splice(i,1); continue; } const isOffensive = offensivePowers.includes(p.type); const targetInventory = isOffensive ? state.offensiveInventory : state.defensiveInventory; const idx=targetInventory.indexOf(null); if(idx!==-1){ targetInventory[idx]=p.type; play('pickup'); state.pickups.splice(i,1); } else { utils.spawnParticles(p.x, p.y, "#f00", 15, 2, 20); state.pickups.splice(i,1); } }
    }
    
    const timeEater = state.enemies.find(e => e.id === 'time_eater');
    const slowZones = state.effects.filter(e => e.type === 'slow_zone');
    if (timeEater && slowZones.length > 0) {
      for(const zone of slowZones) {
          for (let i = state.pickups.length - 1; i >= 0; i--) { const p = state.pickups[i]; if (!p.eatenBy && Math.hypot(p.x - zone.x, p.y - zone.y) < zone.r) { p.eatenBy = zone; } }
          for (let i = state.enemies.length - 1; i >= 0; i--) { const e = state.enemies[i]; if (!e.boss && !e.eatenBy && Math.hypot(e.x - zone.x, e.y - zone.y) < zone.r) { e.eatenBy = zone; } }
      }
    }

    state.effects.forEach((effect, index) => {
      if (effect.type === 'shockwave') { const elapsed = (Date.now() - effect.startTime) / 1000; effect.radius = elapsed * effect.speed; ctx.strokeStyle = `rgba(255, 255, 255, ${1 - (effect.radius / effect.maxRadius)})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2 * Math.PI); ctx.stroke(); let targets; if (effect.caster === state.player) { targets = state.enemies; } else { targets = state.arenaMode ? [state.player, ...state.enemies.filter(e => e !== effect.caster)] : [state.player]; } targets.forEach(target => { if (!effect.hitEnemies.has(target) && Math.abs(Math.hypot(target.x - effect.x, target.y - effect.y) - effect.radius) < target.r + 5) { let dmg = target.boss ? effect.damage : 1000; if(target.health) target.health -= dmg; else target.hp -= dmg; if(target.onDamage) target.onDamage(target, dmg, effect.caster); effect.hitEnemies.add(target); } }); if (effect.radius >= effect.maxRadius) state.effects.splice(index, 1);
      } else if (effect.type === 'chain_lightning') { const linkIndex = Math.floor((Date.now() - effect.startTime) / effect.durationPerLink); if (linkIndex >= effect.targets.length) { state.effects.splice(index, 1); return; } for (let i=0; i <= linkIndex; i++) { const from = i === 0 ? effect.caster : effect.targets[i-1]; const to = effect.targets[i]; if (!from || !to) continue; utils.drawLightning(ctx, from.x, from.y, to.x, to.y, '#00ffff', 4); if (!effect.links.includes(to)) { utils.spawnParticles(to.x, to.y, '#ffffff', 30, 5, 20); to.hp -= to.boss ? effect.damage : 50; if(to.onDamage) to.onDamage(to, effect.damage, effect.caster); effect.links.push(to); } }
      } else if (effect.type === 'repulsion_field') { if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; } effect.x = state.player.x; effect.y = state.player.y; const alpha = (effect.endTime - Date.now()) / 5000 * 0.4; ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.radius, 0, 2*Math.PI); ctx.stroke(); state.enemies.forEach(e => { if (e.boss) return; const dist = Math.hypot(e.x - effect.x, e.y - effect.y); if (dist < effect.radius) { const angle = Math.atan2(e.y - effect.y, e.x - effect.x); e.x += Math.cos(angle) * 5; e.y += Math.sin(angle) * 5; } });
      } else if (effect.type === 'black_hole') { if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; } const progress = 1 - (effect.endTime - Date.now()) / 4000; const currentPullRadius = effect.maxRadius * progress; utils.drawCircle(ctx, effect.x, effect.y, effect.radius, "#000"); ctx.strokeStyle = `rgba(155, 89, 182, ${0.6 * progress})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, currentPullRadius, 0, 2*Math.PI); ctx.stroke(); state.enemies.forEach(e => { const dist = Math.hypot(e.x - effect.x, e.y - effect.y); if (dist < currentPullRadius) { const pullStrength = e.boss ? 0.03 : 0.1; e.x += (effect.x - e.x) * pullStrength; e.y += (effect.y - e.y) * pullStrength; if (dist < effect.radius + e.r && Date.now() - effect.lastDamage > effect.damageRate) { e.hp -= e.boss ? effect.damage : 15; effect.lastDamage = Date.now(); } } });
      } else if (effect.type === 'glitch_zone') { if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; } const alpha = (effect.endTime - Date.now()) / 5000 * 0.3; ctx.fillStyle = `rgba(253, 121, 168, ${alpha})`; utils.drawCircle(ctx, effect.x, effect.y, effect.r, ctx.fillStyle); if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r + state.player.r) { if (!state.player.controlsInverted) { play('systemError'); addStatusEffect('Controls Inverted', '😵', 3000); } state.player.controlsInverted = true; setTimeout(() => state.player.controlsInverted = false, 3000); }
      } else if (effect.type === 'petrify_zone') { if (Date.now() > effect.startTime + 5000) { state.effects.splice(index, 1); return; } ctx.fillStyle = `rgba(0, 184, 148, 0.2)`; utils.drawCircle(ctx, effect.x, effect.y, effect.r, ctx.fillStyle); if (Math.hypot(state.player.x - effect.x, state.player.y - effect.y) < effect.r) { if(!effect.playerInsideTime) effect.playerInsideTime = Date.now(); const stunProgress = (Date.now() - effect.playerInsideTime) / 1500; ctx.fillStyle = `rgba(0, 184, 148, 0.4)`; ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.arc(effect.x, effect.y, effect.r, -Math.PI/2, -Math.PI/2 + (Math.PI*2) * stunProgress, false); ctx.lineTo(effect.x, effect.y); ctx.fill(); if (stunProgress >= 1) { play('stoneCracking'); addStatusEffect('Petrified', '🗿', 2000); state.player.stunnedUntil = Date.now() + 2000; state.effects.splice(index, 1); } } else { effect.playerInsideTime = null; }
      } else if (effect.type === 'annihilator_beam') { if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; } const { source, pillar } = effect; if(!source || !pillar || source.hp <= 0) { state.effects.splice(index, 1); return; } const alpha = (effect.endTime - Date.now()) / 1200; ctx.fillStyle = `rgba(214, 48, 49, ${alpha * 0.7})`; const distToPillar = Math.hypot(pillar.x - source.x, pillar.y - source.y); const angleToPillar = Math.atan2(pillar.y - source.y, pillar.x - source.x); const angleToTangent = Math.asin(pillar.r / distToPillar); const angle1 = angleToPillar - angleToTangent; const angle2 = angleToPillar + angleToTangent; const maxDist = Math.hypot(canvas.width, canvas.height) * 2; const p1x = source.x + maxDist * Math.cos(angle1); const p1y = source.y + maxDist * Math.sin(angle1); const p2x = source.x + maxDist * Math.cos(angle2); const p2y = source.y + maxDist * Math.sin(angle2); ctx.beginPath(); ctx.rect(-1000, -1000, canvas.width+2000, canvas.height+2000); ctx.moveTo(source.x, source.y); ctx.lineTo(p1x,p1y); ctx.lineTo(p2x,p2y); ctx.closePath(); ctx.fill('evenodd'); const allTargets = state.arenaMode ? [state.player, ...state.enemies.filter(t => t !== source)] : [state.player]; allTargets.forEach(target => { const targetAngle = Math.atan2(target.y - source.y, target.x - source.x); let angleDiff = (targetAngle - angleToPillar + Math.PI * 3) % (Math.PI * 2) - Math.PI; const isSafe = Math.abs(angleDiff) < angleToTangent && Math.hypot(target.x - source.x, target.y - source.y) > distToPillar; if (!isSafe && (target.hp > 0 || target.health > 0)) { if (target === state.player && state.player.shield) return; if(target.health) target.health -= 999; else target.hp -= 999; if (target.health <= 0) state.gameOver = true; } });
      } else if (effect.type === 'slow_zone') { if (Date.now() > effect.endTime) { state.effects.splice(index, 1); return; } const alpha = (effect.endTime - Date.now()) / 5000 * 0.3; for(let i=0; i<3; i++) { ctx.strokeStyle = `rgba(223, 230, 233, ${alpha * (0.5 + Math.sin(Date.now()/200 + i*2)*0.5)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r * (0.6 + i*0.2), 0, Math.PI*2); ctx.stroke(); }
      } else if (effect.type === 'orbital_target') { const duration = 1500; const progress = (Date.now() - effect.startTime) / duration; if (progress >= 1) { utils.spawnParticles(effect.x, effect.y, '#e67e22', 100, 8, 40); const explosionRadius = 150; state.enemies.forEach(e => { if (Math.hypot(e.x-effect.x, e.y-effect.y) < explosionRadius) { let damage = (state.player.berserkUntil > Date.now()) ? 50 : 25; e.hp -= e.boss ? damage : 1000; if(e.onDamage) e.onDamage(e, damage, effect.caster); } }); state.effects.splice(index, 1); return; } ctx.strokeStyle = 'rgba(230, 126, 34, 0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(effect.x, effect.y, 50 * (1-progress), 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(effect.x-10, effect.y); ctx.lineTo(effect.x+10, effect.y); ctx.moveTo(effect.x, effect.y-10); ctx.lineTo(effect.x, effect.y+10); ctx.stroke(); 
      } else if (effect.type === 'juggernaut_charge_ring') { const progress = (Date.now() - effect.startTime) / effect.duration; if (progress >= 1) { state.effects.splice(index, 1); return; } ctx.strokeStyle = `rgba(255,255,255, ${0.8 * (1-progress)})`; ctx.lineWidth = 15; ctx.beginPath(); ctx.arc(effect.source.x, effect.source.y, effect.source.r * progress, 0, Math.PI*2); ctx.stroke();
      } else if (effect.type === 'ricochet_projectile') { effect.x += effect.dx; effect.y += effect.dy; utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#f1c40f'); if(effect.x < effect.r || effect.x > canvas.width - effect.r) { effect.dx *= -1; effect.bounces--; } if(effect.y < effect.r || effect.y > canvas.height - effect.r) { effect.dy *= -1; effect.bounces--; } state.enemies.forEach(e => { if (!effect.hitEnemies.has(e) && Math.hypot(e.x - effect.x, e.y - effect.y) < e.r + effect.r) { let damage = (state.player.berserkUntil > Date.now()) ? 20 : 10; e.hp -= damage; effect.bounces--; const angle = Math.atan2(e.y - effect.y, e.x - effect.x); effect.dx = -Math.cos(angle) * 10; effect.dy = -Math.sin(angle) * 10; effect.hitEnemies.add(e); setTimeout(()=>effect.hitEnemies.delete(e), 200); } }); if (effect.bounces <= 0) state.effects.splice(index, 1);
      } else if (effect.type === 'nova_controller') { if (Date.now() > effect.startTime + effect.duration) { state.effects.splice(index, 1); return; } if(Date.now() - effect.lastShot > 50) { effect.lastShot = Date.now(); const speed = 5; state.effects.push({ type: 'nova_bullet', x: state.player.x, y: state.player.y, r: 4, dx: Math.cos(effect.angle) * speed, dy: Math.sin(effect.angle) * speed }); effect.angle += 0.5; }
      } else if (effect.type === 'nova_bullet') { effect.x += effect.dx; effect.y += effect.dy; utils.drawCircle(ctx, effect.x, effect.y, effect.r, '#fff'); if(effect.x < 0 || effect.x > canvas.width || effect.y < 0 || effect.y > canvas.height) state.effects.splice(index, 1); state.enemies.forEach(e => { if (Math.hypot(e.x-effect.x, e.y-effect.y) < e.r + effect.r) { let damage = (state.player.berserkUntil > Date.now()) ? 6 : 3; e.hp -= damage; state.effects.splice(index, 1); } }); }
    });
    
    utils.updateParticles(ctx);
    updateUI();
    ctx.restore();
    return true;
}
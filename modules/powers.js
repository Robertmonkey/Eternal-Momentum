// modules/powers.js
import { state } from './state.js';
import { AudioManager } from './audio.js';
// We will create these functions in other modules and import them where needed.
// For now, the power 'apply' methods will reference them.

// Helper to simplify audio calls within this module
function play(soundId) {
    AudioManager.playSfx(document.getElementById(soundId + "Sound"));
}

// All power-up definitions
export const powers={
  shield:{emoji:"🛡️",desc:"Blocks damage for 6s",apply:(utils, game)=>{ state.player.shield=true; game.addStatusEffect('Shield', '🛡️', 6000); utils.spawnParticles(state.player.x,state.player.y,"#f1c40f",30,4,30); setTimeout(()=>state.player.shield=false,6000); }},
  heal:{emoji:"❤️",desc:"+30 HP",apply:()=>{ state.player.health=Math.min(state.player.maxHealth,state.player.health+30); }},
  shockwave:{emoji:"💥",desc:"Expanding wave damages enemies",apply:(utils, game)=>{ let damage = (state.player.berserkUntil > Date.now()) ? 30 : 15; state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: Math.max(innerWidth, innerHeight), speed: 800, startTime: Date.now(), hitEnemies: new Set(), damage: damage }); play('shockwave'); }},
  missile:{emoji:"🎯",desc:"AoE explosion damages nearby",apply:(utils, game)=>{ play('shockwave'); let damage = (state.player.berserkUntil > Date.now()) ? 20 : 10; const explosionRadius = 250; utils.triggerScreenShake(200, 8); utils.spawnParticles(state.player.x, state.player.y, "#ff9944", 150, 8, 40, 5); state.enemies.forEach(e => { if (Math.hypot(e.x - state.player.x, e.y - state.player.y) < explosionRadius) { e.hp -= e.boss ? damage : 1000; if(e.onDamage) e.onDamage(e, damage, state.player, state, utils.spawnParticles); } }); }},
  gravity:{emoji:"🌀",desc:"Pulls enemies for 1s",apply:(utils, game)=>{ play('gravity'); state.gravityActive=true; state.gravityEnd=Date.now()+1000; utils.spawnParticles(innerWidth/2, innerHeight/2,"#9b59b6",100,4,40); }},
  speed:{emoji:"🚀",desc:"Speed Boost for 5s",apply:(utils, game)=>{ state.player.speed*=1.5; game.addStatusEffect('Speed Boost', '🚀', 5000); utils.spawnParticles(state.player.x,state.player.y,"#00f5ff",40,3,30); setTimeout(()=>state.player.speed/=1.5,5000); }},
  freeze:{emoji:"🧊",desc:"Freeze enemies for 4s",apply:(utils, game)=>{ state.enemies.forEach(e=>{ if (e.frozen) return; e.frozen=true; e._dx=e.dx; e._dy=e.dy; e.dx=e.dy=0; }); utils.spawnParticles(state.player.x,state.player.y,"#0ff",60,3,30); setTimeout(()=>{ state.enemies.forEach(e=>{ if (!e.frozen) return; e.frozen=false; e.dx=e._dx; e.dy=e._dy; }); },4000); }},
  decoy:{emoji:"🔮",desc:"Decoy lasts 5s",apply:(utils, game)=>{ state.decoy={x:state.player.x,y:state.player.y,r:20,expires:Date.now()+5000}; utils.spawnParticles(state.player.x,state.player.y,"#8e44ad",50,3,30); }},
  stack:{emoji:"🧠",desc:"Double next power-up",apply:(utils, game)=>{ state.stacked=true; game.addStatusEffect('Stacked', '🧠', 60000); utils.spawnParticles(state.player.x,state.player.y,"#aaa",40,4,30); }},
  score: {emoji: "💠", desc: "Permanently +5 Max Health", apply: (utils) => { const healthGain = 5; state.player.maxHealth += healthGain; state.player.health += healthGain; utils.spawnParticles(state.player.x, state.player.y, "#f1c40f", 20, 4, 30); }},
  chain:{emoji:"⚡",desc:"Chain lightning hits 6 targets",apply:(utils, game)=>{ play('chain'); const targets = []; let currentTarget = state.player; for (let i = 0; i < 6; i++) { let closest = null; let minDist = Infinity; state.enemies.forEach(e => { if (!targets.includes(e)) { const dist = Math.hypot(e.x - currentTarget.x, e.y - currentTarget.y); if (dist < minDist) { minDist = dist; closest = e; } } }); if (closest) { targets.push(closest); currentTarget = closest; } else { break; } } let damage = (state.player.berserkUntil > Date.now()) ? 30 : 15; state.effects.push({ type: 'chain_lightning', targets: targets, links: [], startTime: Date.now(), durationPerLink: 80, damage: damage, caster: state.player }); }},
  repulsion: {emoji: "🖐️", desc: "Pushes enemies away for 5s", apply: () => { state.effects.push({ type: 'repulsion_field', x: state.player.x, y: state.player.y, radius: 250, endTime: Date.now() + 5000 }); play('shockwave'); }},
  orbitalStrike: {emoji: "☄️", desc: "Calls 3 meteors on random enemies", apply: () => { const availableTargets = state.enemies.filter(e => !e.boss); for (let i = 0; i < 3; i++) { if (availableTargets.length > 0) { const targetIndex = Math.floor(Math.random() * availableTargets.length); const target = availableTargets.splice(targetIndex, 1)[0]; state.effects.push({type: 'orbital_target', x: target.x, y: target.y, startTime: Date.now(), caster: state.player}); } } }},
  black_hole: {emoji: "⚫", desc: "Pulls and damages enemies for 4s", apply: () => { let damage = (state.player.berserkUntil > Date.now()) ? 6 : 3; state.effects.push({ type: 'black_hole', x: state.player.x, y: state.player.y, radius: 20, maxRadius: 350, damageRate: 200, lastDamage: 0, endTime: Date.now() + 4000, damage: damage, caster: state.player }); play('gravity'); }},
  berserk: {emoji: "💢", desc: "8s: Deal 2x damage, take 2x damage", apply:(utils, game)=>{ state.player.berserkUntil = Date.now() + 8000; game.addStatusEffect('Berserk', '💢', 8000); utils.spawnParticles(state.player.x, state.player.y, "#e74c3c", 40, 3, 30); }},
  ricochetShot: {emoji: "🔄", desc: "Fires a shot that bounces 6 times", apply:(utils, game, mx, my) => { const angle = Math.atan2(my - state.player.y, mx - state.player.x); const speed = 10; state.effects.push({ type: 'ricochet_projectile', x: state.player.x, y: state.player.y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, r: 8, bounces: 6, hitEnemies: new Set(), caster: state.player }); }},
  bulletNova: {emoji: "💫", desc: "Unleashes a spiral of bullets", apply:()=>{ state.effects.push({ type: 'nova_controller', startTime: Date.now(), duration: 2000, lastShot: 0, angle: Math.random() * Math.PI * 2 }); }},
};

export const offensivePowers = ['shockwave', 'missile', 'chain', 'orbitalStrike', 'ricochetShot', 'bulletNova', 'black_hole'];

// This function handles the logic of using a power from the UI.
export function usePower(queueType, utils, game, mx, my){
  let powerType, inventory;
  const slotId = queueType === 'offensive' ? 'slot-off-0' : 'slot-def-0';
  const slotEl = document.getElementById(slotId);
  
  if (queueType === 'offensive') { inventory = state.offensiveInventory; }
  else { inventory = state.defensiveInventory; }

  powerType = inventory[0];
  if (!powerType) return;

  slotEl.classList.add('activated');
  setTimeout(()=> slotEl.classList.remove('activated'), 200);

  // The 'apply' function now receives the necessary modules/data it might need
  const applyArgs = [utils, game, mx, my];

  if (state.stacked && powerType !== 'stack') {
    powers[powerType].apply(...applyArgs); 
    state.stacked = false;
    state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== 'Stacked');
  }

  utils.spawnParticles(state.player.x, state.player.y, "#fff", 20, 3, 25);
  powers[powerType].apply(...applyArgs);
  inventory.shift(); inventory.push(null);
}
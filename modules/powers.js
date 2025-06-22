// modules/powers.js
import { state } from './state.js';
import { AudioManager } from './audio.js';
import * as utils from './utils.js';

function play(soundId) {
    const soundElement = document.getElementById(soundId + "Sound");
    if (soundElement) AudioManager.playSfx(soundElement);
}

export const powers={
  shield:{
    emoji:"🛡️",
    desc:"Blocks damage for a duration.",
    apply:(utils, game)=>{
      let duration = 6000;
      const talentRank = state.player.purchasedTalents.get('aegis-shield');
      if (talentRank) {
          duration += talentRank * 1500;
      }

      const shieldEndTime = Date.now() + duration;
      state.player.shield = true;
      state.player.shield_end_time = shieldEndTime;
      game.addStatusEffect('Shield', '🛡️', duration); 
      utils.spawnParticles(state.particles, state.player.x,state.player.y,"#f1c40f",30,4,30); 
      
      setTimeout(()=> {
          if(state.player.shield_end_time <= shieldEndTime){
              state.player.shield=false;
              if(state.player.purchasedTalents.has('aegis-retaliation')){
                  state.effects.push({ type: 'repulsion_field', x: state.player.x, y: state.player.y, radius: 250, endTime: Date.now() + 100 });
                  play('shockwave');
              }
          }
      }, duration); 
    }
  },
  heal:{emoji:"❤️",desc:"+30 HP",apply:()=>{ state.player.health=Math.min(state.player.maxHealth,state.player.health+30); }},
  shockwave:{emoji:"💥",desc:"Expanding wave damages enemies.",apply:(utils, game)=>{ 
      let talentRank = state.player.purchasedTalents.get('havoc-shockwave');
      let speed = 800;
      let radius = Math.max(innerWidth, innerHeight);
      if(talentRank) {
        const multiplier = 1 + [0.15, 0.30][talentRank - 1];
        speed *= multiplier;
        radius *= multiplier;
      }
      let damage = ((state.player.berserkUntil > Date.now()) ? 30 : 15) * state.player.talent_modifiers.damage_multiplier;
      state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: radius, speed: speed, startTime: Date.now(), hitEnemies: new Set(), damage: damage }); 
      play('shockwave'); 
  }},
  missile:{
    emoji:"🎯",
    desc:"AoE explosion damages nearby.",
    apply:(utils, game)=>{ 
      play('shockwave'); 
      let damage = ((state.player.berserkUntil > Date.now()) ? 20 : 10) * state.player.talent_modifiers.damage_multiplier;
      let radius = 250;

      const radiusTalentRank = state.player.purchasedTalents.get('havoc-missile');
      if(radiusTalentRank) radius *= (1 + (radiusTalentRank * 0.15));
      
      state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: radius, speed: 1200, startTime: Date.now(), hitEnemies: new Set(), damage: damage, color: 'rgba(255, 153, 68, 0.7)' });
      utils.triggerScreenShake(200, 8); 
      
      if(state.player.purchasedTalents.has('seeking-shrapnel')){
          for(let i = 0; i < 3; i++) {
              state.effects.push({ type: 'seeking_shrapnel', x: state.player.x, y: state.player.y, r: 6, speed: 4, damage: 5 * state.player.talent_modifiers.damage_multiplier, life: 3000, startTime: Date.now() });
          }
      }
    }
  },
  chain:{
    emoji:"⚡",
    desc:"Chain lightning hits multiple targets.",
    apply:(utils, game)=>{ 
      play('chain'); 
      let chainCount = 6;
      const chainTalentRank = state.player.purchasedTalents.get('havoc-chain');
      if(chainTalentRank) chainCount += chainTalentRank * 1;

      const targets = []; 
      let currentTarget = state.player; 
      for (let i = 0; i < chainCount; i++) { 
          let closest = null; 
          let minDist = Infinity; 
          state.enemies.forEach(e => { 
              if (!targets.includes(e)) { 
                  const dist = Math.hypot(e.x - currentTarget.x, e.y - currentTarget.y); 
                  if (dist < minDist) { 
                      minDist = dist; 
                      closest = e; 
                  } 
              } 
          }); 
          if (closest) { 
              targets.push(closest); 
              currentTarget = closest; 
          } else { break; } 
      } 
      let damage = ((state.player.berserkUntil > Date.now()) ? 30 : 15) * state.player.talent_modifiers.damage_multiplier;
      state.effects.push({ type: 'chain_lightning', targets: targets, links: [], startTime: Date.now(), durationPerLink: 80, damage: damage, caster: state.player, hasMastery: state.player.purchasedTalents.has('volatile-finish') }); 
    }
  },
  gravity:{emoji:"🌀",desc:"Pulls enemies for 1s",apply:(utils, game)=>{ play('gravity'); state.gravityActive=true; state.gravityEnd=Date.now()+1000; utils.spawnParticles(state.particles, innerWidth/2, innerHeight/2,"#9b59b6",100,4,40); }},
  speed:{emoji:"🚀",desc:"Speed Boost for 5s",apply:(utils, game)=>{ state.player.speed*=1.5; game.addStatusEffect('Speed Boost', '🚀', 5000); utils.spawnParticles(state.particles, state.player.x,state.player.y,"#00f5ff",40,3,30); setTimeout(()=>state.player.speed/=1.5,5000); }},
  freeze:{emoji:"🧊",desc:"Freeze enemies for 4s",apply:(utils, game)=>{ state.enemies.forEach(e=>{ if (e.frozen) return; e.frozen=true; e.wasFrozen = true; e._dx=e.dx; e._dy=e.dy; e.dx=e.dy=0; }); utils.spawnParticles(state.particles, state.player.x,state.player.y,"#0ff",60,3,30); setTimeout(()=>{ state.enemies.forEach(e=>{ if (!e.frozen) return; e.frozen=false; e.dx=e._dx; e.dy=e._dy; }); },4000); }},
  decoy:{emoji:"🔮",desc:"Decoy lasts 5s",apply:(utils, game)=>{ state.decoy={x:state.player.x,y:state.player.y,r:20,expires:Date.now()+5000, isTaunting: true }; utils.spawnParticles(state.particles, state.player.x,state.player.y,"#8e44ad",50,3,30); }},
  stack:{emoji:"🧠",desc:"Double next power-up",apply:(utils, game)=>{ state.stacked=true; game.addStatusEffect('Stacked', '🧠', 60000); utils.spawnParticles(state.particles, state.player.x,state.player.y,"#aaa",40,4,30); }},
  score: {emoji: "💎", desc: "Gain a large amount of Essence.", apply: (utils, game) => { game.addEssence(200 + state.player.level * 10); utils.spawnParticles(state.particles, state.player.x, state.player.y, "#f1c40f", 40, 4, 30); }},
  repulsion: {emoji: "🖐️", desc: "Pushes enemies away.", apply: () => { 
      const hasKineticOverload = state.player.purchasedTalents.has('aegis-repulsion');
      state.effects.push({ type: 'repulsion_field', x: state.player.x, y: state.player.y, radius: 250, endTime: Date.now() + 5000, knockback: hasKineticOverload }); 
      play('shockwave'); 
  }},
  orbitalStrike: {emoji: "☄️", desc: "Calls 3 meteors on random enemies", apply: () => { 
      const availableTargets = state.enemies.filter(e => !e.boss); 
      for (let i = 0; i < 3; i++) { 
          if (availableTargets.length > 0) { 
              const targetIndex = Math.floor(Math.random() * availableTargets.length); 
              const target = availableTargets.splice(targetIndex, 1)[0]; 
              state.effects.push({
                  type: 'orbital_target', 
                  target: target,
                  x: target.x, 
                  y: target.y, 
                  startTime: Date.now(), 
                  caster: state.player
              }); 
            } 
        } 
    }},
  black_hole: {emoji: "⚫", desc: "Pulls and damages enemies for 4s", apply: () => { let damage = ((state.player.berserkUntil > Date.now()) ? 6 : 3) * state.player.talent_modifiers.damage_multiplier; let radius = 350; state.effects.push({ type: 'black_hole', x: state.player.x, y: state.player.y, radius: 20, maxRadius: radius, damageRate: 200, lastDamage: new Map(), endTime: Date.now() + 4000, damage: damage, caster: state.player }); play('gravity'); }},
  berserk: {emoji: "💢", desc: "8s: Deal 2x damage, take 2x damage", apply:(utils, game)=>{ state.player.berserkUntil = Date.now() + 8000; game.addStatusEffect('Berserk', '💢', 8000); utils.spawnParticles(state.particles, state.player.x, state.player.y, "#e74c3c", 40, 3, 30); }},
  ricochetShot: {emoji: "🔄", desc: "Fires a shot that bounces multiple times", apply:(utils, game, mx, my) => { 
      let bounceCount = 6; 
      if(state.player.purchasedTalents.has('havoc-ricochet')) bounceCount += 2; 
      const angle = Math.atan2(my - state.player.y, mx - state.player.x); 
      const speed = 10; 
      state.effects.push({ 
          type: 'ricochet_projectile', 
          x: state.player.x, 
          y: state.player.y, 
          dx: Math.cos(angle) * speed, 
          dy: Math.sin(angle) * speed, 
          r: 8,
          damage: 10,
          bounces: bounceCount, 
          initialBounces: bounceCount,
          hitEnemies: new Set(), 
          caster: state.player 
      }); 
    }},
  bulletNova: {emoji: "💫", desc: "Unleashes a spiral of bullets", apply:()=>{ state.effects.push({ type: 'nova_controller', startTime: Date.now(), duration: 2000, lastShot: 0, angle: Math.random() * Math.PI * 2 }); }},
};

export const offensivePowers = ['shockwave', 'missile', 'chain', 'orbitalStrike', 'ricochetShot', 'bulletNova', 'black_hole'];

export function usePower(queueType, utils, game, mx, my){
  let powerType, inventory;
  const slotId = queueType === 'offensive' ? 'slot-off-0' : 'slot-def-0';
  const slotEl = document.getElementById(slotId);
  
  if (queueType === 'offensive') { inventory = state.offensiveInventory; }
  else { inventory = state.defensiveInventory; }

  powerType = inventory[0];
  if (!powerType) return;
  
  const recycleTalent = state.player.purchasedTalents.get('energetic-recycling');
  let consumed = true;

  if (recycleTalent && Math.random() < 0.20) {
      consumed = false;
      utils.spawnParticles(state.particles, state.player.x, state.player.y, "#2ecc71", 40, 5, 40);
      game.addStatusEffect('Recycled', '♻️', 2000);
  }

  if (consumed) {
      inventory.shift();
      inventory.push(null);
  }
  
  slotEl.classList.add('activated');
  setTimeout(()=> slotEl.classList.remove('activated'), 200);

  const applyArgs = [utils, game, mx, my];

  if (state.stacked && powerType !== 'stack') {
    powers[powerType].apply(...applyArgs); 
    state.stacked = false;
    state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== 'Stacked');
  }

  utils.spawnParticles(state.particles, state.player.x, state.player.y, "#fff", 20, 3, 25);
  powers[powerType].apply(...applyArgs);
}

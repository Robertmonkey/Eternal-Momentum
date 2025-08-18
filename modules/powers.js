// modules/powers.js
import { state } from './state.js';
import * as utils from './utils.js';
import * as Cores from './cores.js';

// Helper function to check for core presence (equipped or via Pantheon)
function playerHasCore(coreId) {
    if (state.player.equippedAberrationCore === coreId) return true;
    return state.player.activePantheonBuffs.some(buff => buff.coreId === coreId);
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
      utils.spawnParticles(state.particles, state.player.x,state.player.y,"#f1c40f",30,4,30,5);

      setTimeout(()=> {
          if(state.player.shield_end_time <= shieldEndTime){
              state.player.shield=false;
              if(state.player.purchasedTalents.has('aegis-retaliation')){
                  state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 250, speed: 1000, startTime: Date.now(), hitEnemies: new Set(), damage: 0, color: 'rgba(255, 255, 255, 0.5)' });
                  game.play('shockwaveSound');
              }
          }
      }, duration);
    }
  },
  heal:{emoji:"❤️",desc:"+30 HP",apply:(utils, game)=>{
      state.player.health=Math.min(state.player.maxHealth,state.player.health+30);
      game.play('pickupSound');
  }},
  shockwave:{emoji:"💥",desc:"Expanding wave damages enemies.",apply:(utils, game, mx, my, options = {})=>{
      const { damageModifier = 1.0, origin = state.player } = options;
      let speed = 800;
      let radius = Math.max(innerWidth, innerHeight);
      let damage = (((state.player.berserkUntil > Date.now()) ? 30 : 15) * state.player.talent_modifiers.damage_multiplier) * damageModifier;
      state.effects.push({ type: 'shockwave', caster: origin, x: origin.x, y: origin.y, radius: 0, maxRadius: radius, speed: speed, startTime: Date.now(), hitEnemies: new Set(), damage: damage });
      game.play('shockwaveSound');
  }},
  missile:{
    emoji:"🎯",
    desc:"AoE explosion damages nearby.",
    apply:(utils, game, mx, my, options = {})=>{
      const { damageModifier = 1.0, origin = state.player } = options;
      game.play('shockwaveSound');
      let damage = (((state.player.berserkUntil > Date.now()) ? 20 : 10) * state.player.talent_modifiers.damage_multiplier) * damageModifier;
      let radius = 250;
      const radiusTalentRank = state.player.purchasedTalents.get('stellar-detonation');
      if(radiusTalentRank) radius *= (1 + (radiusTalentRank * 0.15));

      state.effects.push({
          type: 'shockwave',
          caster: origin,
          x: origin.x,
          y: origin.y,
          radius: 0,
          maxRadius: radius,
          speed: 1200,
          startTime: Date.now(),
          hitEnemies: new Set(),
          damage: damage,
          color: 'rgba(255, 153, 68, 0.7)'
      });
      utils.triggerScreenShake(200, 8);

      if(state.player.purchasedTalents.has('homing-shrapnel')){
          const initialAngle = Math.atan2(my - origin.y, mx - origin.x);
          for(let i = 0; i < 3; i++) {
              const angleOffset = (i - 1) * 0.5;
              const finalAngle = initialAngle + angleOffset;
              state.effects.push({
                  type: 'seeking_shrapnel',
                  x: origin.x,
                  y: origin.y,
                  dx: Math.cos(finalAngle) * 4,
                  dy: Math.sin(finalAngle) * 4,
                  r: 6,
                  speed: 4,
                  damage: 5 * state.player.talent_modifiers.damage_multiplier,
                  life: 3000,
                  startTime: Date.now(),
                  targetIndex: i
                });
          }
      }
    }
  },
  chain:{
    emoji:"⚡",
    desc:"Chain lightning hits multiple targets.",
    apply:(utils, game, mx, my, options = {})=>{
      const { damageModifier = 1.0, origin = state.player } = options;
      game.play('chainSound');
      let chainCount = 6;
      const chainTalentRank = state.player.purchasedTalents.get('arc-cascade');
      if(chainTalentRank) chainCount += chainTalentRank * 1;

      const targets = [];
      let currentTarget = origin;
      for (let i = 0; i < chainCount; i++) {
          let closest = null;
          let minDist = Infinity;
          state.enemies.forEach(e => {
              if (!e.isFriendly && !targets.includes(e)) {
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
      let damage = (((state.player.berserkUntil > Date.now()) ? 30 : 15) * state.player.talent_modifiers.damage_multiplier) * damageModifier;
      state.effects.push({ type: 'chain_lightning', targets: targets, links: [], startTime: Date.now(), durationPerLink: 80, damage: damage, caster: origin });
    }
  },
  gravity:{
    emoji:"🌀",
    desc:"Pulls enemies for 1s",
    apply:(utils, game)=>{
        game.play('gravitySound');
        state.gravityActive=true;
        state.gravityEnd=Date.now()+1000;
        const { x, y } = state.player;
        utils.spawnParticles(state.particles, x, y,"#9b59b6",100,4,40,5);

        if (state.player.purchasedTalents.has('temporal-collapse')) {
            setTimeout(() => {
                if(state.gameOver) return;
                state.effects.push({
                    type: 'slow_zone',
                    x,
                    y,
                    r: 250,
                    endTime: Date.now() + 4000
                });
            }, 1000);
        }
    }
  },
  speed:{emoji:"🚀",desc:"Speed Boost for 5s",apply:(utils, game)=>{ state.player.speed*=1.5; game.addStatusEffect('Speed Boost', '🚀', 5000); utils.spawnParticles(state.particles, state.player.x,state.player.y,"#00f5ff",40,3,30,5); setTimeout(()=>state.player.speed/=1.5,5000); }},
  freeze:{emoji:"🧊",desc:"Freeze enemies for 4s",apply:(utils, game)=>{
      state.enemies.forEach(e=>{
          if (e.id === 'fractal_horror' || e.isFriendly) return;
          if (e.frozen) return;
          e.frozen=true;
          e.wasFrozen = true;
          e._dx=e.dx;
          e._dy=e.dy;
          e.dx=e.dy=0;
          e.frozenUntil = Date.now() + 4000;
          
          if (playerHasCore('basilisk')) {
            e.petrifiedUntil = Date.now() + 3000;
          }
      });
      utils.spawnParticles(state.particles, state.player.x,state.player.y,"#0ff",60,3,30,5);
      setTimeout(()=>{
          state.enemies.forEach(e=>{
              if (!e.frozen) return;
              e.frozen=false;
              if (e.hp > 0) {
                e.dx=e._dx;
                e.dy=e._dy;
              }
          });
      },4000);
  }},
  decoy:{emoji:"🔮",desc:"Decoy lasts 5s",apply:(utils, game)=>{
    const isMobile = state.player.purchasedTalents.has('quantum-duplicate');
    
    // This creates a decoy specifically from the power-up
    const rand = (min, max) => Math.random() * (max - min) + min;
    state.decoys.push({
        x: state.player.x + rand(-100, 100),
        y: state.player.y + rand(-100, 100),
        r: 20,
        expires: Date.now() + 5000,
        isTaunting: true,
        isMobile: isMobile, // Only power-up decoys can be mobile via talent
        hp: 1,
        fromCore: false // Mark as not from the core
    });
    game.play('magicDispelSound'); // Using a different sound to distinguish
    utils.spawnParticles(state.particles, state.player.x, state.player.y, "#8e44ad", 50, 3, 30, 5);
  }},
  stack:{emoji:"🧠",desc:"Double next power-up",apply:(utils, game)=>{ state.stacked=true; game.addStatusEffect('Stacked', '🧠', 60000); utils.spawnParticles(state.particles, state.player.x,state.player.y,"#aaa",40,4,30,5); }},
  score: {emoji: "💎", desc: "Gain a large amount of Essence.", apply: (utils, game) => { game.addEssence(200 + state.player.level * 10); utils.spawnParticles(state.particles, state.player.x, state.player.y, "#f1c40f", 40, 4, 30,5); }},
  repulsion: {emoji: "🖐️", desc: "Creates a 5s push-away field.", apply: (utils, game) => {
      const hasKineticOverload = state.player.purchasedTalents.has('kinetic-overload');
      state.effects.push({
          type: 'repulsion_field',
          x: state.player.x,
          y: state.player.y,
          radius: 250,
          startTime: Date.now(),
          endTime: Date.now() + 5000,
          isOverloaded: hasKineticOverload,
          hitEnemies: new Set()
      });
      game.play('shockwaveSound');
  }},
  orbitalStrike: {emoji: "☄️", desc: "Calls 3 meteors on random enemies", apply:(utils, game, mx, my, options = {}) => {
      const { damageModifier = 1.0, origin = state.player } = options;
      const availableTargets = state.enemies.filter(e => !e.isFriendly);
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
                  caster: origin,
                  damageModifier: damageModifier
              });
            }
        }
    }},
  black_hole: {emoji: "⚫", desc: "Pulls and damages enemies for 4s", apply:(utils, game, mx, my, options = {}) => {
      const { damageModifier = 1.0, origin = state.player } = options;
      let damage = (((state.player.berserkUntil > Date.now()) ? 6 : 3) * state.player.talent_modifiers.damage_multiplier) * damageModifier;
      let radius = 350;
      const blackHoleEffect = {
          type: 'black_hole',
          x: mx, y: my,
          radius: 20, maxRadius: radius,
          damageRate: 200, lastDamage: new Map(),
          startTime: Date.now(),
          duration: 4000,
          endTime: Date.now() + 4000,
          damage: damage,
          caster: origin
      };
      state.effects.push(blackHoleEffect);
      game.play('gravitySound');

      if (playerHasCore('time_eater')) {
          setTimeout(() => {
              if (state.gameOver) return;
              // Ensure effect hasn't been cleared
              if (state.effects.includes(blackHoleEffect)) {
                  state.effects.push({ type: 'dilation_field', x: mx, y: my, r: radius, endTime: Date.now() + 5000 });
              }
          }, 4000);
      }
  }},
  berserk: {emoji: "💢", desc: "8s: Deal 2x damage, take 2x damage", apply:(utils, game)=>{ state.player.berserkUntil = Date.now() + 8000; game.addStatusEffect('Berserk', '💢', 8000); utils.spawnParticles(state.particles, state.player.x, state.player.y, "#e74c3c", 40, 3, 30,5); }},
  ricochetShot: {emoji: "🔄", desc: "Fires a shot that bounces 6 times", apply:(utils, game, mx, my, options = {}) => {
      const { damageModifier = 1.0, origin = state.player } = options;
      let bounceCount = 6;
      const angle = Math.atan2(my - origin.y, mx - origin.x);
      const speed = 10;
      const damage = 10 * damageModifier;
      state.effects.push({
          type: 'ricochet_projectile',
          x: origin.x,
          y: origin.y,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          r: 8,
          damage: damage,
          bounces: bounceCount,
          initialBounces: bounceCount,
          hitEnemies: new Set(),
          caster: origin
      });
    }},
  bulletNova: {emoji: "💫", desc: "Unleashes a spiral of bullets", apply:(utils, game, mx, my, options = {})=>{
      const { damageModifier = 1.0, origin = state.player } = options; 
      state.effects.push({ type: 'nova_controller', startTime: Date.now(), duration: 2000, lastShot: 0, angle: Math.random() * Math.PI * 2, caster: origin, damageModifier: damageModifier }); 
    }},
};

export const offensivePowers = ['shockwave', 'missile', 'chain', 'orbitalStrike', 'ricochetShot', 'bulletNova', 'black_hole'];

export function usePower(powerKey, isFreeCast = false, options = {}){
  const power = powers[powerKey];
  if (!power) return;
  
  const { play, addStatusEffect } = window.gameHelpers;
  const queueType = offensivePowers.includes(powerKey) ? 'offensive' : 'defensive';
  const slotId = queueType === 'offensive' ? 'slot-off-0' : 'slot-def-0';
  const slotEl = document.getElementById(slotId);
  let consumed = !isFreeCast;

  if (consumed) {
      let recycled = false;
      if (state.player.purchasedTalents.has('energetic-recycling') && Math.random() < 0.20) {
          recycled = true;
      }
      if (playerHasCore('singularity') && Math.random() < 0.15) {
          recycled = true;
      }
      if (recycled) {
          addStatusEffect('Recycled', '♻️', 2000);
          utils.spawnParticles(state.particles, state.player.x, state.player.y, "#2ecc71", 40, 5, 40,5);
          consumed = false;
      }
  }

  if (consumed) {
      const inventory = queueType === 'offensive' ? state.offensiveInventory : state.defensiveInventory;
      inventory.shift();
      inventory.push(null);
  }

  slotEl.classList.add('activated');
  setTimeout(()=> slotEl.classList.remove('activated'), 200);

  // Use mouse position from window scope
  const mx = window.mousePosition.x;
  const my = window.mousePosition.y;
  
  const applyArgs = [utils, window.gameHelpers, mx, my, options];
  
  if (power.type === 'offensive' && playerHasCore('temporal_paradox')) {
      const echoEffect = { 
          type: 'paradox_player_echo', 
          x: state.player.x, y: state.player.y, 
          powerKey: powerKey, 
          mx: mx, my: my,
          startTime: Date.now()
      };
      state.effects.push(echoEffect);
      play('phaseShiftSound');
  }

  if (power.type === 'defensive') {
      Cores.handleCoreOnDefensivePower(powerKey, mx, my, window.gameHelpers);
  }

  let stackedEffect = state.stacked;
  if (!isFreeCast && !stackedEffect && state.player.purchasedTalents.has('preordinance') && !state.player.preordinanceUsed) {
      stackedEffect = true;
      state.player.preordinanceUsed = true;
      addStatusEffect('Preordained', '🎲', 2000);
  }

  // Apply the main power effect
  power.apply(...applyArgs);
  
  if (stackedEffect && power.name !== 'Stack') {
      power.apply(...applyArgs);
      if(state.stacked) {
          state.stacked = false;
          state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== 'Stacked');
      }
  }
  
  if (!isFreeCast && power.type !== 'stack' && playerHasCore('singularity') && Math.random() < 0.05) {
      setTimeout(() => {
           if (state.gameOver) return;
           power.apply(...applyArgs);
           addStatusEffect('Duplicated', '✨', 2000);
           play('shaperAttune');
           utils.spawnParticles(state.particles, state.player.x, state.player.y, '#9b59b6', 40, 3, 30,5);
      }, 150);
  }
}

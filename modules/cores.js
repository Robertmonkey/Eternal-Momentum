// modules/cores.js
//
// This module implements all aberration core logic for Eternal Momentum.
// Each core can provide one active ability, one or more passive effects, or
// both.  Active abilities are triggered via a simultaneous left and right
// mouse click and are routed through the `activateCorePower` function.  All
// per–tick passive behaviours are executed by `applyCoreTickEffects` once
// per frame.  Other hooks allow cores to react to events like enemy deaths,
// damage taken, collisions, pickup collection, and fatal hits.  The design
// deliberately avoids leaking global references and ensures that every
// variable used in timeouts or callbacks is scoped safely.

import { state } from './state.js';
import * as utils from './utils.js';
import { bossData } from './bosses.js';
import { showUnlockNotification, updateUI } from './ui.js';
import { usePower } from './powers.js';

/**
 * Returns true if the player currently has the specified core equipped or
 * temporarily granted through the Pantheon core.  This helper centralises
 * the logic for checking both the equipped core and temporary buffs.
 */
export function playerHasCore(coreId) {
  if (state.player.equippedAberrationCore === coreId) return true;
  return state.player.activePantheonBuffs.some(buff => buff.coreId === coreId);
}

/**
 * Activate the currently equipped core's active ability.  This function
 * should be called when the player presses both mouse buttons.  It
 * consults the core's cooldown and, if ready, triggers the appropriate
 * effect and audio feedback.  When an ability is successfully triggered
 * the UI is updated to show the cooldown indicator.
 */
export function activateCorePower(mx, my, gameHelpers) {
  const now = Date.now();
  const coreId = state.player.equippedAberrationCore;
  if (!coreId) return;
  const coreState = state.player.talent_states.core_states[coreId];
  if (coreState && now < (coreState.cooldownUntil || 0)) {
    gameHelpers.play('talentError');
    return;
  }
  let abilityTriggered = false;
  switch (coreId) {
    // Juggernaut: after a 1 second charge the player dashes at high speed.
    case 'juggernaut': {
      coreState.cooldownUntil = now + 8000; // 8 second cooldown
      // Stun the player and make them immune during the charge‐up.  We use
      // separate status effects so other systems can distinguish between
      // immobilisation and invulnerability if necessary.
      gameHelpers.addStatusEffect('Stunned', '🛑', 1000);
      gameHelpers.addStatusEffect('Charging', '🔋', 2700);
      // Show a visual indicator for the charge wind‑up.
      state.effects.push({
        type: 'player_charge_indicator',
        source: state.player,
        startTime: now,
        duration: 1000,
        radius: 80,
        color: 'rgba(255, 255, 255, 0.8)',
      });
      gameHelpers.play('chargeUpSound');
      // After the wind‑up completes, emit the dash effect.  Use a closure
      // here to capture the cursor coordinates at the moment of activation.
      setTimeout(() => {
        if (state.gameOver) return;
        const { x: cursorX, y: cursorY } = window.mousePosition;
        const angle = Math.atan2(cursorY - state.player.y, cursorX - state.player.x);
        state.effects.push({
          type: 'juggernaut_player_charge',
          startTime: Date.now(),
          duration: 1700,
          angle,
          hitEnemies: new Set(),
          bouncesLeft: 2,
        });
        gameHelpers.play('chargeDashSound');
      }, 1000);
      abilityTriggered = true;
      break;
    }
    // Architect: spawn a ring of sixteen pillars that block enemies for 10s.
    case 'architect': {
      coreState.cooldownUntil = now + 15000; // 15 second cooldown
      gameHelpers.play('architectBuild');
      const ringRadius = 200;
      const pillarCount = 16;
      for (let i = 0; i < pillarCount; i++) {
        const pAngle = (i / pillarCount) * 2 * Math.PI;
        state.effects.push({
          type: 'architect_pillar',
          x: state.player.x + ringRadius * Math.cos(pAngle),
          y: state.player.y + ringRadius * Math.sin(pAngle),
          r: 20,
          endTime: now + 10000,
        });
      }
      abilityTriggered = true;
      break;
    }
    // Annihilator: channel for 4 seconds then fire a screen‑wide beam.
    case 'annihilator': {
      coreState.cooldownUntil = now + 25000; // 25 second cooldown
      state.effects.push({ type: 'player_annihilation_beam', startTime: now, endTime: now + 4000 });
      gameHelpers.play('powerSirenSound');
      abilityTriggered = true;
      break;
    }
    // Looper: immobilise the player for 1 second while aiming then teleport.
    case 'looper': {
      coreState.cooldownUntil = now + 10000; // 10 second cooldown
      // Grant immunity and immobilise the player.
      gameHelpers.addStatusEffect('Warping', '🌀', 1000);
      gameHelpers.addStatusEffect('Stunned', '🌀', 1000);
      // Spawn a locus that follows the cursor; when it expires the
      // teleportation will occur within gameLoop.js effect handling.
      state.effects.push({
        type: 'teleport_locus',
        startTime: now,
        duration: 1000,
        endTime: now + 1000,
      });
      gameHelpers.play('chargeUpSound');
      abilityTriggered = true;
      break;
    }
    default:
      // Cores without active abilities fall through.  Syphon and gravity
      // trigger passively and do not respond to LMB+RMB.
      break;
  }
  if (abilityTriggered) {
    updateUI();
  }
}

/**
 * Execute all passive behaviours each frame.  This includes healing,
 * spawning projectiles, converting enemies, pulsing taunts, gravity
 * pulses and other timed effects.  It also drives the Pantheon core's
 * rotation through the player's unlocked aberration cores.
 */
export function applyCoreTickEffects(gameHelpers) {
  const now = Date.now();
  const { play } = gameHelpers;
  const ctx = document.getElementById('gameCanvas').getContext('2d');
  // --- Pantheon rotation ---
  if (state.player.equippedAberrationCore === 'pantheon') {
    const pantheonState = state.player.talent_states.core_states.pantheon;
    if (now > (pantheonState.lastCycleTime || 0) + 10000) {
      pantheonState.lastCycleTime = now;
      const unlockedCores = Array.from(state.player.unlockedAberrationCores);
      const activeBuffIds = state.player.activePantheonBuffs.map(b => b.coreId);
      const availablePool = unlockedCores.filter(id => id !== 'pantheon' && !activeBuffIds.includes(id));
      if (availablePool.length > 0) {
        const newCoreId = availablePool[Math.floor(Math.random() * availablePool.length)];
        const coreData = bossData.find(b => b.id === newCoreId);
        state.player.activePantheonBuffs.push({ coreId: newCoreId, endTime: now + 30000 });
        showUnlockNotification(`Pantheon Attuned: ${coreData.name}`, 'Aspect Gained');
        play('shaperAttune');
      }
    }
  }
  // Filter expired buffs.
  state.player.activePantheonBuffs = state.player.activePantheonBuffs.filter(buff => now < buff.endTime);

  // --- Vampire passive ---
  if (playerHasCore('vampire')) {
    // Only heal if the player has avoided damage for at least 5 seconds.
    if (now - state.player.talent_states.phaseMomentum.lastDamageTime > 5000) {
      if (state.player.health < state.player.maxHealth) {
        const healPerSec = 0.02 * state.player.maxHealth; // 2% of max HP per second
        const healPerTick = healPerSec / 60;
        state.player.health = Math.min(state.player.maxHealth, state.player.health + healPerTick);
      }
    }
  }

  // --- Swarm passive ---
  if (playerHasCore('swarm')) {
    const swarmState = state.player.talent_states.core_states.swarm;
    let prev = state.player;
    swarmState.tail.forEach(c => {
      c.x += (prev.x - c.x) * 0.2;
      c.y += (prev.y - c.y) * 0.2;
      const segmentRadius = 8;
      utils.drawCircle(ctx, c.x, c.y, segmentRadius, '#c0392b');
      if (Math.random() < 0.2) {
          utils.spawnParticles(state.particles, c.x, c.y, 'rgba(192, 57, 43, 0.5)', 1, 0.5, 10, 2);
      }
      prev = c;
      state.enemies.forEach(e => {
        if (!e.isFriendly && Math.hypot(e.x - c.x, e.y - c.y) < e.r + segmentRadius) {
          e.hp -= 0.2 * state.player.talent_modifiers.damage_multiplier;
        }
      });
    });
  }

  // --- Miasma passive ---
  if (playerHasCore('miasma')) {
      const miasmaState = state.player.talent_states.core_states.miasma;
      const moveDist = Math.hypot(window.mousePosition.x - state.player.x, window.mousePosition.y - state.player.y);
      const isStationary = moveDist < state.player.r;
      
      if (isStationary) {
          if (!miasmaState.stillStartTime) {
              miasmaState.stillStartTime = now;
          }
          const timeStill = now - miasmaState.stillStartTime;
          
          if (timeStill > 3000 && !state.effects.some(e => e.fromCore && e.type === 'miasma_gas')) {
              state.effects.push({
                  type: 'miasma_gas',
                  fromCore: true,
                  startTime: now,
                  endTime: Infinity 
              });
          }
      } else {
          miasmaState.stillStartTime = null;
          state.effects = state.effects.filter(e => !(e.fromCore && e.type === 'miasma_gas'));
      }
  }

  // --- Puppeteer passive ---
  if (playerHasCore('puppeteer')) {
    const puppeteerState = state.player.talent_states.core_states.puppeteer;
    if (now > (puppeteerState.lastConversion || 0) + 4000) {
      puppeteerState.lastConversion = now;
      let farthestEnemy = null;
      let maxDist = 0;
      state.enemies.forEach(e => {
        if (!e.boss && !e.isFriendly) {
          const d = Math.hypot(state.player.x - e.x, state.player.y - e.y);
          if (d > maxDist) {
            maxDist = d;
            farthestEnemy = e;
          }
        }
      });
      if (farthestEnemy) {
        play('puppeteerConvert');
        farthestEnemy.isFriendly = true;
        farthestEnemy.isPuppet = true;
        farthestEnemy.id = 'puppet';
        farthestEnemy.customColor = '#a29bfe';
        // Give puppets modest health so they can survive a few hits.
        farthestEnemy.hp = 104;
        farthestEnemy.maxHP = 104;
        farthestEnemy.dx *= 1.5;
        farthestEnemy.dy *= 1.5;
        state.effects.push({ type: 'transient_lightning', x1: state.player.x, y1: state.player.y, x2: farthestEnemy.x, y2: farthestEnemy.y, color: '#a29bfe', endTime: now + 200 });
      }
    }
  }

  // --- Helix Weaver passive ---
  if (playerHasCore('helix_weaver')) {
    const helixState = state.player.talent_states.core_states.helix_weaver;
    // Only spawn bolts when the player is stationary; movement cancels the effect.
    const moveDist = Math.hypot(window.mousePosition.x - state.player.x, window.mousePosition.y - state.player.y);
    if (moveDist < state.player.r) {
      if (now > (helixState.lastBolt || 0) + 1000) {
        helixState.lastBolt = now;
        state.effects.push({ type: 'helix_bolt', x: state.player.x, y: state.player.y, r: 8, speed: 2, angle: Math.random() * 2 * Math.PI, lifeEnd: now + 10000, caster: state.player });
        play('weaverCast');
      }
    }
  }

  // --- Gravity passive ---
  if (playerHasCore('gravity')) {
    const gravityState = state.player.talent_states.core_states.gravity;
    if (now > (gravityState.lastPulseTime || 0) + 5000) {
      gravityState.lastPulseTime = now;
      // Spawn an expanding ring that repels enemies and pulls pickups.  The
      // rendering logic in gameLoop.js handles motion and drawing.
      state.effects.push({ type: 'player_pull_pulse', x: state.player.x, y: state.player.y, maxRadius: 600, startTime: now, duration: 500 });
      play('gravitySound');
    }
  }

  // --- Fractal Horror passive ---
  if (playerHasCore('fractal_horror')) {
    const fractalState = state.player.talent_states.core_states.fractal_horror;
    if (!fractalState.applied) {
      fractalState.applied = true;
      fractalState.originalR = state.player.r;
      fractalState.originalSpeed = state.player.speed;
      state.player.r = fractalState.originalR * 0.5;
      state.player.speed = fractalState.originalSpeed * 1.5;
    }
  } else {
    const fractalState = state.player.talent_states.core_states.fractal_horror;
    if (fractalState && fractalState.applied) {
      // Revert player stats when unequipped.
      state.player.r = fractalState.originalR;
      state.player.speed = fractalState.originalSpeed;
      fractalState.applied = false;
    }
  }

  // --- Epoch Ender passive ---
  if (playerHasCore('epoch_ender')) {
    const epochState = state.player.talent_states.core_states.epoch_ender;
    // Record a snapshot every ~200ms.  We track lastSnapshotTime so that
    // multiple frames in quick succession do not push too many entries.
    if (!epochState.lastSnapshotTime || now > epochState.lastSnapshotTime + 200) {
      epochState.lastSnapshotTime = now;
      epochState.history.unshift({ x: state.player.x, y: state.player.y, health: state.player.health });
      if (epochState.history.length > 30) epochState.history.pop();
    }
  }
}

/**
 * Handle logic that should occur when an enemy dies.  Only non‑friendly
 * deaths are processed here.  Splitter spawns fragments, Swarm adds tail
 * segments, Fractal Horror splits into minions and Parasite spawns spores
 * from infected enemies.  Additional core behaviours can be added here.
 */
export function handleCoreOnEnemyDeath(enemy, gameHelpers) {
  const now = Date.now();
  const { spawnEnemy } = gameHelpers;
  if (enemy.isFriendly) return;
  // Splitter: on enemy death spawn three friendly crystals.
  if (playerHasCore('splitter')) {
    const splitterState = state.player.talent_states.core_states.splitter;
    if (!enemy.boss && now > (splitterState.cooldownUntil || 0)) {
      splitterState.cooldownUntil = now + 500;
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        state.effects.push({ type: 'player_fragment', x: enemy.x, y: enemy.y, dx: Math.cos(angle) * 4, dy: Math.sin(angle) * 4, r: 10, speed: 5, damage: 8 * state.player.talent_modifiers.damage_multiplier, life: 4000, startTime: now, targetIndex: i });
      }
      gameHelpers.play('splitterOnDeath');
    }
  }
  // Swarm: count kills towards new tail segments.
  if (playerHasCore('swarm')) {
    const swarmState = state.player.talent_states.core_states.swarm;
    swarmState.enemiesForNextSegment = (swarmState.enemiesForNextSegment || 0) + 1;
    if (swarmState.enemiesForNextSegment >= 2 && swarmState.tail.length < 50) {
      swarmState.enemiesForNextSegment = 0;
      const lastSegment = swarmState.tail.length > 0 ? swarmState.tail[swarmState.tail.length - 1] : state.player;
      swarmState.tail.push({ x: lastSegment.x, y: lastSegment.y });
    }
  }
  // Fractal Horror: every ten kills split into three friendly bits.
  if (playerHasCore('fractal_horror')) {
    const fractalState = state.player.talent_states.core_states.fractal_horror;
    fractalState.killCount = (fractalState.killCount || 0) + 1;
    if (fractalState.killCount >= 10) {
      fractalState.killCount = 0;
      gameHelpers.play('fractalSplit');
      for (let k = 0; k < 3; k++) {
        const bit = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
        if (bit) {
          bit.isFriendly = true;
          bit.customColor = '#be2edd';
          bit.r = 8;
          bit.hp = 5;
          bit.lifeEnd = now + 8000;
        }
      }
    }
  }
  // Parasite: infected enemies spawn friendly spores on death.
  if (playerHasCore('parasite')) {
    if (enemy.isInfected) {
      const spore = spawnEnemy(false, null, { x: enemy.x, y: enemy.y });
      if (spore) {
        spore.isFriendly = true;
        spore.customColor = '#55efc4';
        spore.r = 8;
        spore.hp = 5;
        spore.lifeEnd = now + 8000;
      }
    }
  }
}

/**
 * Called when the player takes damage.  Returns the adjusted damage after
 * any damage mitigation has been applied.  This handler is responsible
 * for core‑triggered reactions to incoming damage such as spawning decoys
 * for Mirror Mirage.  Obelisk shield absorption is processed before
 * returning.  Glitch no longer triggers here; it instead reacts to
 * collisions in handleCoreOnCollision.
 */
export function handleCoreOnPlayerDamage(damage, enemy, gameHelpers) {
  const now = Date.now();
  let damageTaken = damage;
  // Obelisk: absorbs damage charges.
  if (playerHasCore('obelisk')) {
    const conduitCharge = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
    if (conduitCharge && conduitCharge.count > 0) {
      damageTaken = 0;
      conduitCharge.count--;
      if (conduitCharge.count <= 0) {
        state.player.statusEffects = state.player.statusEffects.filter(e => e.name !== 'Conduit Charge');
      }
      gameHelpers.play('conduitShatter');
      state.effects.push({ type: 'shockwave', caster: state.player, x: state.player.x, y: state.player.y, radius: 0, maxRadius: 200, speed: 1000, startTime: now, hitEnemies: new Set(), damage: 0, color: 'rgba(44, 62, 80, 0.7)' });
    }
  }
  if (damageTaken > 0) {
    // Mirror Mirage: spawn a decoy.  Limit to three decoys by removing the
    // oldest on overflow.  Decoys created by the core pulse every 4–7
    // seconds to taunt nearby enemies.  See gameLoop.js for rendering.
    if (playerHasCore('mirror_mirage')) {
      const coreDecoys = state.decoys.filter(d => d.fromCore);
      if (coreDecoys.length >= 3) {
        const oldestIndex = state.decoys.findIndex(d => d.fromCore);
        if (oldestIndex !== -1) {
          state.decoys.splice(oldestIndex, 1);
        }
      }
      const decoy = {
        x: state.player.x,
        y: state.player.y,
        r: 20,
        hp: 1,
        fromCore: true,
        isMobile: false,
        isTaunting: false,
        lastTauntTime: now,
        nextTauntTime: now + 4000 + Math.random() * 3000,
        tauntDuration: 2000,
        tauntEndTime: now,
      };
      state.decoys.push(decoy);
      gameHelpers.play('mirrorSwap');
      utils.spawnParticles(state.particles, state.player.x, state.player.y, '#ff00ff', 40, 4, 30, 5);
    }
  }
  return damageTaken;
}

/**
 * Called whenever the player collides with an enemy.  Handles Parasite
 * infection and Glitch insta‑delete logic.  Parasite infects any
 * non‑boss enemy on contact, marking them for spore spawning upon death.
 * Glitch has a 25% chance to instantly delete a non‑boss enemy and
 * spawn a random pickup elsewhere.  A flashy particle burst and sound
 * accompany the deletion.
 */
export function handleCoreOnCollision(enemy, gameHelpers) {
  const now = Date.now();
  if (enemy.isFriendly) return;
  // Parasite: infect any enemy touched by the player.
  if (playerHasCore('parasite')) {
    if (!enemy.boss && !enemy.isInfected) {
      enemy.isInfected = true;
      enemy.infectionEnd = now + 10000;
    }
  }
  // Glitch: 25% chance to delete an enemy on contact and spawn a pickup.
  if (playerHasCore('glitch')) {
    if (!enemy.boss && Math.random() < 0.25) {
      // Kill the enemy immediately.
      enemy.hp = 0;
      // Spawn a random pickup using the built‑in helper.  Note that this
      // spawns the pickup at a random location; if proximity to the player
      // is desired a custom pickup could be pushed to state.pickups.
      gameHelpers.spawnPickup();
      // Flashy glitch particles.
      utils.spawnParticles(state.particles, enemy.x, enemy.y, '#fd79a8', 30, 3, 30, 5);
      gameHelpers.play('glitchSound');
    }
  }
}

/**
 * Called whenever the player deals damage to a target.  Handles the
 * Vampire healing orb and Parasite infection.  The Vampire orb now
 * heals 20% of max HP instead of 2%.
 */
export function handleCoreOnDamageDealt(target) {
  // Vampire: 10% chance to spawn a blood orb that heals for 20% of max HP.
  if (playerHasCore('vampire') && Math.random() < 0.10) {
    state.pickups.push({
      x: target.x,
      y: target.y,
      r: 10,
      type: 'custom',
      emoji: '🩸',
      lifeEnd: Date.now() + 8000,
      vx: 0,
      vy: 0,
      isSeeking: true,
      customApply: () => {
        state.player.health = Math.min(state.player.maxHealth, state.player.health + (state.player.maxHealth * 0.20));
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#800020', 20, 3, 30, 5);
        window.gameHelpers.play('vampireHeal');
      },
    });
  }
  // Parasite: infect targets on any damage if they are not bosses.
  if (playerHasCore('parasite') && !target.boss) {
    target.isInfected = true;
    target.infectionEnd = Date.now() + 10000;
  }
}

/**
 * Triggered when the player's shield breaks.  Only used by the Obelisk
 * core to clear certain projectile effects.  Left unmodified from the
 * original implementation as its behaviour is unchanged by the redesign.
 */
export function handleCoreOnShieldBreak() {
  if (playerHasCore('emp')) {
    state.effects = state.effects.filter(ef => ef.type !== 'nova_bullet' && ef.type !== 'helix_bolt');
    utils.spawnParticles(state.particles, state.player.x, state.player.y, '#3498db', 50, 4, 30, 5);
    window.gameHelpers.play('empDischarge');
  }
}

/**
 * Handle fatal damage to the player.  If the Epoch Ender core is equipped
 * and off cooldown then the player's position and health are rewound to
 * the earliest stored snapshot.  A 120 second cooldown is applied to
 * prevent repeated rewinds.  Returns true if the fatal damage was
 * cancelled and the player was rewound.
 */
export function handleCoreOnFatalDamage(enemy, gameHelpers) {
  const now = Date.now();
  if (playerHasCore('epoch_ender')) {
    const epochState = state.player.talent_states.core_states.epoch_ender;
    if (now > (epochState.cooldownUntil || 0)) {
      const history = epochState.history;
      // Use the most recent snapshot.  This is index 0 because we
      // unshift snapshots in applyCoreTickEffects.
      const rewindState = history[0];
      if (rewindState) {
        state.player.x = rewindState.x;
        state.player.y = rewindState.y;
        state.player.health = rewindState.health;
        epochState.cooldownUntil = now + 120000; // 120 second cooldown
        gameHelpers.play('timeRewind');
        utils.spawnParticles(state.particles, state.player.x, state.player.y, '#bdc3c7', 80, 6, 40, 5);
        return true;
      }
    }
  }
  return false;
}

/**
 * Called when a pickup is collected.  Used by Obelisk to add Conduit
 * charges.  Left largely unchanged from the original implementation.
 */
export function handleCoreOnPickup(gameHelpers) {
  const { addStatusEffect } = gameHelpers;
  if (playerHasCore('obelisk')) {
    const existing = state.player.statusEffects.find(e => e.name === 'Conduit Charge');
    if (!existing || existing.count < 3) {
      addStatusEffect('Conduit Charge', '⚡', 999999);
    }
  }
}

/**
 * Handle the use of an empty offensive or defensive slot.  Syphon is
 * triggered passively when the player attempts to use an empty slot.  If
 * triggered it fires a cone that pulls nearby pickups towards the player.
 * Returns true if a core consumed the slot, otherwise false.
 */
export function handleCoreOnEmptySlot(mx, my, gameHelpers) {
  const now = Date.now();
  // Syphon: fire a cone vacuum on empty slot if off cooldown.
  if (playerHasCore('syphon')) {
    const syphonState = state.player.talent_states.core_states.syphon;
    if (now < (syphonState.cooldownUntil || 0)) return false;
    syphonState.cooldownUntil = now + 1000; // 1 second cooldown
    const angle = Math.atan2(my - state.player.y, mx - state.player.x);
    state.effects.push({
      type: 'syphon_cone',
      startTime: now,
      endTime: now + 1000,
      hasFired: false,
      angle,
      source: state.player,
      // Define the cone angle on the effect itself.  This avoids a
      // ReferenceError in gameLoop.js when the original implementation
      // references coneAngle outside of its definition.
      coneAngle: Math.PI / 4,
    });
    gameHelpers.play('syphonFire');
    return true;
  }
  return false;
}

/**
 * Handle the use of a defensive power.  This hook is kept intact for
 * backwards compatibility with other cores like Reflector and Quantum
 * Shadow which have not been redesigned.  Additional logic may be added
 * here for future defensive behaviours.
 */
export function handleCoreOnDefensivePower(powerKey, mx, my, gameHelpers) {
  const { play, addStatusEffect } = gameHelpers;
  if (playerHasCore('reflector')) {
    addStatusEffect('Reflective Ward', '🛡️', 2000);
  }
  if (playerHasCore('quantum_shadow')) {
    addStatusEffect('Phased', '👻', 2000);
    play('phaseShiftSound');
  }
}

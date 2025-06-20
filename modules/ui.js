// modules/ui.js
import { state } from './state.js';
import { powers } from './powers.js';

// --- DOM Element References ---
const ascensionFill = document.getElementById('ascension-bar-fill');
const ascensionText = document.getElementById('ascension-bar-text');
const apDisplay = document.getElementById('ascension-points-display');
const healthBarValue = document.getElementById('health-bar-value');
const healthBarText = document.getElementById('health-bar-text');
const shieldBar = document.getElementById('shield-bar-overlay');
const offSlot = document.getElementById('slot-off-0');
const defSlot = document.getElementById('slot-def-0');
const arenaBtn = document.getElementById('arenaBtn');
const bossContainer = document.getElementById("bossHpContainer");
const statusBar = document.getElementById('status-effects-bar');
const bossBannerEl = document.getElementById("bossBanner");
const levelSelectGrid = document.getElementById("levelSelectGrid");


// --- UI Update Functions ---

function updateStatusEffectsUI() {
    const now = Date.now();
    state.player.statusEffects = state.player.statusEffects.filter(effect => now < effect.endTime);
    
    statusBar.classList.toggle('visible', state.player.statusEffects.length > 0);
    statusBar.innerHTML = '';

    state.player.statusEffects.forEach(effect => {
        const remaining = effect.endTime - now;
        const duration = effect.endTime - effect.startTime;
        const progress = Math.max(0, remaining) / duration;
        const iconEl = document.createElement('div');
        iconEl.className = 'status-icon';
        iconEl.setAttribute('data-tooltip-text', `${effect.name} (${(remaining / 1000).toFixed(1)}s)`);
        const emojiEl = document.createElement('span');
        emojiEl.innerText = effect.emoji;
        const overlayEl = document.createElement('div');
        overlayEl.className = 'cooldown-overlay';
        overlayEl.style.transform = `scaleY(${1 - progress})`;
        iconEl.appendChild(emojiEl);
        iconEl.appendChild(overlayEl);
        statusBar.appendChild(iconEl);
    });
}

export function updateUI() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    document.querySelectorAll('.ability-key').forEach(el => { el.style.display = isTouchDevice ? 'none' : 'block'; });

    // Update Ascension Bar
    ascensionFill.style.width = `${(state.player.essence / state.player.essenceToNextLevel) * 100}%`;
    ascensionText.innerText = `LVL ${state.player.level}`;
    apDisplay.innerText = `AP: ${state.player.ascensionPoints}`;
    
    // Update Health Bar
    const healthPct = Math.max(0, state.player.health) / state.player.maxHealth;
    healthBarValue.style.width = `${healthPct * 100}%`;
    healthBarText.innerText = `${Math.max(0, Math.round(state.player.health))}/${Math.round(state.player.maxHealth)}`;
    healthBarValue.classList.toggle('health-high', healthPct > 0.6);
    healthBarValue.classList.toggle('health-medium', healthPct <= 0.6 && healthPct > 0.3);
    healthBarValue.classList.toggle('health-low', healthPct <= 0.3);
    
    // Update Shield Bar
    const shieldEffect = state.player.statusEffects.find(e => e.name === 'Shield');
    if (shieldEffect) {
        const now = Date.now();
        const remaining = shieldEffect.endTime - now;
        const duration = shieldEffect.endTime - shieldEffect.startTime;
        shieldBar.style.width = `${Math.max(0, remaining) / duration * 100}%`;
    } else {
        shieldBar.style.width = '0%';
    }
    
    // Update Ability Slots
    const offP = state.offensiveInventory[0];
    const defP = state.defensiveInventory[0];
    offSlot.innerHTML = offP ? powers[offP].emoji : '<span class="ability-key">L-Click</span>';
    defSlot.innerHTML = defP ? powers[defP].emoji : '<span class="ability-key">R-Click</span>';
    offSlot.className = `ability-slot main ${offP ? '' : 'empty'}`;
    defSlot.className = `ability-slot ${defP ? '' : 'empty'}`;
    offSlot.setAttribute('data-tooltip-text', offP ? powers[offP].desc : 'Offensive Power');
    defSlot.setAttribute('data-tooltip-text', defP ? powers[defP].desc : 'Defensive Power');

    // Update Queued Slots
    for (let i = 1; i <= 2; i++) {
        const offPower = state.offensiveInventory[i];
        const defPower = state.defensiveInventory[i];
        const qOffSlot = document.getElementById(`q-off-${i}`);
        const qDefSlot = document.getElementById(`q-def-${i}`);
        qOffSlot.innerHTML = offPower ? powers[offPower].emoji : '';
        qOffSlot.className = `queue-slot ${offPower ? 'visible' : ''}`;
        qOffSlot.setAttribute('data-tooltip-text', offPower ? powers[offPower].desc : '');
        qDefSlot.innerHTML = defPower ? powers[defPower].emoji : '';
        qDefSlot.className = `queue-slot ${defPower ? 'visible' : ''}`;
        qDefSlot.setAttribute('data-tooltip-text', defPower ? powers[defPower].desc : '');
    }

    // Update Boss HP Bars
    bossContainer.innerHTML = '';
    state.enemies.filter(e => e.boss).forEach(boss => {
        const wrapper = document.createElement('div');
        wrapper.className = 'boss-hp-bar-wrapper';
        const label = document.createElement('div');
        label.className = 'boss-hp-label';
        label.innerText = boss.name;
        const bar = document.createElement('div');
        bar.className = 'boss-hp-bar';
        bar.style.backgroundColor = boss.color;
        bar.style.width = `${(boss.hp / boss.maxHP) * 100}%`;
        wrapper.appendChild(label);
        wrapper.appendChild(bar);
        bossContainer.appendChild(wrapper);
    });
    
    updateStatusEffectsUI();
}

export function showBossBanner(boss){ 
    bossBannerEl.innerText="🚨 "+boss.name+" 🚨"; 
    bossBannerEl.style.opacity=1; 
    setTimeout(()=>bossBannerEl.style.opacity=0,2500); 
}

export function populateLevelSelect(bossData, startSpecificLevel) {
    levelSelectGrid.innerHTML = '';
    bossData.forEach((boss, index) => {
        const level = index + 1;
        const button = document.createElement('button');
        button.innerText = level;
        button.title = boss.name;
        button.onclick = () => {
            startSpecificLevel(level);
        };
        levelSelectGrid.appendChild(button);
    });
}
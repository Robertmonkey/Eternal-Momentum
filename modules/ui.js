// modules/ui.js
import { state } from './state.js';
import { powers } from './powers.js';
import { bossData } from './bosses.js';
import { STAGE_CONFIG } from './config.js';
import { getBossesForStage } from './gameLoop.js';
import { AudioManager } from './audio.js';

const ascensionFill = document.getElementById('ascension-bar-fill');
const ascensionText = document.getElementById('ascension-bar-text');
const apDisplay = document.getElementById('ascension-points-display');
const healthBarValue = document.getElementById('health-bar-value');
const healthBarText = document.getElementById('health-bar-text');
const shieldBar = document.getElementById('shield-bar-overlay');
const offSlot = document.getElementById('slot-off-0');
const defSlot = document.getElementById('slot-def-0');
const bossContainer = document.getElementById("bossHpContainer");
const statusBar = document.getElementById('status-effects-bar');
const bossBannerEl = document.getElementById("bossBanner");
const levelSelectList = document.getElementById("level-select-list");
const notificationBanner = document.getElementById('unlock-notification');
const customConfirm = document.getElementById('custom-confirm');
const confirmTitle = document.getElementById('custom-confirm-title');
const confirmText = document.getElementById('custom-confirm-text');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

const bossInfoModal = document.getElementById('bossInfoModal');
const bossInfoTitle = document.getElementById('bossInfoModalTitle');
const bossInfoContent = document.getElementById('bossInfoModalContent');
const closeBossInfoBtn = document.getElementById('closeBossInfoModalBtn');

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

    ascensionFill.style.width = `${(state.player.essence / state.player.essenceToNextLevel) * 100}%`;
    ascensionText.innerText = `LVL ${state.player.level}`;
    apDisplay.innerText = `AP: ${state.player.ascensionPoints}`;
    
    const healthPct = Math.max(0, state.player.health) / state.player.maxHealth;
    healthBarValue.style.width = `${healthPct * 100}%`;
    healthBarText.innerText = `${Math.max(0, Math.round(state.player.health))}/${Math.round(state.player.maxHealth)}`;
    healthBarValue.classList.toggle('health-high', healthPct > 0.6);
    healthBarValue.classList.toggle('health-medium', healthPct <= 0.6 && healthPct > 0.3);
    healthBarValue.classList.toggle('health-low', healthPct <= 0.3);
    
    const shieldEffect = state.player.statusEffects.find(e => e.name === 'Shield' || e.name === 'Contingency Protocol');
    if (shieldEffect) {
        const now = Date.now();
        const remaining = shieldEffect.endTime - now;
        const duration = shieldEffect.endTime - shieldEffect.startTime;
        shieldBar.style.width = `${Math.max(0, remaining) / duration * 100}%`;
    } else {
        shieldBar.style.width = '0%';
    }
    
    const offP = state.offensiveInventory[0];
    const defP = state.defensiveInventory[0];
    offSlot.innerHTML = offP ? powers[offP].emoji : '';
    defSlot.innerHTML = defP ? powers[defP].emoji : '';
    offSlot.className = `ability-slot main ${offP ? '' : 'empty'}`;
    defSlot.className = `ability-slot ${defP ? '' : 'empty'}`;
    offSlot.setAttribute('data-tooltip-text', offP ? powers[offP].desc : 'Offensive Power (Left-Click)');
    defSlot.setAttribute('data-tooltip-text', defP ? powers[defP].desc : 'Defensive Power (Right-Click)');

    for (let i = 1; i <= 2; i++) {
        const offPower = state.offensiveInventory[i];
        const defPower = state.defensiveInventory[i];
        const qOffSlot = document.getElementById(`q-off-${i}`);
        const qDefSlot = document.getElementById(`q-def-${i}`);
        
        if (qOffSlot) {
            const isOffSlotVisible = (i < state.player.unlockedOffensiveSlots) && offPower;
            qOffSlot.classList.toggle('visible', isOffSlotVisible);
            qOffSlot.innerHTML = offPower ? powers[offPower].emoji : '';
            qOffSlot.setAttribute('data-tooltip-text', offPower ? powers[offPower].desc : '');
        }

        if (qDefSlot) {
            const isDefSlotVisible = (i < state.player.unlockedDefensiveSlots) && defPower;
            qDefSlot.classList.toggle('visible', isDefSlotVisible);
            qDefSlot.innerHTML = defPower ? powers[defPower].emoji : '';
            qDefSlot.setAttribute('data-tooltip-text', defPower ? powers[defPower].desc : '');
        }
    }

    const allBosses = state.enemies.filter(e => e.boss);
    const renderedBossTypes = new Set();
    const bossesToDisplay = [];
    const currentBossIdsOnScreen = new Set();

    allBosses.forEach(boss => {
        currentBossIdsOnScreen.add(boss.instanceId.toString());
        const sharedHealthIds = ['sentinel_pair', 'fractal_horror'];
        if (sharedHealthIds.includes(boss.id)) {
            if (!renderedBossTypes.has(boss.id)) {
                bossesToDisplay.push(boss);
                renderedBossTypes.add(boss.id);
            }
        } else {
            bossesToDisplay.push(boss);
        }
    });

    for (const child of Array.from(bossContainer.children)) {
        if (!currentBossIdsOnScreen.has(child.dataset.instanceId)) {
            bossContainer.removeChild(child);
        }
    }
    
    const GRID_THRESHOLD = 4;
    if (bossesToDisplay.length >= GRID_THRESHOLD) {
        bossContainer.classList.add('grid-layout');
    } else {
        bossContainer.classList.remove('grid-layout');
    }

    bossesToDisplay.forEach(boss => {
        let wrapper = document.getElementById('boss-hp-' + boss.instanceId);
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'boss-hp-bar-wrapper';
            wrapper.id = 'boss-hp-' + boss.instanceId;
            wrapper.dataset.instanceId = boss.instanceId.toString();

            const label = document.createElement('div');
            label.className = 'boss-hp-label';
            label.innerText = boss.name;
            
            const bar = document.createElement('div');
            bar.className = 'boss-hp-bar';
            
            wrapper.appendChild(label);
            wrapper.appendChild(bar);
            bossContainer.appendChild(wrapper);
        }

        const bar = wrapper.querySelector('.boss-hp-bar');
        const currentHp = boss.id === 'fractal_horror' ? (state.fractalHorrorSharedHp ?? 0) : boss.hp;
        bar.style.backgroundColor = boss.color;
        bar.style.width = `${Math.max(0, currentHp / boss.maxHP) * 100}%`;
    });
    
    updateStatusEffectsUI();
}

function showBossInfo(bossIds, type) {
    let title = '';
    let content = '';

    const bosses = bossIds.map(id => bossData.find(b => b.id === id)).filter(b => b);

    if (bosses.length === 0) return;

    if (bosses.length > 1) {
        title = bosses.map(b => b.name).join(' & ');
    } else {
        title = bosses[0].name;
    }

    if (type === 'lore') {
        title += ' - Lore ℹ️';
        content = bosses.map(b => `<h3>${b.name}</h3><p>${b.lore}</p>`).join('<hr style="border-color: rgba(255,255,255,0.2); margin: 15px 0;">');
    } else {
        title += ' - Mechanics ❔';
        content = bosses.map(b => `<h3>${b.name}</h3><p>${b.mechanics_desc}</p>`).join('<hr style="border-color: rgba(255,255,255,0.2); margin: 15px 0;">');
    }

    bossInfoTitle.innerHTML = title;
    bossInfoContent.innerHTML = content;
    bossInfoModal.style.display = 'flex';
    AudioManager.playSfx('uiModalOpen');
}

closeBossInfoBtn.addEventListener('click', () => {
    bossInfoModal.style.display = 'none';
    AudioManager.playSfx('uiModalClose');
});


export function showBossBanner(boss){ 
    bossBannerEl.innerText="🚨 "+boss.name+" 🚨"; 
    bossBannerEl.style.opacity=1; 
    setTimeout(()=>bossBannerEl.style.opacity=0,2500); 
}

export function showUnlockNotification(text, subtext = '') {
    let content = `<span class="unlock-name">${text}</span>`;
    if (subtext) {
        content = `<span class="unlock-title">${subtext}</span>` + content;
    }
    notificationBanner.innerHTML = content;
    notificationBanner.classList.add('show');
    setTimeout(() => {
        notificationBanner.classList.remove('show');
    }, 3500);
}

export function populateLevelSelect(startSpecificLevel) {
    if (!levelSelectList) return;
    levelSelectList.innerHTML = '';

    const maxStage = state.player.highestStageBeaten + 1;

    for (let i = 1; i <= maxStage; i++) {
        const bossIds = getBossesForStage(i);
        if (!bossIds || bossIds.length === 0) continue;
        
        let bossNames = bossIds.map(id => {
            const boss = bossData.find(b => b.id === id);
            return boss ? boss.name : 'Unknown';
        }).join(' & ');
        
        const item = document.createElement('div');
        item.className = 'stage-select-item';
        
        item.innerHTML = `
            <div class="stage-item-main">
                <span class="stage-select-number">STAGE ${i}</span>
                <span class="stage-select-bosses">${bossNames}</span>
            </div>
            <div class="stage-item-actions">
                <button class="info-btn mechanics-btn" title="Mechanics">❔</button>
                <button class="info-btn lore-btn" title="Lore">ℹ️</button>
            </div>
        `;
        
        item.querySelector('.stage-item-main').onclick = () => {
            startSpecificLevel(i);
        };

        item.querySelector('.mechanics-btn').onclick = (e) => {
            e.stopPropagation();
            showBossInfo(bossIds, 'mechanics');
        };

        item.querySelector('.lore-btn').onclick = (e) => {
            e.stopPropagation();
            showBossInfo(bossIds, 'lore');
        };

        const bossNameElement = item.querySelector('.stage-select-bosses');
        item.addEventListener('mouseenter', () => {
            if (bossNameElement.scrollWidth > bossNameElement.clientWidth) {
                bossNameElement.classList.add('is-scrolling');
            }
        });
        item.addEventListener('mouseleave', () => {
            bossNameElement.classList.remove('is-scrolling');
        });

        levelSelectList.appendChild(item);
    }
    levelSelectList.parentElement.scrollTop = levelSelectList.parentElement.scrollHeight;
}

export function showCustomConfirm(title, text, onConfirm) {
    confirmTitle.innerText = title;
    confirmText.innerText = text;

    const close = () => {
        customConfirm.style.display = 'none';
        confirmYesBtn.removeEventListener('click', handleYes);
        confirmNoBtn.removeEventListener('click', handleNo);
    }

    const handleYes = () => {
        onConfirm();
        close();
    }

    const handleNo = () => {
        close();
    }

    confirmYesBtn.addEventListener('click', handleYes);
    confirmNoBtn.addEventListener('click', handleNo);

    customConfirm.style.display = 'flex';
}

export function populateOrreryMenu(onStart) {
    let totalEchoes = 0;
    if (state.player.highestStageBeaten >= 30) {
        totalEchoes += 10;
        totalEchoes += (state.player.highestStageBeaten - 30);
        if (state.player.highestStageBeaten >= 50) totalEchoes += 15;
        if (state.player.highestStageBeaten >= 70) totalEchoes += 20;
        if (state.player.highestStageBeaten >= 90) totalEchoes += 25;
    }

    const pointsDisplay = document.getElementById('orrery-points-total');
    const bossListContainer = document.getElementById('orrery-boss-list-container');
    const selectionContainer = document.getElementById('orrery-selection-display');
    const costDisplay = document.getElementById('orrery-current-cost');
    const startBtn = document.getElementById('orrery-start-btn');
    const resetBtn = document.getElementById('orrery-reset-btn');
    
    let selectedBosses = [];
    let currentCost = 0;

    const costs = { 1: 2, 2: 5, 3: 8 };

    function render() {
        pointsDisplay.innerText = totalEchoes - currentCost;
        bossListContainer.innerHTML = '';
        selectionContainer.innerHTML = '';

        const availableBosses = bossData.filter(b => b.difficulty_tier).sort((a,b) => a.difficulty_tier - b.difficulty_tier);
        
        availableBosses.forEach(boss => {
            const cost = costs[boss.difficulty_tier];
            const item = document.createElement('div');
            item.className = 'orrery-boss-item';
            
            const canAfford = (totalEchoes - currentCost) >= cost;
            item.classList.toggle('disabled', !canAfford);

            const isPantheon = boss.id === 'pantheon';
            const iconStyle = isPantheon ? '' : `background-color: ${boss.color};`;
            const iconClass = isPantheon ? 'orrery-boss-icon pantheon-icon-bg' : 'orrery-boss-icon';

            item.innerHTML = `
                <div class="orrery-boss-info">
                    <span class="${iconClass}" style="${iconStyle}"></span>
                    <span class="orrery-boss-name">${boss.name}</span>
                </div>
                <div class="stage-item-actions">
                     <button class="info-btn mechanics-btn" title="Mechanics">❔</button>
                     <button class="info-btn lore-btn" title="Lore">ℹ️</button>
                     <span class="orrery-boss-cost">${cost}</span>
                </div>
            `;
            
            item.querySelector('.orrery-boss-info').onclick = () => {
                 if (canAfford) {
                    AudioManager.playSfx('talentPurchase');
                    selectedBosses.push(boss.id);
                    currentCost += cost;
                    render();
                } else {
                    AudioManager.playSfx('talentError');
                }
            };

            item.querySelector('.mechanics-btn').onclick = (e) => {
                e.stopPropagation();
                showBossInfo([boss.id], 'mechanics');
            };
            item.querySelector('.lore-btn').onclick = (e) => {
                e.stopPropagation();
                showBossInfo([boss.id], 'lore');
            };

            bossListContainer.appendChild(item);
        });

        selectedBosses.forEach((bossId, index) => {
            const boss = bossData.find(b => b.id === bossId);
            const item = document.createElement('div');
            item.className = 'orrery-selected-boss';

            if (boss.id === 'pantheon') {
                item.classList.add('pantheon-icon-bg');
            } else {
                item.style.backgroundColor = boss.color;
            }
            
            item.title = boss.name;

            item.onclick = () => {
                AudioManager.playSfx('uiClickSound');
                selectedBosses.splice(index, 1);
                currentCost -= costs[boss.difficulty_tier];
                render();
            };
            selectionContainer.appendChild(item);
        });

        costDisplay.innerText = currentCost;
        if (selectedBosses.length > 0) {
            startBtn.classList.remove('disabled');
            startBtn.onclick = () => onStart(selectedBosses);
        } else {
            startBtn.classList.add('disabled');
            startBtn.onclick = null;
        }
    }

    resetBtn.onclick = () => {
        AudioManager.playSfx('uiClickSound');
        selectedBosses = [];
        currentCost = 0;
        render();
    };

    render();
}

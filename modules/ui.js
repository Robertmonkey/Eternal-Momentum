// modules/ui.js
import { state, savePlayerState, resetStageStats } from './state.js';
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
const pantheonBar = document.getElementById('pantheon-buffs-bar');
const bossBannerEl = document.getElementById("bossBanner");
const levelSelectList = document.getElementById("level-select-list");
const stageSearchInput = document.getElementById('stageSearchInput');
const stageClearedToggle = document.getElementById('stageShowCleared');
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

const aberrationCoreSocket = document.getElementById('aberration-core-socket');
const aberrationCoreIcon = document.getElementById('aberration-core-icon');
const aberrationCoreListContainer = document.getElementById('aberration-core-list-container');
const equippedCoreNameEl = document.getElementById('aberration-core-equipped-name');

const stageDetailsPanel = document.getElementById('stage-details-panel');
const stageDetailsTitle = document.getElementById('stage-details-title');
const stageDetailsSubtitle = document.getElementById('stage-details-subtitle');
const stageDetailsStatsList = document.getElementById('stage-details-stats');
const stageDetailsLastRun = document.getElementById('stage-details-last-run');
const stageDetailsEmpty = document.getElementById('stage-details-empty');
const stageDetailsContent = document.getElementById('stage-details-content');
const stageDetailsResetBtn = document.getElementById('stage-details-reset');

let stageStartHandler = null;
let activeStageNumber = null;

function getDefaultStageStats() {
    return { attempts: 0, clears: 0, bestTimeMs: null, lastTimeMs: null, lastOutcome: null };
}

function getStageStats(stageNumber) {
    if (!state.player.stageStats) return null;
    return state.player.stageStats[stageNumber] || state.player.stageStats[stageNumber.toString()] || null;
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    const totalMs = Math.floor(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const tenths = Math.floor((totalMs % 1000) / 100);
    if (minutes > 0) {
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    }
    const displaySeconds = (totalMs / 1000).toFixed(1);
    return `${displaySeconds}s`;
}

function formatWinRate(clears, attempts) {
    if (!attempts) return '—';
    if (!clears) return '0%';
    return `${Math.round((clears / attempts) * 100)}%`;
}

function describeLastAttempt(stats) {
    if (!stats || !stats.lastOutcome) {
        return 'No attempts recorded.';
    }
    if (!stats.lastTimeMs) {
        return `Last outcome: ${stats.lastOutcome}.`;
    }
    const duration = formatDuration(stats.lastTimeMs);
    if (stats.lastOutcome === 'Victory') {
        return `Last clear achieved in ${duration}.`;
    }
    if (stats.lastOutcome === 'Defeat') {
        return `Timeline collapsed after ${duration}.`;
    }
    return `Last attempt lasted ${duration}.`;
}

function updateStageDetailsPanel(stageNumber) {
    if (!stageDetailsPanel) return;
    const isValidStage = Number.isInteger(stageNumber) && stageNumber > 0;
    stageDetailsPanel.dataset.stage = isValidStage ? stageNumber : '';

    if (!isValidStage) {
        if (stageDetailsContent) stageDetailsContent.hidden = true;
        if (stageDetailsEmpty) stageDetailsEmpty.hidden = false;
        if (stageDetailsResetBtn) stageDetailsResetBtn.disabled = true;
        return;
    }

    const stageInfo = STAGE_CONFIG.find(s => s.stage === stageNumber);
    const stageName = stageInfo?.displayName || `Stage ${stageNumber}`;
    const bossIds = stageInfo?.bosses || [];
    const bossNames = bossIds.map(id => {
        const boss = bossData.find(b => b.id === id);
        return boss ? boss.name : 'Unknown';
    }).join(' & ');

    const stats = getStageStats(stageNumber) || getDefaultStageStats();

    if (stageDetailsTitle) stageDetailsTitle.innerText = `Stage ${stageNumber}: ${stageName}`;
    if (stageDetailsSubtitle) stageDetailsSubtitle.innerText = bossNames ? `Encounter: ${bossNames}` : 'Unknown encounter';

    if (stageDetailsStatsList) {
        const attempts = stats.attempts ?? 0;
        const clears = stats.clears ?? 0;
        const bestClear = stats.bestTimeMs ? formatDuration(stats.bestTimeMs) : '—';
        const winRate = formatWinRate(clears, attempts);
        stageDetailsStatsList.innerHTML = `
            <li><span>Attempts</span><span>${attempts}</span></li>
            <li><span>Clears</span><span>${clears}</span></li>
            <li><span>Win Rate</span><span>${winRate}</span></li>
            <li><span>Best Clear</span><span>${bestClear}</span></li>
        `;
    }

    if (stageDetailsLastRun) stageDetailsLastRun.innerText = describeLastAttempt(stats);

    if (stageDetailsContent) stageDetailsContent.hidden = false;
    if (stageDetailsEmpty) stageDetailsEmpty.hidden = true;
    if (stageDetailsResetBtn) {
        const hasAttempts = !!stats.attempts;
        stageDetailsResetBtn.disabled = !hasAttempts;
        stageDetailsResetBtn.title = hasAttempts ? 'Clear recorded stats for this stage' : 'No attempts recorded yet';
    }
}

function setActiveStage(stageNumber) {
    activeStageNumber = Number.isInteger(stageNumber) ? stageNumber : null;
    if (!levelSelectList) {
        updateStageDetailsPanel(activeStageNumber);
        return;
    }
    const items = levelSelectList.querySelectorAll('.stage-select-item');
    items.forEach(item => {
        const itemStage = Number(item.dataset.stage);
        item.classList.toggle('stage-active', activeStageNumber === itemStage);
    });
    updateStageDetailsPanel(activeStageNumber);
}

function renderStageSelectList() {
    if (!levelSelectList || !stageStartHandler) return;

    levelSelectList.innerHTML = '';

    const maxStage = Math.max(1, state.player.highestStageBeaten + 1);
    const query = (stageSearchInput?.value || '').trim().toLowerCase();
    const showClearedOnly = stageClearedToggle?.checked ?? false;
    let renderedCount = 0;
    let firstRenderableStage = null;

    for (let i = 1; i <= maxStage; i++) {
        const bossIds = getBossesForStage(i);
        if (!bossIds || bossIds.length === 0) continue;

        const stageInfo = STAGE_CONFIG.find(s => s.stage === i);
        const stageName = stageInfo?.displayName || `Stage ${i}`;
        const bossNames = bossIds.map(id => {
            const boss = bossData.find(b => b.id === id);
            return boss ? boss.name : 'Unknown';
        }).join(' & ');

        const stats = getStageStats(i) || getDefaultStageStats();
        const attempts = stats.attempts ?? 0;
        const clears = stats.clears ?? 0;
        const bestTime = stats.bestTimeMs ?? null;
        const lastOutcome = stats.lastOutcome ?? null;
        const lastDuration = stats.lastTimeMs ?? null;

        const isCleared = clears > 0 || i <= state.player.highestStageBeaten;
        const isFrontier = i === state.player.highestStageBeaten + 1;

        if (showClearedOnly && !isCleared) continue;

        const searchTarget = `${stageName} stage ${i} ${bossNames}`.toLowerCase();
        if (query && !searchTarget.includes(query)) continue;

        const item = document.createElement('div');
        item.className = 'stage-select-item';
        if (isCleared) item.classList.add('stage-cleared');
        if (isFrontier) item.classList.add('stage-frontier');
        item.dataset.stage = i;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Stage ${i}: ${stageName}. ${bossNames || 'Unknown encounter'}.`);

        const statusBadge = isFrontier
            ? '<span class="stage-status frontier">Frontier</span>'
            : (isCleared ? '<span class="stage-status cleared">Cleared</span>' : '');

        const metaBadges = [];
        if (bestTime) {
            metaBadges.push(`<span class="stage-badge time" title="Best clear time">Best ${formatDuration(bestTime)}</span>`);
        }
        if (clears > 0) {
            metaBadges.push(`<span class="stage-badge clears" title="Total clears">${clears} Clears</span>`);
        }
        if (attempts > 0) {
            const winRate = formatWinRate(clears, attempts);
            metaBadges.push(`<span class="stage-badge winrate" title="${clears}/${attempts} clears">${winRate} Win</span>`);
        }
        if (lastOutcome) {
            const outcomeClass = lastOutcome.toLowerCase();
            const outcomeTitle = lastDuration ? `${lastOutcome} after ${formatDuration(lastDuration)}` : lastOutcome;
            metaBadges.push(`<span class="stage-badge outcome ${outcomeClass}" title="${outcomeTitle}">Last: ${lastOutcome}</span>`);
        }

        item.innerHTML = `
            <div class="stage-item-main">
                <div class="stage-item-header">
                    <span class="stage-select-number">STAGE ${i}</span>
                    ${statusBadge}
                </div>
                <span class="stage-select-name">${stageName}</span>
                <span class="stage-select-bosses">${bossNames}</span>
                ${metaBadges.length ? `<div class="stage-item-meta">${metaBadges.join('')}</div>` : ''}
            </div>
            <div class="stage-item-actions">
                <button class="info-btn mechanics-btn" title="Mechanics">❔</button>
                <button class="info-btn lore-btn" title="Lore">ℹ️</button>
            </div>
        `;

        const mainArea = item.querySelector('.stage-item-main');
        mainArea.onclick = () => stageStartHandler(i);
        item.addEventListener('mouseenter', () => setActiveStage(i));
        item.addEventListener('focus', () => setActiveStage(i));
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                stageStartHandler(i);
            }
        });

        const mechanicsBtn = item.querySelector('.mechanics-btn');
        const loreBtn = item.querySelector('.lore-btn');
        mechanicsBtn.onclick = (e) => {
            e.stopPropagation();
            showBossInfo(bossIds, 'mechanics');
        };
        loreBtn.onclick = (e) => {
            e.stopPropagation();
            showBossInfo(bossIds, 'lore');
        };

        const bossNameElement = item.querySelector('.stage-select-bosses');
        item.addEventListener('mouseenter', () => {
            if (bossNameElement && bossNameElement.scrollWidth > bossNameElement.clientWidth) {
                bossNameElement.classList.add('is-scrolling');
            }
        });
        item.addEventListener('mouseleave', () => {
            if (bossNameElement) bossNameElement.classList.remove('is-scrolling');
        });

        levelSelectList.appendChild(item);
        renderedCount++;
        if (firstRenderableStage === null) firstRenderableStage = i;
    }

    if (renderedCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'stage-empty-state';
        empty.innerText = query ? 'No stages match your search.' : 'Clear stages to unlock new encounters.';
        levelSelectList.appendChild(empty);
        setActiveStage(null);
    }

    const container = levelSelectList.parentElement;
    if (container) {
        if (query || showClearedOnly) {
            container.scrollTop = 0;
        } else {
            container.scrollTop = container.scrollHeight;
        }
    }

    if (renderedCount > 0) {
        const activeExists = activeStageNumber && levelSelectList.querySelector(`.stage-select-item[data-stage="${activeStageNumber}"]`);
        if (activeExists) {
            setActiveStage(activeStageNumber);
        } else {
            const frontierStage = Math.min(maxStage, state.player.highestStageBeaten + 1);
            let stageToActivate = levelSelectList.querySelector(`.stage-select-item[data-stage="${frontierStage}"]`) ? frontierStage : null;
            if (!stageToActivate) stageToActivate = firstRenderableStage;
            setActiveStage(stageToActivate ?? null);
        }
    }
}

function updatePantheonUI() {
    if (!pantheonBar) return;
    const now = Date.now();
    const buffs = state.player.activePantheonBuffs;

    pantheonBar.classList.toggle('visible', buffs.length > 0);
    pantheonBar.innerHTML = '';

    buffs.forEach(buff => {
        const coreData = bossData.find(b => b.id === buff.coreId);
        if (!coreData) return;

        const remaining = Math.max(0, (buff.endTime - now) / 1000);

        const iconEl = document.createElement('div');
        iconEl.className = 'pantheon-buff-icon';
        iconEl.setAttribute('data-tooltip-text', `${coreData.name} (${remaining.toFixed(1)}s)`);

        const innerIcon = document.createElement('div');
        innerIcon.className = 'pantheon-buff-inner-icon';
        if (coreData.id === 'pantheon') {
            innerIcon.classList.add('pantheon-icon-bg');
        } else {
            innerIcon.style.backgroundColor = coreData.color;
        }

        iconEl.appendChild(innerIcon);
        pantheonBar.appendChild(iconEl);
    });
}

function updateStatusEffectsUI() {
    const now = Date.now();
    state.player.statusEffects = state.player.statusEffects.filter(effect => now < effect.endTime);
    
    statusBar.classList.toggle('visible', state.player.statusEffects.length > 0);
    statusBar.innerHTML = '';

    state.player.statusEffects.forEach(effect => {
        const remaining = effect.endTime - now;
        const duration = effect.endTime - effect.startTime;
        const progress = duration > 0 ? Math.max(0, remaining) / duration : 0;
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

function updateCoreCooldownUI() {
    const coreId = state.player.equippedAberrationCore;
    const cooldownOverlay = document.getElementById('aberration-core-cooldown');

    if (!coreId || !cooldownOverlay) {
        if (cooldownOverlay) cooldownOverlay.style.transform = 'scaleY(0)'; // Set to empty if no core
        return;
    }

    const coreState = state.player.talent_states.core_states[coreId];
    if (!coreState || !coreState.cooldownUntil || Date.now() >= coreState.cooldownUntil) {
        cooldownOverlay.style.transform = 'scaleY(0)'; // Ready to use
        return;
    }
    
    // This map must contain the cooldown duration for any core ability that sets 'cooldownUntil'
    const cooldowns = { 
        juggernaut: 8000, 
        syphon: 5000,
        mirror_mirage: 12000,
        looper: 10000,
        gravity: 6000,
        architect: 15000,
        annihilator: 25000,
        // Passive cores can have cooldowns too
        puppeteer: 8000,
        helix_weaver: 5000,
        epoch_ender: 120000,
        splitter: 500
    };
    const duration = cooldowns[coreId];
    if(!duration) {
         cooldownOverlay.style.transform = 'scaleY(0)'; // No defined cooldown, so it's ready
         return;
    }
    
    // Calculate progress based on when the cooldown will end vs. its total duration
    const remainingTime = coreState.cooldownUntil - Date.now();
    const progress = Math.max(0, remainingTime) / duration;
    
    cooldownOverlay.style.transform = `scaleY(${progress})`; // Fills up as it cools down
}


function updateAberrationCoreUI() {
    if (!aberrationCoreSocket) return;

    if (state.player.level >= 10) {
        aberrationCoreSocket.classList.add('unlocked');
    } else {
        aberrationCoreSocket.classList.remove('unlocked');
        return;
    }

    const equippedCoreId = state.player.equippedAberrationCore;
    const coreData = equippedCoreId ? bossData.find(b => b.id === equippedCoreId) : null;

    if (coreData) {
        aberrationCoreSocket.classList.add('active');
        aberrationCoreSocket.style.setProperty('--nexus-glow', coreData.color);
        aberrationCoreIcon.style.backgroundColor = 'transparent';
        if (!document.getElementById('aberration-core-cooldown')) {
             aberrationCoreIcon.innerHTML = `<div id="aberration-core-cooldown" class="cooldown-overlay"></div>`;
        }
        aberrationCoreSocket.setAttribute('data-tooltip-text', `Core Attuned: ${coreData.name}`);
        
        if(coreData.id === 'pantheon') {
            aberrationCoreIcon.classList.add('pantheon-icon-bg');
        } else {
            aberrationCoreIcon.classList.remove('pantheon-icon-bg');
        }
    } else {
        aberrationCoreSocket.classList.remove('active');
        aberrationCoreSocket.style.removeProperty('--nexus-glow'); // Reset to default CSS variable
        aberrationCoreIcon.style.backgroundColor = 'transparent';
        if (aberrationCoreIcon.firstChild?.id !== 'aberration-core-cooldown') {
            aberrationCoreIcon.innerHTML = `<div id="aberration-core-cooldown" class="cooldown-overlay"></div>◎`;
        } else {
             aberrationCoreIcon.innerHTML = document.getElementById('aberration-core-cooldown').outerHTML + '◎';
        }
        aberrationCoreSocket.setAttribute('data-tooltip-text', 'No Core Attuned');
        aberrationCoreIcon.classList.remove('pantheon-icon-bg');
    }
}


export function updateUI() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    document.querySelectorAll('.ability-key').forEach(el => { el.style.display = isTouchDevice ? 'none' : 'block'; });

    ascensionFill.style.width = `${(state.player.essence / state.player.essenceToNextLevel) * 100}%`;
    ascensionText.innerText = `LVL ${state.player.level}`;
    apDisplay.innerText = `AP: ${state.player.ascensionPoints}`;
    
    updateAberrationCoreUI(); 
    updateCoreCooldownUI();

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
    bossContainer.classList.toggle('grid-layout', bossesToDisplay.length >= GRID_THRESHOLD);

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
    updatePantheonUI();
}

export function showBossInfo(bossIds, type) {
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

    stageStartHandler = startSpecificLevel;
    activeStageNumber = null;

    if (stageSearchInput && !stageSearchInput.dataset.bound) {
        stageSearchInput.addEventListener('input', () => renderStageSelectList());
        stageSearchInput.dataset.bound = 'true';
    }
    if (stageClearedToggle && !stageClearedToggle.dataset.bound) {
        stageClearedToggle.addEventListener('change', () => renderStageSelectList());
        stageClearedToggle.dataset.bound = 'true';
    }

    if (stageDetailsResetBtn && !stageDetailsResetBtn.dataset.bound) {
        stageDetailsResetBtn.addEventListener('click', () => {
            const stageValue = Number(stageDetailsPanel?.dataset.stage);
            if (!Number.isInteger(stageValue)) return;
            const stageInfo = STAGE_CONFIG.find(s => s.stage === stageValue);
            const stageName = stageInfo?.displayName || `Stage ${stageValue}`;
            showCustomConfirm(
                '|| PURGE STAGE RECORDS? ||',
                `Erase recorded attempts for Stage ${stageValue}: ${stageName}?`,
                () => {
                    resetStageStats(stageValue);
                    renderStageSelectList();
                }
            );
        });
        stageDetailsResetBtn.dataset.bound = 'true';
    }

    renderStageSelectList();
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

export function populateAberrationCoreMenu(onEquip) {
    if (!aberrationCoreListContainer) return;
    aberrationCoreListContainer.innerHTML = '';

    const equippedCoreId = state.player.equippedAberrationCore;
    const equippedCoreData = equippedCoreId ? bossData.find(b => b.id === equippedCoreId) : null;
    equippedCoreNameEl.innerText = equippedCoreData ? equippedCoreData.name : 'None';
    if(equippedCoreData?.color) equippedCoreNameEl.style.color = equippedCoreData.color;
    else equippedCoreNameEl.style.color = 'var(--nexus-glow)';


    bossData.forEach(core => {
        if (!core.core_desc) return;

        let isUnlocked = state.player.unlockedAberrationCores.has(core.id);
        if (!isUnlocked && state.player.level >= core.unlock_level) {
            state.player.unlockedAberrationCores.add(core.id);
            savePlayerState(); 
            isUnlocked = true;
        }
        
        const isEquipped = state.player.equippedAberrationCore === core.id;

        const item = document.createElement('div');
        item.className = 'aberration-core-item';
        if (!isUnlocked) item.classList.add('locked');
        if (isEquipped) item.classList.add('equipped');

        const iconClass = core.id === 'pantheon' ? 'core-item-icon pantheon-icon-bg' : 'core-item-icon';
        const iconStyle = core.id === 'pantheon' ? '' : `background-color: ${core.color};`;

        const coresWithActiveAbility = new Set(['juggernaut', 'syphon', 'gravity', 'architect', 'annihilator', 'looper']);
        let coreDescHtml = isUnlocked ? core.core_desc : '????????????????';

        if (isUnlocked && coresWithActiveAbility.has(core.id)) {
            coreDescHtml += `<div class="core-active-ability-indicator">Core Power: [LMB+RMB]</div>`;
        }

        item.innerHTML = `
            <div class="${iconClass}" style="${iconStyle}"></div>
            <div class="core-item-details">
                <div class="core-item-name">${isUnlocked ? core.name : 'LOCKED // LEVEL ' + core.unlock_level}</div>
                <div class="core-item-desc">${coreDescHtml}</div>
            </div>
        `;
        
        if (isUnlocked) {
            item.onclick = () => onEquip(core.id);
        }

        aberrationCoreListContainer.appendChild(item);
    });
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

// modules/ascension.js
import { state, savePlayerState } from './state.js';
import { TALENT_GRID_CONFIG } from './talents.js';
import { updateUI } from './ui.js';
import { AudioManager } from './audio.js';

const gridContainer = document.querySelector("#ascensionGridModal .ascension-content");

const allTalents = {};
Object.values(TALENT_GRID_CONFIG).forEach(constellation => {
    Object.keys(constellation).forEach(key => {
        if (key !== 'color') {
            allTalents[key] = constellation[key];
        }
    });
});

function isTalentVisible(talent) {
    if (!talent) return false;

    const powerUnlocked = !talent.powerPrerequisite || state.player.unlockedPowers.has(talent.powerPrerequisite);
    if (!powerUnlocked) {
        return false;
    }

    if (talent.prerequisites.length === 0) {
        return true;
    }

    return talent.prerequisites.every(prereqId => {
        const prereqTalent = allTalents[prereqId];
        if (!prereqTalent) return false;

        const ranksNeeded = prereqTalent.maxRanks;
        const currentRank = state.player.purchasedTalents.get(prereqId) || 0;

        return currentRank >= ranksNeeded;
    });
}


function drawConnectorLines() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = 'absolute';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'visible';
    svg.style.zIndex = '1';

    for (const key in TALENT_GRID_CONFIG) {
        const constellation = TALENT_GRID_CONFIG[key];
        const constellationColor = constellation.color || 'var(--primary-glow)';
        
        for (const talentId in constellation) {
            if (talentId === 'color') continue;
            const talent = constellation[talentId];

            talent.prerequisites.forEach(prereqId => {
                const prereqTalent = allTalents[prereqId];
                
                const powerUnlocked = !talent.powerPrerequisite || state.player.unlockedPowers.has(talent.powerPrerequisite);

                if (prereqTalent && state.player.purchasedTalents.has(prereqId) && powerUnlocked) {
                    const line = document.createElementNS("http://www.w3.org/2000/svg", 'line');
                    line.setAttribute('x1', `${prereqTalent.position.x}%`);
                    line.setAttribute('y1', `${prereqTalent.position.y}%`);
                    line.setAttribute('x2', `${talent.position.x}%`);
                    line.setAttribute('y2', `${talent.position.y}%`);
                    line.classList.add('connector-line');
                    
                    const isNexusConnection = talent.isNexus || prereqTalent.isNexus;
                    
                    const prereqRanksNeeded = prereqTalent.maxRanks;
                    const prereqCurrentRank = state.player.purchasedTalents.get(prereqId) || 0;
                    if (prereqCurrentRank >= prereqRanksNeeded) {
                        line.classList.add('unlocked');
                        if (!isNexusConnection) {
                            line.style.stroke = constellationColor;
                        }
                    }

                    if (isNexusConnection) {
                        line.classList.add('nexus-connector');
                    }

                    svg.appendChild(line);
                }
            });
        }
    }
    gridContainer.appendChild(svg);
}

function createTalentNode(talent, constellationColor) {
    const node = document.createElement('div');
    node.className = 'talent-node';
    node.style.left = `${talent.position.x}%`;
    node.style.top = `${talent.position.y}%`;
    
    node.addEventListener('mouseenter', () => AudioManager.playSfx('uiHoverSound'));

    const purchasedRank = state.player.purchasedTalents.get(talent.id) || 0;
    const isMaxRank = purchasedRank >= talent.maxRanks;

    let cost;
    if (isMaxRank) {
        cost = Infinity;
    } else if (talent.isInfinite) {
        cost = talent.costPerRank[0];
    } else {
        cost = talent.costPerRank[purchasedRank] || Infinity;
    }
    
    const prereqsMetForPurchase = talent.prerequisites.every(p => {
        const prereqTalent = allTalents[p];
        if (!prereqTalent) return false;
        const ranksNeeded = prereqTalent.maxRanks;
        const currentRank = state.player.purchasedTalents.get(p) || 0;
        return currentRank >= ranksNeeded;
    });

    const canPurchase = prereqsMetForPurchase && state.player.ascensionPoints >= cost;

    if (talent.isNexus) {
        node.classList.add('nexus-node');
    }
     if (talent.isInfinite) {
        node.classList.add('nexus-node');
    }
    
    if (isMaxRank) {
        node.classList.add('maxed');
        if (!node.classList.contains('nexus-node')) {
            node.style.borderColor = constellationColor;
            node.style.boxShadow = `0 0 15px ${constellationColor}`;
        }
    } else if (canPurchase) {
        node.classList.add('can-purchase');
    }

    const rankText = talent.maxRanks > 1 ? `<span>Rank: ${purchasedRank}/${talent.isInfinite ? '∞' : talent.maxRanks}</span>` : '<span>Mastery</span>';
    const costText = !isMaxRank ? `<span>Cost: ${cost} AP</span>` : '<span>MAXED</span>';
    
    const descriptionText = talent.description(purchasedRank + 1, isMaxRank);
    
    const tooltip = document.createElement('div');
    tooltip.className = 'talent-tooltip';

    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-icon">${talent.icon}</span>
            <span class="tooltip-name">${talent.name}</span>
        </div>
        <div class="tooltip-desc">${descriptionText}</div>
        <div class="tooltip-footer">${rankText}${costText}</div>`;
    
    node.innerHTML = `<span class="talent-icon">${talent.icon}</span>`;
    node.appendChild(tooltip);
    
    node.onclick = () => {
        if (!isMaxRank && canPurchase) {
            purchaseTalent(talent.id);
        } else if (!isMaxRank && !canPurchase && prereqsMetForPurchase) {
            AudioManager.playSfx('talentError');
        } else {
            AudioManager.playSfx('uiClickSound');
        }
    };
    
    node.addEventListener('mouseenter', () => {
        requestAnimationFrame(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const containerRect = gridContainer.getBoundingClientRect();

            tooltip.classList.remove('show-left', 'show-right', 'show-bottom');

            if (tooltipRect.right > containerRect.right - 10) {
                tooltip.classList.add('show-left');
            } else if (tooltipRect.left < containerRect.left + 10) {
                tooltip.classList.add('show-right');
            }

            if (tooltipRect.top < containerRect.top + 10) {
                tooltip.classList.add('show-bottom');
            }
        });
    });
    
    gridContainer.appendChild(node);
}

function purchaseTalent(talentId) {
    const talent = allTalents[talentId];
    if (!talent) return;

    const currentRank = state.player.purchasedTalents.get(talent.id) || 0;
    if (currentRank >= talent.maxRanks) return;

    let cost;
    if (talent.isInfinite) {
        cost = talent.costPerRank[0];
    } else {
        cost = talent.costPerRank[currentRank];
    }
    
    const prereqsMet = talent.prerequisites.every(p => {
        const prereqTalent = allTalents[p];
        if (!prereqTalent) return false;
        const ranksNeeded = prereqTalent.maxRanks;
        const currentPrereqRank = state.player.purchasedTalents.get(p) || 0;
        return currentPrereqRank >= ranksNeeded;
    });

    if (prereqsMet && state.player.ascensionPoints >= cost) {
        state.player.ascensionPoints -= cost;
        state.player.purchasedTalents.set(talent.id, currentRank + 1);
        
        AudioManager.playSfx('talentPurchase');
        
        applyAllTalentEffects();
        savePlayerState();

        renderAscensionGrid();
        document.getElementById("ap-total-asc-grid").innerText = state.player.ascensionPoints;
        updateUI();

    } else {
        AudioManager.playSfx('talentError');
        console.log("Cannot purchase talent! Not enough AP or prerequisites not met.");
    }
}

export function applyAllTalentEffects() {
    // --- Reset all modifiers to their base values ---
    let baseMaxHealth = 100;
    let baseSpeed = 1.0;
    let baseDamageMultiplier = 1.0;
    let baseDamageTakenMultiplier = 1.0;
    let basePickupRadius = 0;
    let baseEssenceGain = 1.0;
    let basePowerSpawnRate = 1.0; // NEW
    let basePullResistance = 0;

    state.player.purchasedTalents.forEach((rank, id) => {
        // --- Health ---
        if (id === 'exo-weave-plating') {
            const values = [15, 20, 25];
            for (let i = 0; i < rank; i++) baseMaxHealth += values[i];
        }
        
        // --- Speed ---
        if (id === 'solar-wind') {
            const values = [0.06, 0.06];
            for (let i = 0; i < rank; i++) baseSpeed += values[i]; // Use additive for clarity
        }
        
        // --- Damage ---
        if (id === 'high-frequency-emitters') {
            const values = [0.05, 0.07];
            for (let i = 0; i < rank; i++) baseDamageMultiplier += values[i];
        }
        
        // --- Utility ---
        if (id === 'resonance-magnet') {
            basePickupRadius += rank * 75;
        }
        if (id === 'essence-conduit') {
            const values = [0.10, 0.15];
            for (let i = 0; i < rank; i++) baseEssenceGain += values[i];
        }

        // --- NEW TALENTS ---
        if (id === 'resonant-frequencies') {
            const values = [0.10, 0.10]; // 10% per rank
            for (let i = 0; i < rank; i++) basePowerSpawnRate += values[i];
        }
        if (id === 'overcharged-capacitors') { // Kept for saves that might have it
            baseDamageMultiplier += 0.15;
            baseDamageTakenMultiplier += 0.15;
        }


        // --- ENDLESS TALENTS ---
        if (id === 'core-reinforcement') {
            baseMaxHealth += rank * 5;
        }
        if (id === 'momentum-drive') {
            baseSpeed += rank * 0.01; // Use additive for clarity
        }
        if (id === 'weapon-calibration') {
            baseDamageMultiplier += rank * 0.01;
        }
    });

    // --- Apply all calculated values to the state ---
    state.player.maxHealth = baseMaxHealth;
    state.player.speed = baseSpeed;
    state.player.talent_modifiers.damage_multiplier = baseDamageMultiplier;
    state.player.talent_modifiers.damage_taken_multiplier = baseDamageTakenMultiplier;
    state.player.talent_modifiers.pickup_radius_bonus = basePickupRadius;
    state.player.talent_modifiers.essence_gain_modifier = baseEssenceGain;
    state.player.talent_modifiers.power_spawn_rate_modifier = basePowerSpawnRate; // NEW
    state.player.talent_modifiers.pull_resistance_modifier = basePullResistance;
}


export function renderAscensionGrid() {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    drawConnectorLines();

    for (const key in TALENT_GRID_CONFIG) {
        const constellation = TALENT_GRID_CONFIG[key];
        const constellationColor = constellation.color || 'var(--primary-glow)';
        
        for (const talentId in constellation) {
            if (talentId === 'color') continue;
            const talent = constellation[talentId];
            
            if (state.player.purchasedTalents.has(talent.id) || isTalentVisible(talent)) {
                createTalentNode(talent, constellationColor);
            }
        }
    }
}

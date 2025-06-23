// modules/ascension.js
import { state, savePlayerState } from './state.js';
import { TALENT_GRID_CONFIG } from './talents.js';
import { updateUI } from './ui.js';

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
    
    // --- VISIBILITY BUG FIX ---
    // A talent should be VISIBLE if its prerequisite has been purchased at least once.
    // The check for whether it's maxed out happens later, when determining if it's PURCHASABLE.
    const prereqsMet = talent.prerequisites.every(p => {
        // The recursive call was removed to fix a logic loop.
        // We only need to know if the prerequisite has been touched to make the next one visible.
        return state.player.purchasedTalents.has(p);
    });

    return powerUnlocked && (talent.prerequisites.length === 0 || prereqsMet);
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
                // Connector is drawn if the prerequisite has been purchased, revealing the path.
                if (prereqTalent && state.player.purchasedTalents.has(prereqId)) {
                    const line = document.createElementNS("http://www.w3.org/2000/svg", 'line');
                    line.setAttribute('x1', `${prereqTalent.position.x}%`);
                    line.setAttribute('y1', `${prereqTalent.position.y}%`);
                    line.setAttribute('x2', `${talent.position.x}%`);
                    line.setAttribute('y2', `${talent.position.y}%`);
                    line.classList.add('connector-line');
                    
                    const isNexusConnection = talent.isNexus || prereqTalent.isNexus;
                    
                    // The line becomes fully colored in once the prereq is maxed AND the child is unlocked
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
    
    const purchasedRank = state.player.purchasedTalents.get(talent.id) || 0;
    const isMaxRank = purchasedRank >= talent.maxRanks;
    const cost = isMaxRank ? Infinity : (talent.costPerRank[purchasedRank] || Infinity);
    
    // This strict check determines if a talent is PURCHASABLE.
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
    
    if (isMaxRank) {
        node.classList.add('maxed');
        if (!node.classList.contains('nexus-node')) {
            node.style.borderColor = constellationColor;
            node.style.boxShadow = `0 0 15px ${constellationColor}`;
        }
    } else if (canPurchase) {
        node.classList.add('can-purchase');
    }

    const rankText = talent.maxRanks > 1 ? `<span>Rank: ${purchasedRank}/${talent.maxRanks}</span>` : '<span>Mastery</span>';
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
    
    if (!isMaxRank && canPurchase) {
        node.onclick = () => purchaseTalent(talent.id);
    }
    
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
    
    // A node is only added to the DOM if it's meant to be visible.
    if (isTalentVisible(talent) || state.player.purchasedTalents.has(talent.id)) {
        gridContainer.appendChild(node);
    }
}

function purchaseTalent(talentId) {
    const talent = allTalents[talentId];
    if (!talent) return;

    const currentRank = state.player.purchasedTalents.get(talent.id) || 0;
    if (currentRank >= talent.maxRanks) return;

    const cost = talent.costPerRank[currentRank];
    
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
        
        applyAllTalentEffects();
        savePlayerState();

        renderAscensionGrid();
        document.getElementById("ap-total-asc-grid").innerText = state.player.ascensionPoints;
        updateUI();

    } else {
        console.log("Cannot purchase talent! Not enough AP or prerequisites not met.");
    }
}

export function applyAllTalentEffects() {
    // Reset modifiers to base values
    let baseMaxHealth = 100;
    let baseSpeed = 1.0;
    let baseDamageMultiplier = 1.0;
    let baseDamageTakenMultiplier = 1.0;
    let basePickupRadius = 0;
    let baseEssenceGain = 1.0;
    let basePullResistance = 0;

    // Apply all purchased talents
    state.player.purchasedTalents.forEach((rank, id) => {
        if (id === 'exo-weave-plating') {
            const values = [15, 20, 25];
            for (let i = 0; i < rank; i++) baseMaxHealth += values[i];
        }
        if (id === 'solar-wind') {
            const values = [0.06, 0.06];
            for (let i = 0; i < rank; i++) baseSpeed *= (1 + values[i]);
        }
        if (id === 'high-frequency-emitters') {
            const values = [0.05, 0.07];
            for (let i = 0; i < rank; i++) baseDamageMultiplier += values[i];
        }
        if (id === 'resonance-magnet') {
            basePickupRadius += rank * 75;
        }
        if (id === 'essence-conduit') {
            const values = [0.10, 0.15];
            for (let i = 0; i < rank; i++) baseEssenceGain += values[i];
        }
        if (id === 'overcharged-capacitors') {
            baseDamageMultiplier += 0.15;
            baseDamageTakenMultiplier += 0.15;
        }
    });

    // Update player state with final values
    state.player.maxHealth = baseMaxHealth;
    state.player.speed = baseSpeed;
    state.player.talent_modifiers.damage_multiplier = baseDamageMultiplier;
    state.player.talent_modifiers.damage_taken_multiplier = baseDamageTakenMultiplier;
    state.player.talent_modifiers.pickup_radius_bonus = basePickupRadius;
    state.player.talent_modifiers.essence_gain_modifier = baseEssenceGain;
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
            createTalentNode(talent, constellationColor);
        }
    }
}

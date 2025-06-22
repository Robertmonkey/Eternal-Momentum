// modules/ascension.js
import { state } from './state.js';
import { TALENT_GRID_CONFIG } from './talents.js';

const gridContainer = document.querySelector("#ascensionGridModal .ascension-content");

/**
 * Renders the entire Ascension Grid.
 * It checks prerequisites and player state to decide what to display.
 */
export function renderAscensionGrid() {
    if (!gridContainer) return;
    gridContainer.innerHTML = ''; // Clear previous grid

    const allTalents = { ...TALENT_GRID_CONFIG.core, ...TALENT_GRID_CONFIG.aegis, ...TALENT_GRID_CONFIG.havoc, ...TALENT_GRID_CONFIG.flux };

    for (const talentId in allTalents) {
        const talent = allTalents[talentId];
        
        // Visibility Check
        const powerUnlocked = !talent.powerPrerequisite || state.player.unlockedPowers.has(talent.powerPrerequisite);
        const prereqsMet = talent.prerequisites.every(p => state.player.purchasedTalents.has(p));

        if (powerUnlocked && prereqsMet) {
            createTalentNode(talent);
        }
    }
}

/**
 * Creates and appends a single talent node to the grid.
 * @param {object} talent - The talent data from the config.
 */
function createTalentNode(talent) {
    const node = document.createElement('div');
    node.className = 'talent-node';
    node.style.left = `${talent.position.x}%`;
    node.style.top = `${talent.position.y}%`;
    
    const purchasedRank = state.player.purchasedTalents.get(talent.id) || 0;
    const canAfford = state.player.ascensionPoints >= (talent.costPerRank[purchasedRank] || Infinity);
    const isMaxRank = purchasedRank >= talent.maxRanks;

    // Set node state classes
    if (isMaxRank) {
        node.classList.add('maxed');
    } else if (canAfford) {
        node.classList.add('can-purchase');
    }

    // Tooltip
    let tooltip = `<div class="tooltip-header">
                     <span class="tooltip-icon">${talent.icon}</span>
                     <span class="tooltip-name">${talent.name}</span>
                   </div>
                   <div class="tooltip-desc">${talent.description(purchasedRank + 1)}</div>
                   <div class="tooltip-footer">
                     <span>Rank: ${purchasedRank}/${talent.maxRanks}</span>
                     ${!isMaxRank ? `<span>Cost: ${talent.costPerRank[purchasedRank]} AP</span>` : '<span>MAX RANK</span>'}
                   </div>`;
    node.innerHTML = `<span class="talent-icon">${talent.icon}</span><div class="talent-tooltip">${tooltip}</div>`;
    
    if (!isMaxRank && canAfford) {
        node.onclick = () => purchaseTalent(talent.id);
    }
    
    gridContainer.appendChild(node);
}

/**
 * Handles the logic of purchasing a talent.
 * @param {string} talentId - The ID of the talent to purchase.
 */
function purchaseTalent(talentId) {
    const allTalents = { ...TALENT_GRID_CONFIG.core, ...TALENT_GRID_CONFIG.aegis, ...TALENT_GRID_CONFIG.havoc, ...TALENT_GRID_CONFIG.flux };
    const talent = allTalents[talentId];
    if (!talent) return;

    const currentRank = state.player.purchasedTalents.get(talent.id) || 0;
    if (currentRank >= talent.maxRanks) return;

    const cost = talent.costPerRank[currentRank];
    if (state.player.ascensionPoints >= cost) {
        state.player.ascensionPoints -= cost;
        state.player.purchasedTalents.set(talent.id, currentRank + 1);

        // Apply the talent's effects immediately
        if (talent.effects) {
            talent.effects(state, currentRank + 1);
        }

        // Re-render the grid and update the AP display
        renderAscensionGrid();
        document.getElementById("ap-total-asc-grid").innerText = state.player.ascensionPoints;
        document.getElementById("ascension-points-display").innerText = `AP: ${state.player.ascensionPoints}`;

    } else {
        console.log("Not enough AP!"); // Placeholder for a visual indicator
    }
}

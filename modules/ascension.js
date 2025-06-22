// modules/ascension.js
import { state, savePlayerState } from './state.js';
import { TALENT_GRID_CONFIG } from './talents.js';

const gridContainer = document.querySelector("#ascensionGridModal .ascension-content");

const allTalents = {};
Object.values(TALENT_GRID_CONFIG).forEach(constellation => {
    Object.assign(allTalents, constellation);
});

function drawConnectorLines() {
    for (const talentId in allTalents) {
        const talent = allTalents[talentId];
        talent.prerequisites.forEach(prereqId => {
            const prereqTalent = allTalents[prereqId];
            if (prereqTalent) {
                const isVisible = (!talent.powerPrerequisite || state.player.unlockedPowers.has(talent.powerPrerequisite));
                if (!isVisible) return;

                const line = document.createElement('div');
                line.className = 'connector-line';
                
                const x1 = prereqTalent.position.x;
                const y1 = prereqTalent.position.y;
                const x2 = talent.position.x;
                const y2 = talent.position.y;

                const length = Math.hypot(x2 - x1, y2 - y1);
                const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

                line.style.width = `${length}%`;
                line.style.left = `${x1}%`;
                line.style.top = `${y1}%`;
                line.style.transform = `rotate(${angle}deg)`;
                
                const isPrereqPurchased = state.player.purchasedTalents.has(prereqId);
                if (isPrereqPurchased) {
                    line.classList.add('unlocked');
                }

                gridContainer.appendChild(line);
            }
        });
    }
}

function createTalentNode(talent) {
    const node = document.createElement('div');
    node.className = 'talent-node';
    node.style.left = `${talent.position.x}%`;
    node.style.top = `${talent.position.y}%`;
    
    const purchasedRank = state.player.purchasedTalents.get(talent.id) || 0;
    const isMaxRank = purchasedRank >= talent.maxRanks;
    const cost = isMaxRank ? Infinity : (talent.costPerRank[purchasedRank] || Infinity);
    const canAfford = state.player.ascensionPoints >= cost;

    if (isMaxRank) {
        node.classList.add('maxed');
    } else if (canAfford) {
        node.classList.add('can-purchase');
    }

    const rankText = talent.maxRanks > 1 ? `<span>Rank: ${purchasedRank}/${talent.maxRanks}</span>` : '<span>Mastery</span>';
    const costText = !isMaxRank ? `<span>Cost: ${cost} AP</span>` : '<span>MAXED</span>';
    
    node.innerHTML = `
        <span class="talent-icon">${talent.icon}</span>
        <div class="talent-tooltip">
            <div class="tooltip-header">
                <span class="tooltip-icon">${talent.icon}</span>
                <span class="tooltip-name">${talent.name}</span>
            </div>
            <div class="tooltip-desc">${talent.description(purchasedRank + 1)}</div>
            <div class="tooltip-footer">${rankText}${costText}</div>
        </div>`;
    
    if (!isMaxRank && canAfford) {
        node.onclick = () => purchaseTalent(talent.id);
    }
    
    gridContainer.appendChild(node);
}

function purchaseTalent(talentId) {
    const talent = allTalents[talentId];
    if (!talent) return;

    const currentRank = state.player.purchasedTalents.get(talent.id) || 0;
    if (currentRank >= talent.maxRanks) return;

    const cost = talent.costPerRank[currentRank];
    if (state.player.ascensionPoints >= cost) {
        state.player.ascensionPoints -= cost;
        state.player.purchasedTalents.set(talent.id, currentRank + 1);
        
        applyAllTalentEffects();
        savePlayerState();

        // TODO: Play shimmer/unlock sound effect
        renderAscensionGrid();
        document.getElementById("ap-total-asc-grid").innerText = state.player.ascensionPoints;
        document.getElementById("ascension-points-display").innerText = `AP: ${state.player.ascensionPoints}`;
        updateUI();

    } else {
        console.log("Not enough AP!");
    }
}

export function applyAllTalentEffects() {
    // Reset to base stats
    let baseMaxHealth = 100;
    let baseSpeed = 1.0;
    // Add other base stats here

    state.player.purchasedTalents.forEach((rank, id) => {
        const talent = allTalents[id];
        if (talent) {
            for (let i = 1; i <= rank; i++) {
                if (id === 'exo-weave-plating') baseMaxHealth += [15, 15, 20][i-1];
                if (id === 'fleet-footed') baseSpeed *= (1 + [0.05, 0.07][i-1]);
                // Add effects for other stat-boosting talents here
            }
        }
    });

    state.player.maxHealth = baseMaxHealth;
    state.player.speed = baseSpeed;
}

export function renderAscensionGrid() {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    drawConnectorLines();

    for (const talentId in allTalents) {
        const talent = allTalents[talentId];
        
        const powerUnlocked = !talent.powerPrerequisite || state.player.unlockedPowers.has(talent.powerPrerequisite);
        const prereqsMet = talent.prerequisites.every(p => state.player.purchasedTalents.has(p));

        if (powerUnlocked && (talent.prerequisites.length === 0 || prereqsMet)) {
            createTalentNode(talent);
        }
    }
}

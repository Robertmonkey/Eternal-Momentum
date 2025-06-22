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

function findTalentById(talentId) {
    return allTalents[talentId] || null;
}

function drawConnectorLines() {
    for (const key in TALENT_GRID_CONFIG) {
        const constellation = TALENT_GRID_CONFIG[key];
        const constellationColor = constellation.color || 'var(--primary-glow)';
        
        for (const talentId in constellation) {
            if (talentId === 'color') continue;
            const talent = constellation[talentId];

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
                        line.style.backgroundColor = constellationColor;
                        line.style.boxShadow = `0 0 5px ${constellationColor}`;
                    }

                    gridContainer.appendChild(line);
                }
            });
        }
    }
}

function createTalentNode(talent, constellationColor) {
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
        node.style.borderColor = constellationColor;
        node.style.boxShadow = `0 0 15px ${constellationColor}`;
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

        renderAscensionGrid();
        document.getElementById("ap-total-asc-grid").innerText = state.player.ascensionPoints;
        document.getElementById("ascension-points-display").innerText = `AP: ${state.player.ascensionPoints}`;
        updateUI();

    } else {
        // This could be replaced with a visual shake or sound effect later
        console.log("Not enough AP!");
    }
}

export function applyAllTalentEffects() {
    // Reset stats to their absolute base values before recalculating
    let baseMaxHealth = 100;
    let baseSpeed = 1.0;
    let baseDamageMultiplier = 1.0;
    let basePickupRadius = 0;
    let baseEssenceGain = 1.0;

    state.player.purchasedTalents.forEach((rank, id) => {
        const talent = findTalentById(id);
        if (talent) {
            for (let i = 1; i <= rank; i++) {
                // Apply effects for each purchased rank of the talent
                switch (id) {
                    case 'exo-weave-plating':
                        baseMaxHealth += [15, 15, 20][i-1];
                        break;
                    case 'fleet-footed':
                        baseSpeed *= (1 + [0.05, 0.07][i-1]);
                        break;
                    case 'high-frequency-emitters':
                        baseDamageMultiplier += [0.05, 0.07][i-1];
                        break;
                    case 'resonance-magnet':
                        basePickupRadius += 75;
                        break;
                    case 'essence-conduit':
                        baseEssenceGain += [0.10, 0.15][i-1];
                        break;
                }
            }
        }
    });

    state.player.maxHealth = baseMaxHealth;
    state.player.speed = baseSpeed;
    state.player.talent_modifiers.damage_multiplier = baseDamageMultiplier;
    state.player.talent_modifiers.pickup_radius_bonus = basePickupRadius;
    state.player.talent_modifiers.essence_gain_modifier = baseEssenceGain;
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
            
            const powerUnlocked = !talent.powerPrerequisite || state.player.unlockedPowers.has(talent.powerPrerequisite);
            const prereqsMet = talent.prerequisites.every(p => state.player.purchasedTalents.has(p));

            if (powerUnlocked && (talent.prerequisites.length === 0 || prereqsMet)) {
                createTalentNode(talent, constellationColor);
            }
        }
    }
}

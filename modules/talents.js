// modules/talents.js

/**
 * Defines the entire talent grid structure.
 *
 * Each talent has the following properties:
 * - id: A unique identifier for the talent.
 * - name: The display name of the talent.
 * - description: A function that returns the description, can be dynamic based on rank.
 * - icon: The emoji to display on the node.
 * - maxRanks: The maximum number of times this talent can be purchased.
 * - costPerRank: An array of AP costs for each rank (e.g., [1, 2, 3]).
 * - position: An {x, y} object for its position on the grid (0-100 scale).
 * - prerequisites: An array of talent IDs that must be purchased to unlock this one.
 * - powerPrerequisite: (Optional) The power-up ID that must be unlocked via leveling to see this talent branch.
 * - effects: A function to apply the talent's effects to the state.
 */
export const TALENT_GRID_CONFIG = {
    // --- CORE CONSTALLATION (Always Visible) ---
    core: {
        'core-health': {
            id: 'core-health',
            name: 'Vitality Core',
            description: (rank) => `Increases Max Health by ${[10, 15, 25][rank-1] || 0}. Total: +${[10, 25, 50][rank-1] || 0}`,
            icon: '❤️',
            maxRanks: 3,
            costPerRank: [1, 2, 2],
            position: { x: 50, y: 5 },
            prerequisites: [],
            effects: (state, rank) => { state.player.maxHealth += [10, 15, 25][rank-1]; }
        },
        'core-speed': {
            id: 'core-speed',
            name: 'Momentum Drive',
            description: (rank) => `Increases base speed by ${[2, 3, 5][rank-1] || 0}%.`,
            icon: '🏃',
            maxRanks: 3,
            costPerRank: [2, 2, 3],
            position: { x: 40, y: 15 },
            prerequisites: ['core-health'],
            effects: (state, rank) => { state.player.speed *= [1.02, 1.03, 1.05][rank-1]; }
        },
        'core-essence': {
            id: 'core-essence',
            name: 'Essence Collector',
            description: (rank) => `Gain ${[5, 5, 10][rank-1] || 0}% more Essence from all sources.`,
            icon: '💠',
            maxRanks: 3,
            costPerRank: [2, 2, 3],
            position: { x: 60, y: 15 },
            prerequisites: ['core-health'],
            effects: (state, rank) => { state.player.essenceGainModifier *= [1.05, 1.05, 1.10][rank-1]; }
        },
    },

    // --- AEGIS CONSTALLATION (Defensive) ---
    aegis: {
        'shield-duration': {
            id: 'shield-duration',
            name: 'Extended Field',
            powerPrerequisite: 'shield',
            description: (rank) => `Shield duration +${[0.5, 0.5, 1][rank-1] || 0}s.`,
            icon: '⏱️',
            maxRanks: 3,
            costPerRank: [1, 1, 2],
            position: { x: 20, y: 30 },
            prerequisites: ['core-speed'],
            effects: (state, rank) => { /* To be implemented in power logic */ }
        },
        'shield-mastery-reflect': {
            id: 'shield-mastery-reflect',
            name: 'Mastery: Reflective Barrier',
            powerPrerequisite: 'shield',
            description: () => `When your Shield expires or breaks, it unleashes a Shockwave.`,
            icon: '💥',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 20, y: 45 },
            prerequisites: ['shield-duration'],
            effects: (state, rank) => { /* To be implemented in power logic */ }
        },
    },
    
    // --- HAVOC CONSTALLATION (Offensive) ---
    havoc: {
        'missile-damage': {
            id: 'missile-damage',
            name: 'High-Explosive Warhead',
            powerPrerequisite: 'missile',
            description: (rank) => `Missile base damage +${[2, 3, 5][rank-1] || 0}.`,
            icon: '💣',
            maxRanks: 3,
            costPerRank: [1, 2, 2],
            position: { x: 80, y: 30 },
            prerequisites: ['core-essence'],
            effects: (state, rank) => { /* To be implemented in power logic */ }
        },
         'missile-mastery-cluster': {
            id: 'missile-mastery-cluster',
            name: 'Mastery: Cluster Bomb',
            powerPrerequisite: 'missile',
            description: () => `Missile leaves behind a field of 3 smaller, damaging explosions.`,
            icon: '集群',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 80, y: 45 },
            prerequisites: ['missile-damage'],
            effects: (state, rank) => { /* To be implemented in power logic */ }
        },
    },

    // --- FLUX CONSTALLATION (Utility) ---
    flux: {
         'phase-momentum': {
            id: 'phase-momentum',
            name: 'Phase Momentum',
            description: (rank) => `After not taking damage for 5s, gain ${[5, 10, 15][rank-1] || 0}% bonus speed and move through enemies.`,
            icon: '💨',
            maxRanks: 3,
            costPerRank: [2, 3, 4],
            position: { x: 50, y: 70 },
            prerequisites: ['core-speed', 'core-essence'],
            effects: (state, rank) => { /* To be implemented in game loop */ }
        }
    }
};

// modules/talents.js

/**
 * Defines the entire talent grid structure.
 * Each talent has properties like id, name, description, position, cost, prerequisites, etc.
 */
export const TALENT_GRID_CONFIG = {
    // --- CORE CONSTALLATION (Always Visible) ---
    core: {
        'core-health': {
            id: 'core-health',
            name: 'Vitality Core',
            description: (rank) => `Increases Max Health by ${[15, 15, 20][rank-1] || 0}.`,
            icon: '❤️',
            maxRanks: 3,
            costPerRank: [1, 2, 2],
            position: { x: 50, y: 10 },
            prerequisites: [],
            effects: (state, rank) => { /* Applied in resetGame */ }
        },
        'core-speed': {
            id: 'core-speed',
            name: 'Momentum Drive',
            description: (rank) => `Increases base movement speed by ${[3, 3, 4][rank-1] || 0}%.`,
            icon: '🏃',
            maxRanks: 3,
            costPerRank: [2, 2, 3],
            position: { x: 35, y: 25 },
            prerequisites: ['core-health'],
            effects: (state, rank) => { /* Applied in resetGame */ }
        },
        'core-essence': {
            id: 'core-essence',
            name: 'Essence Collector',
            description: (rank) => `Gain ${[5, 10, 15][rank-1] || 0}% more Essence from all sources.`,
            icon: '💠',
            maxRanks: 3,
            costPerRank: [2, 3, 3],
            position: { x: 65, y: 25 },
            prerequisites: ['core-health'],
            effects: (state, rank) => { /* Applied in resetGame */ }
        },
    },

    // --- AEGIS CONSTALLATION (Defensive) ---
    aegis: {
        'shield-duration': {
            id: 'shield-duration',
            name: 'Extended Field',
            powerPrerequisite: 'shield',
            description: (rank) => `Shield power-up duration +${[0.5, 0.5, 1][rank-1] || 0}s.`,
            icon: '⏱️',
            maxRanks: 3,
            costPerRank: [1, 1, 2],
            position: { x: 20, y: 40 },
            prerequisites: ['core-speed'],
            effects: (state, rank) => { /* Logic to be added to shield power itself */ }
        },
        'shield-mastery-reflect': {
            id: 'shield-mastery-reflect',
            name: 'Mastery: Reflective Barrier',
            powerPrerequisite: 'shield',
            description: () => `When your Shield expires or breaks from damage, it unleashes a Shockwave.`,
            icon: '💥',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 20, y: 55 },
            prerequisites: ['shield-duration'],
            effects: (state, rank) => { /* Logic to be added to shield power itself */ }
        },
    },
    
    // --- HAVOC CONSTALLATION (Offensive) ---
    havoc: {
        'missile-damage': {
            id: 'missile-damage',
            name: 'High-Explosive Warhead',
            powerPrerequisite: 'missile',
            description: (rank) => `Missile power-up base damage +${[2, 3, 5][rank-1] || 0}.`,
            icon: '💣',
            maxRanks: 3,
            costPerRank: [1, 2, 2],
            position: { x: 80, y: 40 },
            prerequisites: ['core-essence'],
            effects: (state, rank) => { /* Logic to be added to missile power itself */ }
        },
         'missile-mastery-cluster': {
            id: 'missile-mastery-cluster',
            name: 'Mastery: Cluster Bomb',
            powerPrerequisite: 'missile',
            description: () => `Missile power-up leaves behind a field of 3 smaller, damaging explosions.`,
            icon: '集群',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 80, y: 55 },
            prerequisites: ['missile-damage'],
            effects: (state, rank) => { /* Logic to be added to missile power itself */ }
        },
    },
};

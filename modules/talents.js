// modules/talents.js
export const TALENT_GRID_CONFIG = {
    core: {
        'core-health': {
            id: 'core-health',
            name: 'Vitality Core',
            description: (rank) => `Increases Max Health by ${[10, 15, 25][rank-1] || 0}.`,
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
            effects: (state, rank) => { state.player.speed *= (1 + [0.02, 0.03, 0.05][rank-1]); }
        },
        'core-essence': {
            id: 'core-essence',
            name: 'Essence Collector',
            description: (rank) => `Gain ${[5, 5, 10][rank-1] || 0}% more Essence.`,
            icon: '💠',
            maxRanks: 3,
            costPerRank: [2, 2, 3],
            position: { x: 60, y: 15 },
            prerequisites: ['core-health'],
            effects: (state, rank) => { state.player.essenceGainModifier += [0.05, 0.05, 0.10][rank-1]; }
        },
    },
    // Other constellations will be added here
};

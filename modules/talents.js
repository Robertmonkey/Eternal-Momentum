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
        },
    },
};

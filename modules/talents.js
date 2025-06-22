// modules/talents.js

export const TALENT_GRID_CONFIG = {
    // --- CORE CONSTALLATION (Always Visible) ---
    core: {
        'core-nexus': {
            id: 'core-nexus',
            name: 'Core Nexus',
            description: () => 'Unlock the primary constellations, allowing for further specialization.',
            icon: '💠',
            maxRanks: 1,
            costPerRank: [1],
            position: { x: 50, y: 10 },
            prerequisites: [],
        },
    },

    // --- AEGIS CONSTALLATION (Defense & Survival) ---
    aegis: {
        'exo-weave-plating': {
            id: 'exo-weave-plating',
            name: 'Exo-Weave Plating',
            description: (rank) => `Increases Max Health by ${[15, 15, 20][rank-1] || 0}.`,
            icon: '❤️',
            maxRanks: 3,
            costPerRank: [1, 1, 2],
            position: { x: 30, y: 30 },
            prerequisites: ['core-nexus'],
        },
        'fleet-footed': {
            id: 'fleet-footed',
            name: 'Fleet Footed',
            description: (rank) => `Increases base movement speed by ${[5, 7][rank-1] || 0}%.`,
            icon: '🏃',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 15, y: 50 },
            prerequisites: ['exo-weave-plating'],
        },
        'aegis-shield': {
            id: 'aegis-shield',
            name: 'Extended Capacitor',
            powerPrerequisite: 'shield',
            description: (rank) => `Shield power-up duration +1.5s.`,
            icon: '⏱️',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 30, y: 50 },
            prerequisites: ['exo-weave-plating'],
        },
        'aegis-retaliation': {
            id: 'aegis-retaliation',
            name: 'Mastery: Aegis Retaliation',
            powerPrerequisite: 'shield',
            description: () => 'When your Shield expires or breaks, it releases a Repulsion wave.',
            icon: '🖐️',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 30, y: 70 },
            prerequisites: ['aegis-shield'],
        },
        'phase-momentum': {
            id: 'phase-momentum',
            name: 'Capstone: Phase Momentum',
            description: () => 'After 8s of not taking damage, gain +10% speed and move through non-boss enemies.',
            icon: '💨',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 15, y: 70 },
            prerequisites: ['fleet-footed', 'aegis-retaliation'],
        }
    },
    
    // --- HAVOC CONSTALLATION (Offense & Destruction) ---
    havoc: {
        'high-frequency-emitters': {
            id: 'high-frequency-emitters',
            name: 'High-Frequency Emitters',
            description: (rank) => `All damage increased by ${[5, 7][rank-1] || 0}%.`,
            icon: '💥',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 70, y: 30 },
            prerequisites: ['core-nexus'],
        },
        'havoc-chain': {
            id: 'havoc-chain',
            name: 'High Voltage',
            powerPrerequisite: 'chain',
            description: () => `Chain Lightning jumps to +1 additional target.`,
            icon: '⚡',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 60, y: 50 },
            prerequisites: ['high-frequency-emitters'],
        },
        'volatile-finish': {
            id: 'volatile-finish',
            name: 'Mastery: Volatile Finish',
            powerPrerequisite: 'chain',
            description: () => 'The final target of Chain Lightning explodes.',
            icon: '💣',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 60, y: 70 },
            prerequisites: ['havoc-chain'],
        },
        'havoc-missile': {
            id: 'havoc-missile',
            name: 'Bigger Boom',
            powerPrerequisite: 'missile',
            description: () => `Missile explosion radius +15%.`,
            icon: '🎯',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 80, y: 50 },
            prerequisites: ['high-frequency-emitters'],
        },
        'seeking-shrapnel': {
            id: 'seeking-shrapnel',
            name: 'Mastery: Seeking Shrapnel',
            powerPrerequisite: 'missile',
            description: () => 'Missile impact releases 3 small, homing projectiles.',
            icon: '🌀',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 80, y: 70 },
            prerequisites: ['havoc-missile'],
        },
    },

    // --- FLUX CONSTALLATION (Utility & Mastery) ---
    flux: {
        // Will be populated in a future step
    }
};

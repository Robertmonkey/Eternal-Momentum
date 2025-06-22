// modules/talents.js

export const TALENT_GRID_CONFIG = {
    // --- CORE CONSTALLATION (Always Visible) ---
    core: {
        'core-nexus': {
            id: 'core-nexus',
            name: 'Core Nexus',
            description: (rank, maxed) => maxed 
                ? 'Unlocks the primary constellations.'
                : 'Unlock the primary constellations, allowing for further specialization.',
            icon: '💠',
            maxRanks: 1,
            costPerRank: [1],
            position: { x: 50, y: 5 }, // Top center
            prerequisites: [],
        },
        'overload-protocol': {
            id: 'overload-protocol',
            name: 'Capstone: Overload Protocol',
            description: () => 'When your inventory is full, picking up a power-up instantly uses it instead of discarding it.',
            icon: '⚛️',
            maxRanks: 1,
            costPerRank: [5],
            position: { x: 50, y: 95 }, // Bottom center
            prerequisites: ['phase-momentum', 'unstable-singularity', 'energetic-recycling'],
        }
    },

    // --- AEGIS CONSTALLATION (Defense & Survival - Left side of the diamond) ---
    aegis: {
        color: 'var(--primary-glow)',
        'exo-weave-plating': {
            id: 'exo-weave-plating',
            name: 'Exo-Weave Plating',
            description: (rank, maxed) => {
                const values = [15, 15, 20];
                const total = values.reduce((a, b) => a + b, 0);
                return maxed
                    ? `Increases Max Health by a total of ${total}.`
                    : `Increases Max Health by ${values[rank-1] || 0}.`;
            },
            icon: '❤️',
            maxRanks: 3,
            costPerRank: [1, 1, 2],
            position: { x: 35, y: 20 },
            prerequisites: ['core-nexus'],
        },
        'aegis-shield': {
            id: 'aegis-shield',
            name: 'Extended Capacitor',
            powerPrerequisite: 'shield',
            description: (rank, maxed) => maxed
                ? 'Shield power-up duration +3s total.'
                : `Shield power-up duration +1.5s per rank.`,
            icon: '⏱️',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 25, y: 35 },
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
            position: { x: 15, y: 50 },
            prerequisites: ['aegis-shield'],
        },
        'fleet-footed': {
            id: 'fleet-footed',
            name: 'Fleet Footed',
            description: (rank, maxed) => maxed
                ? 'Increases base movement speed by a total of 12%.'
                : `Increases base movement speed by ${[5, 7][rank-1] || 0}%.`,
            icon: '🏃',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 35, y: 50 },
            prerequisites: ['aegis-shield'],
        },
        'reactive-plating': {
            id: 'reactive-plating',
            name: 'Reactive Plating',
            description: (rank, maxed) => maxed
                ? 'After taking a single hit of 20+ damage, gain a temporary shield for 3s. (30s Cooldown)'
                : `After taking a single hit of 20+ damage, gain a temporary shield for ${[1, 2, 3][rank-1] || 0}s. (30s Cooldown)`,
            icon: '🛡️',
            maxRanks: 3,
            costPerRank: [2, 2, 3],
            position: { x: 25, y: 65 },
            prerequisites: ['aegis-retaliation', 'fleet-footed'],
        },
        'phase-momentum': {
            id: 'phase-momentum',
            name: 'Capstone: Phase Momentum',
            description: () => 'After avoiding damage for 8s, gain +10% speed & move through non-boss enemies.',
            icon: '👻',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 35, y: 80 },
            prerequisites: ['reactive-plating', 'power-scavenger'], // Interwoven prerequisite
        }
    },
    
    // --- HAVOC CONSTALLATION (Offense & Destruction - Right side of the diamond) ---
    havoc: {
        color: '#ff8800',
        'high-frequency-emitters': {
            id: 'high-frequency-emitters',
            name: 'High-Frequency Emitters',
            description: (rank, maxed) => maxed
                ? 'All damage increased by a total of 12%.'
                : `All damage increased by ${[5, 7][rank-1] || 0}%.`,
            icon: '💥',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 65, y: 20 },
            prerequisites: ['core-nexus'],
        },
        'havoc-chain': {
            id: 'havoc-chain',
            name: 'High Voltage',
            powerPrerequisite: 'chain',
            description: (rank, maxed) => maxed
                ? 'Chain Lightning jumps to +2 additional targets.'
                : `Chain Lightning jumps to +1 additional target per rank.`,
            icon: '⚡',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 75, y: 35 },
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
            position: { x: 85, y: 50 },
            prerequisites: ['havoc-chain'],
        },
        'havoc-berserk': {
            id: 'havoc-berserk',
            name: 'Unstoppable Rage',
            powerPrerequisite: 'berserk',
            description: () => `While Berserk, you are immune to stuns and slows.`,
            icon: '💢',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 65, y: 50 },
            prerequisites: ['havoc-chain'],
        },
        'targeting-algorithm': {
            id: 'targeting-algorithm',
            name: 'Targeting Algorithm',
            powerPrerequisite: 'orbitalStrike',
            description: () => `Orbital Strike targeting indicators will now follow their targets.`,
            icon: '☄️',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 75, y: 65 },
            prerequisites: ['volatile-finish', 'havoc-berserk'],
        },
        'unstable-singularity': {
            id: 'unstable-singularity',
            name: 'Capstone: Unstable Singularity',
            powerPrerequisite: 'black_hole',
            description: () => 'Enemies are damaged when pulled into the Black Hole. Explodes on expiry.',
            icon: '⚫',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 65, y: 80 },
            prerequisites: ['targeting-algorithm', 'temporal-collapse'], // Interwoven prerequisite
        },
    },

    // --- FLUX CONSTALLATION (Utility & Mastery - Center path of the diamond) ---
    flux: {
        color: 'var(--secondary-glow)',
        'essence-conduit': {
            id: 'essence-conduit',
            name: 'Essence Conduit',
            description: (rank, maxed) => maxed
                ? 'Gain 25% more Essence (XP).'
                : `Gain ${[10, 15][rank-1] || 0}% more Essence (XP).`,
            icon: '💰',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 50, y: 25 },
            prerequisites: ['core-nexus'],
        },
        'resonance-magnet': {
            id: 'resonance-magnet',
            name: 'Resonance Magnet',
            description: (rank, maxed) => maxed
                ? 'Increases pickup radius by a total of 150px.'
                : `Increases pickup radius by 75px per rank.`,
            icon: '🧲',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 50, y: 40 },
            prerequisites: ['essence-conduit'],
        },
        'power-scavenger': {
            id: 'power-scavenger',
            name: 'Power Scavenger',
            description: (rank, maxed) => maxed
                ? 'Non-boss enemies have a 2.5% chance to drop Score power-ups.'
                : `Non-boss enemies have a ${[1, 1.5][rank-1] || 0}% chance to drop Score power-ups.`,
            icon: '💎',
            maxRanks: 2,
            costPerRank: [2, 2],
            position: { x: 40, y: 55 },
            prerequisites: ['resonance-magnet'],
        },
        'temporal-collapse': {
            id: 'temporal-collapse',
            name: 'Mastery: Temporal Collapse',
            powerPrerequisite: 'decoy',
            description: () => `When the Decoy expires, it collapses, creating a temporary field that dramatically slows enemies.`,
            icon: '🕸️',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 60, y: 55 },
            prerequisites: ['resonance-magnet'],
        },
        'temporal-anomaly': {
            id: 'temporal-anomaly',
            name: 'Temporal Anomaly',
            description: (rank, maxed) => maxed
                ? 'Power-ups on the ground last 50% longer.'
                : `Power-ups on the ground last ${[25, 50][rank-1] || 0}% longer.`,
            icon: '⏳',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 50, y: 70 },
            prerequisites: ['power-scavenger', 'temporal-collapse'],
        },
         'energetic-recycling': {
            id: 'energetic-recycling',
            name: 'Capstone: Energetic Recycling',
            description: () => `Using a power-up has a 20% chance that it is not consumed.`,
            icon: '♻️',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 50, y: 85 },
            prerequisites: ['temporal-anomaly'],
        },
    }
};

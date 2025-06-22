// modules/talents.js

export const TALENT_GRID_CONFIG = {
    // --- CORE CONSTALLATION (Always Visible) ---
    core: {
        'core-nexus': {
            id: 'core-nexus',
            name: 'Core Nexus',
            description: (rank, maxed) => 'The heart of the Ascension Conduit. Unlocks the primary constellations.',
            icon: '💠',
            maxRanks: 1,
            costPerRank: [1],
            position: { x: 50, y: 5 },
            prerequisites: [],
            isNexus: true,
        },
        'overload-protocol': {
            id: 'overload-protocol',
            name: 'Capstone: Overload Protocol',
            description: () => 'When your inventory is full, picking up a power-up instantly uses it instead of discarding it.',
            icon: '⚛️',
            maxRanks: 1,
            costPerRank: [50],
            position: { x: 50, y: 95 },
            prerequisites: ['phase-momentum', 'unstable-singularity', 'energetic-recycling'],
            isNexus: true,
        }
    },

    // --- AEGIS CONSTALLATION (Defense & Survival) ---
    aegis: {
        color: 'var(--primary-glow)',
        'exo-weave-plating': {
            id: 'exo-weave-plating',
            name: 'Exo-Weave Plating',
            description: (rank, maxed) => maxed
                ? 'Increases Max Health by a total of 60.'
                : `Increases Max Health by ${[15, 20, 25][rank-1] || 0}.`,
            icon: '❤️',
            maxRanks: 3,
            costPerRank: [1, 2, 2],
            position: { x: 30, y: 25 },
            prerequisites: ['core-nexus'],
        },
        'aegis-shield': {
            id: 'aegis-shield',
            name: 'Extended Capacitor',
            powerPrerequisite: 'shield',
            description: (rank, maxed) => maxed
                ? 'Shield power-up duration is increased by a total of 3 seconds.'
                : `Increases Shield power-up duration by 1.5s.`,
            icon: '⏱️',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 20, y: 40 },
            prerequisites: ['exo-weave-plating'],
        },
        'fleet-footed': {
            id: 'fleet-footed',
            name: 'Fleet Footed',
            description: (rank, maxed) => maxed
                ? 'Base movement speed is increased by a total of 12%.'
                : `Increases base movement speed by 6%.`,
            icon: '🏃',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 40, y: 45 },
            prerequisites: ['exo-weave-plating'],
        },
        'aegis-retaliation': {
            id: 'aegis-retaliation',
            name: 'Mastery: Aegis Retaliation',
            powerPrerequisite: 'shield',
            description: () => 'When your Shield expires or breaks, it releases a Repulsion wave.',
            icon: '💥',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 10, y: 55 },
            prerequisites: ['aegis-shield'],
        },
        'kinetic-overload': {
            id: 'kinetic-overload',
            name: 'Kinetic Overload',
            powerPrerequisite: 'repulsion',
            description: () => 'Enemies hit by your Repulsion power are knocked back for 2 seconds.',
            icon: '✋',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 30, y: 60 },
            prerequisites: ['fleet-footed'],
        },
        'contingency-protocol': {
            id: 'contingency-protocol',
            name: 'Contingency Protocol',
            description: () => 'Once per stage, taking fatal damage instead sets your Health to 1 and grants 3s of invulnerability.',
            icon: '💪',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 5, y: 75 },
            prerequisites: ['aegis-retaliation'],
        },
        'phase-momentum': {
            id: 'phase-momentum',
            name: 'Capstone: Phase Momentum',
            description: () => 'After avoiding damage for 8s, gain +10% speed & move through non-boss enemies.',
            icon: '👻',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 30, y: 80 },
            prerequisites: ['kinetic-overload'],
        }
    },
    
    // --- HAVOC CONSTALLATION (Offense & Destruction) ---
    havoc: {
        color: '#ff8800',
        'high-frequency-emitters': {
            id: 'high-frequency-emitters',
            name: 'High-Frequency Emitters',
            description: (rank, maxed) => maxed
                ? 'All damage is increased by a total of 12%.'
                : `Increases all damage by ${[5, 7][rank-1] || 0}%.`,
            icon: '📈',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 70, y: 25 },
            prerequisites: ['core-nexus'],
        },
        'targeting-algorithm': {
            id: 'targeting-algorithm',
            name: 'Targeting Algorithm',
            powerPrerequisite: 'orbitalStrike',
            description: () => `Orbital Strike targeting indicators will now follow their targets.`,
            icon: '☄️',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 60, y: 40 },
            prerequisites: ['high-frequency-emitters'],
        },
        'unstable-payload': {
            id: 'unstable-payload',
            name: 'Unstable Payload',
            powerPrerequisite: 'ricochetShot',
            description: () => 'Your Ricochet Shot becomes increasingly unstable with each bounce, growing in size and power.',
            icon: '🔄',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 80, y: 45 },
            prerequisites: ['high-frequency-emitters'],
        },
        'havoc-chain': {
            id: 'havoc-chain',
            name: 'High Voltage',
            powerPrerequisite: 'chain',
            description: (rank, maxed) => maxed
                ? 'Chain Lightning jumps to 2 additional targets.'
                : `Chain Lightning jumps to 1 additional target.`,
            icon: '⚡',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 55, y: 58 },
            prerequisites: ['targeting-algorithm'],
        },
        'volatile-finish': {
            id: 'volatile-finish',
            name: 'Mastery: Volatile Finish',
            powerPrerequisite: 'chain',
            description: () => 'The final target of Chain Lightning explodes.',
            icon: '💣',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 55, y: 75 }, // New Position for a clear branch
            prerequisites: ['havoc-chain'],
        },
        'nova-pulsar': {
            id: 'nova-pulsar',
            name: 'Nova Pulsar',
            powerPrerequisite: 'bulletNova',
            description: () => 'Your Bullet Nova power now fires three simultaneous spirals of projectiles, tripling its density.',
            icon: '💫',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 90, y: 60 },
            prerequisites: ['unstable-payload'],
        },
        'overcharged-capacitors': {
            id: 'overcharged-capacitors',
            name: 'Overcharged Capacitors',
            description: () => 'Increases all damage dealt by 15%, but also increases all damage received by 15%.',
            icon: '⚠️',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 70, y: 65 },
            prerequisites: ['havoc-chain', 'unstable-payload'],
        },
        'unstable-singularity': {
            id: 'unstable-singularity',
            name: 'Capstone: Unstable Singularity',
            powerPrerequisite: 'black_hole',
            description: () => 'Enemies are damaged when pulled into the Black Hole. Explodes on expiry.',
            icon: '⚫',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 80, y: 80 },
            prerequisites: ['nova-pulsar', 'overcharged-capacitors'],
        },
    },

    // --- FLUX CONSTALLATION (Utility & Mastery) ---
    flux: {
        color: 'var(--secondary-glow)',
        'essence-conduit': {
            id: 'essence-conduit',
            name: 'Essence Conduit',
            description: (rank, maxed) => maxed
                ? 'Gain 25% more Essence from all sources.'
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
                : `Increases pickup radius by 75px.`,
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
                ? 'Non-boss enemies have a 2.5% chance to drop an Essence Crystal.'
                : `Non-boss enemies have a ${[1, 1.5][rank-1] || 0}% chance to drop an Essence Crystal.`,
            icon: '💎',
            maxRanks: 2,
            costPerRank: [2, 2],
            position: { x: 40, y: 55 },
            prerequisites: ['resonance-magnet'],
        },
        'quantum-duplicate': {
            id: 'quantum-duplicate',
            name: 'Quantum Duplicate',
            powerPrerequisite: 'decoy',
            description: () => `Project a fleeting duplicate of yourself from a parallel timeline. This Quantum Duplicate actively moves away from your position, drawing enemy aggression.`,
            icon: '👥',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 60, y: 55 },
            prerequisites: ['resonance-magnet'],
        },
        'temporal-collapse': {
            id: 'temporal-collapse',
            name: 'Mastery: Temporal Collapse',
            powerPrerequisite: 'gravity',
            description: () => 'The Gravity Well power-up now collapses into a lingering field that slows enemies.',
            icon: '🌪️',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 65, y: 70 },
            prerequisites: ['quantum-duplicate'],
        },
        'preordinance': {
            id: 'preordinance',
            name: 'Preordinance',
            description: () => 'The first power-up you use each stage is duplicated, as if affected by the "Stack" power-up.',
            icon: '🎲',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 35, y: 70 },
            prerequisites: ['power-scavenger'],
        },
        'energetic-recycling': {
            id: 'energetic-recycling',
            name: 'Capstone: Energetic Recycling',
            description: () => `Using a power-up has a 20% chance that it is not consumed.`,
            icon: '♻️',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 50, y: 85 },
            prerequisites: ['preordinance', 'temporal-collapse'],
        },
    }
};

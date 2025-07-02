// modules/talents.js

export const TALENT_GRID_CONFIG = {
    // --- CORE CONSTALLATION ---
    core: {
        'core-nexus': {
            id: 'core-nexus',
            name: 'Core Nexus',
            description: (rank, maxed) => 'The heart of the Ascension Conduit. Unlocks the primary constellations.',
            icon: '💠',
            maxRanks: 1,
            costPerRank: [1],
            position: { x: 50, y: 0 }, // SHIFTED
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
            position: { x: 50, y: 88 }, // SHIFTED
            prerequisites: ['phase-momentum', 'unstable-singularity', 'energetic-recycling'],
            isNexus: true,
        },
        'core-reinforcement': {
            id: 'core-reinforcement',
            name: 'Core Reinforcement',
            description: (rank) => `Permanently reinforce your core structure, increasing Max Health by 5. Current Bonus: +${(rank - 1) * 5} Health.`,
            icon: '✚',
            maxRanks: 9999,
            costPerRank: [5],
            position: { x: 40, y: 100 }, // Positioned below capstone
            prerequisites: ['overload-protocol'],
            isInfinite: true,
        },
        'momentum-drive': {
            id: 'momentum-drive',
            name: 'Momentum Drive',
            description: (rank) => `Permanently harmonize with the temporal flux, increasing Movement Speed by 1%. Current Bonus: +${rank - 1}% Speed.`,
            icon: '💨',
            maxRanks: 9999,
            costPerRank: [5],
            position: { x: 50, y: 100 }, // Positioned below capstone
            prerequisites: ['overload-protocol'],
            isInfinite: true,
        },
        'weapon-calibration': {
            id: 'weapon-calibration',
            name: 'Weapon Calibration',
            description: (rank) => `Permanently overcharge your weapon systems, increasing all Damage by 1%. Current Bonus: +${rank - 1}% Damage.`,
            icon: '🔥',
            maxRanks: 9999,
            costPerRank: [5],
            position: { x: 60, y: 100 }, // Positioned below capstone
            prerequisites: ['overload-protocol'],
            isInfinite: true,
        },
    },

    // --- AEGIS CONSTALLATION ---
    aegis: {
        color: 'var(--primary-glow)',
        'exo-weave-plating': {
            id: 'exo-weave-plating',
            name: 'Exo-Weave Plating',
            description: (rank, maxed) => `Increases Max Health by a total of ${rank === 1 ? 15 : (rank === 2 ? 35 : 60)}.`,
            icon: '❤️',
            maxRanks: 3,
            costPerRank: [1, 2, 2],
            position: { x: 30, y: 20 }, // SHIFTED
            prerequisites: ['core-nexus'],
        },
        'solar-wind': {
            id: 'solar-wind',
            name: 'Solar Wind',
            description: (rank, maxed) => `Increases base movement speed by ${maxed ? '12%' : '6%'}.`,
            icon: '🏃',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 45, y: 35 }, // SHIFTED
            prerequisites: ['exo-weave-plating'],
        },
        'aegis-shield': {
            id: 'aegis-shield',
            name: 'Extended Capacitor',
            powerPrerequisite: 'shield',
            description: (rank, maxed) => `Increases Shield power-up duration by ${maxed ? '3s' : '1.5s'}.`,
            icon: '🔋',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 15, y: 35 }, // SHIFTED
            prerequisites: ['exo-weave-plating'],
        },
        'kinetic-overload': {
            id: 'kinetic-overload',
            name: 'Kinetic Overload',
            powerPrerequisite: 'repulsion',
            description: () => 'Activating the Repulsion Field now causes a massive initial blast, sending non-boss enemies into uncontrollable flight.',
            icon: '🖐️',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 45, y: 55 }, // SHIFTED
            prerequisites: ['solar-wind'],
        },
        'aegis-retaliation': {
            id: 'aegis-retaliation',
            name: 'Aegis Retaliation',
            powerPrerequisite: 'shield',
            description: () => 'When your Shield breaks from damage or expires, it releases a defensive shockwave that pushes enemies away.',
            icon: '💥',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 15, y: 55 }, // SHIFTED
            prerequisites: ['aegis-shield'],
        },
        'cryo-shatter': {
            id: 'cryo-shatter',
            name: 'Cryo-Shatter',
            powerPrerequisite: 'freeze',
            description: (rank, maxed) => `Enemies defeated while Frozen have a ${maxed ? '50%' : '25%'} chance to shatter, damaging nearby enemies.`,
            icon: '❄️',
            maxRanks: 2,
            costPerRank: [2, 3],
            position: { x: 30, y: 60 }, // SHIFTED
            prerequisites: ['aegis-retaliation', 'solar-wind'], 
        },
        'phase-momentum': {
            id: 'phase-momentum',
            name: 'Capstone: Phase Momentum',
            description: () => 'After avoiding damage for 8s, gain +10% speed & move through non-boss enemies.',
            icon: '👻',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 30, y: 78 }, // SHIFTED
            prerequisites: ['kinetic-overload', 'cryo-shatter'],
        }
    },
    
    // --- HAVOC CONSTALLATION ---
    havoc: {
        color: '#ff8800',
        'high-frequency-emitters': {
            id: 'high-frequency-emitters',
            name: 'High-Frequency Emitters',
            description: (rank, maxed) => `Increases all damage by ${maxed ? '12%' : '5%'}.`,
            icon: '📈',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 70, y: 20 }, // SHIFTED
            prerequisites: ['core-nexus'],
        },
        'stellar-detonation': {
            id: 'stellar-detonation',
            name: 'Stellar Detonation',
            powerPrerequisite: 'missile',
            description: (rank, maxed) => `Increases the explosion radius of the Missile power by ${maxed ? '30%' : '15%'}.`,
            icon: '💥',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 60, y: 35 }, // SHIFTED
            prerequisites: ['high-frequency-emitters'],
        },
        'homing-shrapnel': {
            id: 'homing-shrapnel',
            name: 'Homing Shrapnel',
            powerPrerequisite: 'missile',
            description: () => 'Your Missile power now releases a volley of seeking shrapnel upon impact.',
            icon: '🧭',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 55, y: 50 }, // SHIFTED
            prerequisites: ['stellar-detonation'],
        },
        'targeting-algorithm': {
            id: 'targeting-algorithm',
            name: 'Targeting Algorithm',
            powerPrerequisite: 'orbitalStrike',
            description: () => 'The Orbital Strike power now locks on to and tracks its target.',
            icon: '🛰️',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 80, y: 35 }, // SHIFTED
            prerequisites: ['high-frequency-emitters'],
        },
        'unstable-payload': {
            id: 'unstable-payload',
            name: 'Unstable Payload',
            powerPrerequisite: 'ricochetShot',
            description: () => 'Ricochet Shot projectiles grow larger and more damaging with each bounce.',
            icon: '🔄',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 85, y: 50 }, // SHIFTED
            prerequisites: ['targeting-algorithm'],
        },
        'arc-cascade': {
            id: 'arc-cascade',
            name: 'Arc Cascade',
            powerPrerequisite: 'chain',
            description: (rank, maxed) => `Chain Lightning jumps to ${maxed ? '2' : '1'} additional targets.`,
            icon: '⛓️',
            maxRanks: 2,
            costPerRank: [2, 2],
            position: { x: 70, y: 60 }, // SHIFTED
            prerequisites: ['homing-shrapnel', 'unstable-payload'],
        },
        'volatile-finish': {
            id: 'volatile-finish',
            name: 'Volatile Finish',
            powerPrerequisite: 'chain',
            description: () => 'The final target of Chain Lightning erupts in a damaging explosion.',
            icon: '💣',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 65, y: 73 }, // SHIFTED
            prerequisites: ['arc-cascade'],
        },
        'unstoppable-frenzy': {
            id: 'unstoppable-frenzy',
            name: 'Unstoppable Frenzy',
            powerPrerequisite: 'berserk',
            description: () => 'While Berserk is active, you are immune to all Slow and Stun effects.',
            icon: '💢',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 90, y: 15 }, // SHIFTED
            prerequisites: ['high-frequency-emitters'],
        },
        'nova-pulsar': {
            id: 'nova-pulsar',
            name: 'Nova Pulsar',
            powerPrerequisite: 'bulletNova',
            description: () => 'The Bullet Nova power now fires three spiraling waves instead of one.',
            icon: '💫',
            maxRanks: 1,
            costPerRank: [3],
            position: { x: 95, y: 40 }, // SHIFTED
            prerequisites: ['unstoppable-frenzy', 'targeting-algorithm'],
        },
        'unstable-singularity': {
            id: 'unstable-singularity',
            name: 'Capstone: Unstable Singularity',
            powerPrerequisite: 'black_hole',
            description: () => 'Enemies are damaged when pulled into the Black Hole. The singularity explodes upon expiry.',
            icon: '⚫',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 80, y: 78 }, // SHIFTED
            prerequisites: ['volatile-finish', 'nova-pulsar'],
        },
    },

    // --- FLUX CONSTALLATION ---
    flux: {
        color: 'var(--secondary-glow)',
        'essence-conduit': {
            id: 'essence-conduit',
            name: 'Essence Conduit',
            description: (rank, maxed) => `Gain ${maxed ? '25%' : '10%'} more Essence from all sources.`,
            icon: '💰',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 50, y: 20 }, // SHIFTED
            prerequisites: ['core-nexus'],
        },
        'resonance-magnet': {
            id: 'resonance-magnet',
            name: 'Resonance Magnet',
            description: (rank, maxed) => `Increases power-up pickup radius by ${maxed ? '150px' : '75px'}.`,
            icon: '🧲',
            maxRanks: 2,
            costPerRank: [1, 1],
            position: { x: 50, y: 35 }, // SHIFTED
            prerequisites: ['essence-conduit'],
        },
        'temporal-anomaly': {
            id: 'temporal-anomaly',
            name: 'Temporal Anomaly',
            description: (rank, maxed) => `Power-ups decay ${maxed ? '50%' : '25%'} slower, remaining on the field longer.`,
            icon: '⏳',
            maxRanks: 2,
            costPerRank: [1, 2],
            position: { x: 38, y: 50 }, // SHIFTED
            prerequisites: ['resonance-magnet'],
        },
        'preordinance': {
            id: 'preordinance',
            name: 'Preordinance',
            description: () => 'The first power-up you use each stage is duplicated, as if affected by the "Stack" power-up.',
            icon: '🎲',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 42, y: 63 }, // SHIFTED
            prerequisites: ['temporal-anomaly'],
        },
        'power-scavenger': {
            id: 'power-scavenger',
            name: 'Power Scavenger',
            description: (rank, maxed) => `Non-boss enemies have a ${maxed ? '2.5%' : '1%'} chance to drop a valuable Essence pickup on death.`,
            icon: '💎',
            maxRanks: 2,
            costPerRank: [2, 2],
            position: { x: 62, y: 50 }, // SHIFTED
            prerequisites: ['resonance-magnet'],
        },
        'quantum-duplicate': {
            id: 'quantum-duplicate',
            name: 'Quantum Duplicate',
            powerPrerequisite: 'decoy',
            description: () => `Your Decoy now actively moves away from your position, drawing enemy aggression more effectively.`,
            icon: '👥',
            maxRanks: 1,
            costPerRank: [2],
            position: { x: 58, y: 63 }, // SHIFTED
            prerequisites: ['power-scavenger'],
        },
        'energetic-recycling': {
            id: 'energetic-recycling',
            name: 'Capstone: Energetic Recycling',
            description: () => `Using a power-up has a 20% chance that it is not consumed.`,
            icon: '♻️',
            maxRanks: 1,
            costPerRank: [4],
            position: { x: 50, y: 78 }, // SHIFTED
            prerequisites: ['preordinance', 'quantum-duplicate'],
        },
    }
};

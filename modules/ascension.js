// modules/ascension.js
import { state } from './state.js';
import { TALENT_GRID_CONFIG } from './talents.js';

const gridContainer = document.querySelector("#ascensionGridModal .ascension-content");

export function renderAscensionGrid() {
    if (!gridContainer) return;
    // For now, we'll just show the placeholder text since the grid isn't functional yet.
    // In the future, this function will draw all the nodes.
    gridContainer.innerHTML = '<p style="text-align: center; margin-top: 50px; font-size: 1.2rem;">Feature coming soon!</p>';
}

// The functions to purchase and handle talents will go here later.

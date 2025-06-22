// modules/ascension.js

export function renderAscensionGrid() {
    const gridContainer = document.querySelector("#ascensionGridModal .ascension-content");
    if (!gridContainer) return;
    gridContainer.innerHTML = '<p style="text-align: center; margin-top: 50px; font-size: 1.2rem;">Feature coming soon!</p>';
}

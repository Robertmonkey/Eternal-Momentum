// main.js
import { state, resetGame } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect } from './modules/ui.js';
import { gameTick, spawnEnemy, spawnPickup, addStatusEffect } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';

// --- DOM & Canvas Setup ---
const canvas = document.getElementById("gameCanvas");
const soundBtn = document.getElementById("soundToggle");
const restartBtn = document.getElementById("restartBtn");
const arenaBtn = document.getElementById("arenaBtn");
const levelSelectBtn = document.getElementById("levelSelectBtn");
const levelSelectModal = document.getElementById("levelSelectModal");
const closeModalBtn = document.getElementById("closeModalBtn");

let mx = 0, my = 0;
const allAudioElements = Array.from(document.querySelectorAll('audio'));
const music = document.getElementById("bgMusic");

// --- INITIALIZATION ---
function setup() {
    mx = canvas.width / 2;
    my = canvas.height / 2;
    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    window.addEventListener("resize", resize);
    resize();

    AudioManager.setup(allAudioElements, music, soundBtn);
    setupEventListeners();
}

// --- Event Listeners ---
function setupEventListeners() {
    function setPlayerTarget(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX ?? e.touches[0].clientX;
        const clientY = e.clientY ?? e.touches[0].clientY;
        mx = clientX - rect.left;
        my = clientY - rect.top;
    }
    
    canvas.addEventListener("mousemove", setPlayerTarget);
    canvas.addEventListener("touchmove", e => { e.preventDefault(); setPlayerTarget(e); }, { passive: false });
    canvas.addEventListener("touchstart", e => { e.preventDefault(); setPlayerTarget(e); }, { passive: false });

    // This object bundles game functions for powers to use
    const gameHelpers = { addStatusEffect };

    // Correctly pass dependencies to usePower
    const useOffensivePower = () => { if (state.offensiveInventory[0]) usePower('offensive', utils, gameHelpers, mx, my); };
    const useDefensivePower = () => { if (state.defensiveInventory[0]) usePower('defensive', utils, gameHelpers, mx, my); };

    canvas.addEventListener("click", e => { if (e.target.id === 'gameCanvas') useOffensivePower(); });
    canvas.addEventListener("contextmenu", e => { e.preventDefault(); useDefensivePower(); });
    document.getElementById('slot-off-0').addEventListener('click', useOffensivePower);
    document.getElementById('slot-def-0').addEventListener('click', useDefensivePower);

    soundBtn.addEventListener("click", () => AudioManager.toggleMute());
    document.body.addEventListener("click", () => AudioManager.unlockAudio(), { once: true });
    document.body.addEventListener("touchstart", () => AudioManager.unlockAudio(), { once: true });

    restartBtn.addEventListener("click", () => startNewGame(false));
    arenaBtn.addEventListener("click", () => startNewGame(true));
    levelSelectBtn.addEventListener("click", () => { state.isPaused = true; levelSelectModal.style.display = 'flex'; });
    closeModalBtn.addEventListener("click", () => { state.isPaused = false; levelSelectModal.style.display = 'none'; });
}

// --- Game Flow ---
function loop() {
    if (!gameTick(mx, my)) {
        if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
        return;
    }
    if (!state.isPaused) {
        if (!state.bossActive && !state.arenaMode && Date.now() > state.bossSpawnCooldownEnd) {
            spawnEnemy(true);
            state.bossSpawnCooldownEnd = Date.now() + 5000;
        }
        if (Math.random() < (0.007 + state.player.level * 0.001)) spawnEnemy(false);
        if (Math.random() < (0.02 + state.player.level * 0.0002)) spawnPickup();
    }
    state.gameLoopId = requestAnimationFrame(loop);
}

function arenaLoop() {
    if (!gameTick(mx, my)) {
        if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
        return;
    }
    if (!state.isPaused) {
        const spawnInterval = Math.max(1000, 8000 * Math.pow(0.95, state.wave));
        if (Date.now() - state.lastArenaSpawn > spawnInterval) {
            state.lastArenaSpawn = Date.now();
            state.wave++;
            spawnEnemy(true);
        }
        if (Math.random() < 0.02) {
            spawnPickup();
        }
    }
    state.gameLoopId = requestAnimationFrame(arenaLoop);
}

const startNewGame = (isArena) => {
    if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
    resetGame(isArena);
    state.isPaused = false;
    levelSelectModal.style.display = 'none';
    if (isArena) { arenaLoop(); } else { loop(); }
};

const startSpecificLevel = (levelNum) => {
    startNewGame(false);
    state.player.level = levelNum;
    for (let i = 2; i <= levelNum; i++) {
        handleThematicUnlock(i);
    }
    state.enemies = [];
    spawnEnemy(true);
    updateUI();
};

// --- START THE GAME ---
setup();
populateLevelSelect(bossData, startSpecificLevel);
startNewGame(false);
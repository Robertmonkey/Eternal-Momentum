// main.js
import { state, resetGame } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect } from './modules/ui.js';
import { gameTick, spawnEnemy, spawnPickup, addStatusEffect, handleThematicUnlock } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';

window.addEventListener('DOMContentLoaded', (event) => {
    
    // --- DOM & Canvas Setup ---
    const canvas = document.getElementById("gameCanvas");
    const soundBtn = document.getElementById("soundToggle");
    const ascensionBtn = document.getElementById("ascensionBtn");
    const levelSelectBtn = document.getElementById("levelSelectBtn");
    
    const levelSelectModal = document.getElementById("levelSelectModal");
    const closeLevelSelectBtn = document.getElementById("closeLevelSelectBtn");
    const arenaBtn = document.getElementById("arenaBtn");
    const ascensionGridModal = document.getElementById("ascensionGridModal");
    const closeAscensionBtn = document.getElementById("closeAscensionBtn");
    const apDisplayAscGrid = document.getElementById("ap-total-asc-grid");

    let mx = 0, my = 0;
    const allAudioElements = Array.from(document.querySelectorAll('audio'));
    const music = document.getElementById("bgMusic");

    function setup() { /* ... same as before ... */ }
    function setupEventListeners() { /* ... same as before ... */ }

    // --- Game Flow ---
    function loop() {
        if (!gameTick(mx, my)) {
            if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            return;
        }
        if (!state.isPaused) {
            // CORRECTED: Boss spawning is now simple and robust
            if (!state.bossActive && !state.arenaMode && Date.now() > state.bossSpawnCooldownEnd) {
                spawnEnemy(true);
                // Prevent it from trying to spawn again until the next boss is defeated
                state.bossSpawnCooldownEnd = Infinity; 
            }

            // Regular enemy and pickup spawning
            if (state.bossActive && Math.random() < (0.007 + state.player.level * 0.001)) spawnEnemy(false);
            if (Math.random() < (0.02 + state.player.level * 0.0002)) spawnPickup();
        }
        state.gameLoopId = requestAnimationFrame(loop);
    }

    function arenaLoop() { /* ... same as before ... */ }

    const startNewGame = (isArena) => {
        if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
        resetGame(isArena);
        state.isPaused = false;
        levelSelectModal.style.display = 'none';
        if (isArena) { arenaLoop(); } else { loop(); }
    };

    const startSpecificLevel = (levelNum) => {
        startNewGame(false);
        // CORRECTED: Set the stage and grant appropriate unlocks
        state.currentStage = levelNum;
        for (let i = 2; i <= levelNum; i++) {
            handleThematicUnlock(i);
        }
        state.enemies = [];
        spawnEnemy(true); // This will now spawn the boss for the correct stage
        state.bossSpawnCooldownEnd = Infinity;
        updateUI();
    };

    // --- START THE GAME ---
    // setup(); // setupEventListeners is called inside setup
    function initialize() {
        mx = canvas.width / 2;
        my = canvas.height / 2;
        function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
        window.addEventListener("resize", resize);
        resize();

        AudioManager.setup(allAudioElements, music, soundBtn);
        
        function setPlayerTarget(e) { /* ... */ }
        canvas.addEventListener("mousemove", setPlayerTarget);
        // ... other listeners ...
        soundBtn.addEventListener("click", () => AudioManager.toggleMute());
        levelSelectBtn.addEventListener("click", () => { state.isPaused = true; levelSelectModal.style.display = 'flex'; });
        closeLevelSelectBtn.addEventListener("click", () => { state.isPaused = false; levelSelectModal.style.display = 'none'; });
        ascensionBtn.addEventListener("click", () => { state.isPaused = true; apDisplayAscGrid.innerText = state.player.ascensionPoints; ascensionGridModal.style.display = 'flex'; });
        closeAscensionBtn.addEventListener("click", () => { state.isPaused = false; ascensionGridModal.style.display = 'none'; });
        arenaBtn.addEventListener("click", () => startNewGame(true));
        // ... click/touch listeners for powers ...
        const gameHelpers = { addStatusEffect };
        const useOffensivePower = () => { if (state.offensiveInventory[0]) usePower('offensive', utils, gameHelpers, mx, my); };
        canvas.addEventListener("click", e => { if (e.target.id === 'gameCanvas') useOffensivePower(); });
    }
    initialize();
    populateLevelSelect(bossData, startSpecificLevel);
    startNewGame(false);
});

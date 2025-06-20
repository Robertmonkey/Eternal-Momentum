// main.js
import { state, resetGame } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect } from './modules/ui.js';
import { gameTick, spawnEnemy, spawnPickup, addStatusEffect } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';

// --- Wrap all execution in DOMContentLoaded listener ---
window.addEventListener('DOMContentLoaded', (event) => {
    
    // --- DOM & Canvas Setup ---
    const canvas = document.getElementById("gameCanvas");
    const soundBtn = document.getElementById("soundToggle");
    const ascensionBtn = document.getElementById("ascensionBtn");
    const levelSelectBtn = document.getElementById("levelSelectBtn");
    
    // Modals and their controls
    const levelSelectModal = document.getElementById("levelSelectModal");
    const closeLevelSelectBtn = document.getElementById("closeLevelSelectBtn");
    const arenaBtn = document.getElementById("arenaBtn");
    const ascensionGridModal = document.getElementById("ascensionGridModal");
    const closeAscensionBtn = document.getElementById("closeAscensionBtn");
    const apDisplayAscGrid = document.getElementById("ap-total-asc-grid");


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

        const gameHelpers = { addStatusEffect };

        const useOffensivePower = () => { if (state.offensiveInventory[0]) usePower('offensive', utils, gameHelpers, mx, my); };
        const useDefensivePower = () => { if (state.defensiveInventory[0]) usePower('defensive', utils, gameHelpers, mx, my); };

        canvas.addEventListener("click", e => { if (e.target.id === 'gameCanvas') useOffensivePower(); });
        canvas.addEventListener("contextmenu", e => { e.preventDefault(); useDefensivePower(); });
        document.getElementById('slot-off-0').addEventListener('click', useOffensivePower);
        document.getElementById('slot-def-0').addEventListener('click', useDefensivePower);

        soundBtn.addEventListener("click", () => AudioManager.toggleMute());
        document.body.addEventListener("click", () => AudioManager.unlockAudio(), { once: true });
        document.body.addEventListener("touchstart", () => AudioManager.unlockAudio(), { once: true });

        // Modal Listeners
        levelSelectBtn.addEventListener("click", () => { 
            state.isPaused = true; 
            levelSelectModal.style.display = 'flex'; 
        });
        closeLevelSelectBtn.addEventListener("click", () => { 
            state.isPaused = false; 
            levelSelectModal.style.display = 'none'; 
        });
        
        ascensionBtn.addEventListener("click", () => {
            state.isPaused = true;
            apDisplayAscGrid.innerText = state.player.ascensionPoints; // Update AP display when opening
            ascensionGridModal.style.display = 'flex';
        });
        closeAscensionBtn.addEventListener("click", () => {
            state.isPaused = false;
            ascensionGridModal.style.display = 'none';
        });

        arenaBtn.addEventListener("click", () => startNewGame(true));
    }

    // --- Game Flow ---
    function loop() {
        if (!gameTick(mx, my)) {
            if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            return;
        }
        if (!state.isPaused) {
            // Logic for spawning enemies and bosses
            if (!state.bossActive && !state.arenaMode && Date.now() > state.bossSpawnCooldownEnd) {
                 const bossIndex = (state.player.level - 1) % bossData.length;
                 if (state.player.level > bossData.length || state.player.level > 1) { // Logic to prevent immediate boss spawn on first level
                    spawnEnemy(true);
                    state.bossSpawnCooldownEnd = Date.now() + 15000; // Cooldown for next boss
                 }
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
        state.enemies = [];
        spawnEnemy(true);
        updateUI();
    };

    // --- START THE GAME ---
    setup();
    populateLevelSelect(bossData, startSpecificLevel);
    startNewGame(false);

});

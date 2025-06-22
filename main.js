// modules/main.js
import { state, resetGame, loadPlayerState } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect, showCustomConfirm } from './modules/ui.js';
import { gameTick, spawnEnemy, spawnPickup, addStatusEffect, handleThematicUnlock } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';
import { renderAscensionGrid, applyAllTalentEffects } from './modules/ascension.js';

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
    const clearSaveBtn = document.getElementById("clearSaveBtn");

    const gameOverMenu = document.getElementById('gameOverMenu');
    const restartStageBtn = document.getElementById('restartStageBtn');
    const levelSelectMenuBtn = document.getElementById('levelSelectMenuBtn');

    let mx = 0, my = 0;
    const allAudioElements = Array.from(document.querySelectorAll('audio'));
    const music = document.getElementById("bgMusic");

    // --- INITIALIZATION ---
    function initialize() {
        loadPlayerState();
        applyAllTalentEffects(); // Apply talents on initial load

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
            populateLevelSelect(bossData, startSpecificLevel);
            levelSelectModal.style.display = 'flex'; 
        });
        closeLevelSelectBtn.addEventListener("click", () => { 
            state.isPaused = false; 
            levelSelectModal.style.display = 'none'; 
        });
        
        ascensionBtn.addEventListener("click", () => {
            state.isPaused = true;
            apDisplayAscGrid.innerText = state.player.ascensionPoints;
            renderAscensionGrid(); 
            ascensionGridModal.style.display = 'flex';
        });
        closeAscensionBtn.addEventListener("click", () => {
            state.isPaused = false;
            ascensionGridModal.style.display = 'none';
        });

        arenaBtn.addEventListener("click", () => startNewGame(true));

        clearSaveBtn.addEventListener("click", () => {
            showCustomConfirm(
                "|| SEVER TIMELINE? ||",
                "All Ascension progress and unlocked powers will be lost to the void. This action cannot be undone.",
                () => { // onConfirm
                    localStorage.removeItem('eternalMomentumSave');
                    window.location.reload();
                }
            );
        });

        // Game Over Menu Listeners
        restartStageBtn.addEventListener("click", () => {
            gameOverMenu.style.display = 'none';
            startSpecificLevel(state.currentStage);
        });

        levelSelectMenuBtn.addEventListener("click", () => {
            gameOverMenu.style.display = 'none';
            state.isPaused = true;
            populateLevelSelect(bossData, startSpecificLevel);
            levelSelectModal.style.display = 'flex';
        });
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
                state.bossSpawnCooldownEnd = Infinity; 
            }
            if (state.bossActive && Math.random() < (0.007 + state.player.level * 0.001)) {
                 spawnEnemy(false);
            }
            if (Math.random() < (0.02 + state.player.level * 0.0002)) {
                 spawnPickup();
            }
        }
        state.gameLoopId = requestAnimationFrame(loop);
    }

    function arenaLoop() {
        if (!gameTick(mx, my)) { if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId); return; }
        if (!state.isPaused) {
            const spawnInterval = Math.max(1000, 8000 * Math.pow(0.95, state.wave));
            if (Date.now() - state.lastArenaSpawn > spawnInterval) {
                state.lastArenaSpawn = Date.now();
                state.wave++;
                spawnEnemy(true);
            }
            if (Math.random() < 0.02) { spawnPickup(); }
        }
        state.gameLoopId = requestAnimationFrame(arenaLoop);
    }

    const startNewGame = (isArena) => {
        if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
        applyAllTalentEffects(); // Apply talents before resetting the game
        resetGame(isArena);
        state.isPaused = false;
        levelSelectModal.style.display = 'none';
        if (isArena) { arenaLoop(); } else { loop(); }
    };

    const startSpecificLevel = (levelNum) => {
        startNewGame(false);
        state.currentStage = levelNum;
        for (let i = 2; i <= levelNum; i++) {
            handleThematicUnlock(i);
        }
        state.enemies = [];
        spawnEnemy(true);
        state.bossSpawnCooldownEnd = Infinity;
        updateUI();
    };

    // --- START THE GAME ---
    initialize();
    populateLevelSelect(bossData, startSpecificLevel);
    startNewGame(false);
    updateUI();
});

// modules/main.js
import { state, resetGame, loadPlayerState, savePlayerState } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect, showCustomConfirm } from './modules/ui.js';
import { gameTick, spawnBossesForStage, addStatusEffect, addEssence } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';
import { renderAscensionGrid, applyAllTalentEffects } from './modules/ascension.js';

// --- DEBUG FUNCTION FOR TESTING ---
// This function is now defined in the module's scope and explicitly attached to the window
// object, making it accessible from the developer console.
window.addAP = function(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
        console.log("Please provide a positive number of AP to add.");
        return;
    }
    state.player.ascensionPoints += amount;
    savePlayerState(); // Persist the new AP amount to localStorage
    updateUI(); // Update the visible UI to reflect the new total
    
    const apDisplayAscGrid = document.getElementById("ap-total-asc-grid");
    if(apDisplayAscGrid) {
        apDisplayAscGrid.innerText = state.player.ascensionPoints;
    }

    // --- BUG FIX ---
    // If the ascension grid is visible, we must re-render it
    // to update the nodes' styles and click handlers.
    if (document.getElementById('ascensionGridModal').style.display === 'flex') {
        renderAscensionGrid();
    }
    
    console.log(`${amount} AP added. Total AP: ${state.player.ascensionPoints}`);
};

const loadingScreen = document.getElementById('loading-screen');
const progressFill = document.getElementById('loading-progress-fill');
const statusText = document.getElementById('loading-status-text');
let progressInterval = null;

function simulateProgress() {
    let currentProgress = 0;
    progressInterval = setInterval(() => {
        currentProgress += 1;
        if (currentProgress > 95) {
             clearInterval(progressInterval);
        } else {
            progressFill.style.width = `${currentProgress}%`;
        }
    }, 20);
}

window.addEventListener('load', (event) => {
    // 1. Finalize the loading bar
    clearInterval(progressInterval);
    progressFill.style.width = '100%';
    statusText.innerText = 'Momentum Stabilized!';

    // --- DOM & Canvas Setup ---
    const canvas = document.getElementById("gameCanvas");
    const soundBtn = document.getElementById("soundToggle");
    const ascensionBtn = document.getElementById("ascensionBtn");
    const levelSelectBtn = document.getElementById("levelSelectBtn");
    
    // Modals and their controls
    const levelSelectModal = document.getElementById("levelSelectModal");
    const closeLevelSelectBtn = document.getElementById("closeLevelSelectBtn");
    const arenaBtn = document.getElementById("arenaBtn");
    const jumpToFrontierBtn = document.getElementById("jumpToFrontierBtn");
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
        applyAllTalentEffects();

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

        const gameHelpers = { addStatusEffect, addEssence };

        const useOffensivePower = () => { if (state.offensiveInventory[0]) usePower('offensive', utils, gameHelpers, mx, my); };
        const useDefensivePower = () => { if (state.defensiveInventory[0]) usePower('defensive', utils, gameHelpers, mx, my); };

        canvas.addEventListener("click", e => { if (e.target.id === 'gameCanvas') useOffensivePower(); });
        canvas.addEventListener("contextmenu", e => { e.preventDefault(); useDefensivePower(); });
        document.getElementById('slot-off-0').addEventListener('click', useOffensivePower);
        document.getElementById('slot-def-0').addEventListener('click', useDefensivePower);

        soundBtn.addEventListener("click", () => AudioManager.toggleMute());
        document.body.addEventListener("click", () => AudioManager.unlockAudio(), { once: true });
        document.body.addEventListener("touchstart", () => AudioManager.unlockAudio(), { once: true });

        levelSelectBtn.addEventListener("click", () => { 
            state.isPaused = true; 
            populateLevelSelect(startSpecificLevel);
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
        jumpToFrontierBtn.addEventListener("click", () => {
            let frontierStage = (state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1);
            startSpecificLevel(frontierStage);
        });

        clearSaveBtn.addEventListener("click", () => {
            showCustomConfirm(
                "|| SEVER TIMELINE? ||",
                "All Ascension progress and unlocked powers will be lost to the void. This action cannot be undone.",
                () => {
                    localStorage.removeItem('eternalMomentumSave');
                    window.location.reload();
                }
            );
        });

        restartStageBtn.addEventListener("click", () => {
            startSpecificLevel(state.currentStage);
        });

        levelSelectMenuBtn.addEventListener("click", () => {
            gameOverMenu.style.display = 'none';
            state.isPaused = true;
            populateLevelSelect(startSpecificLevel);
            levelSelectModal.style.display = 'flex';
        });
    }

    // --- Game Flow ---
    function loop() {
        if (!gameTick(mx, my)) {
            if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
            return;
        }
        state.gameLoopId = requestAnimationFrame(loop);
    }

    function arenaLoop() {
        if (!gameTick(mx, my)) { if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId); return; }
        state.gameLoopId = requestAnimationFrame(arenaLoop);
    }

    const startNewGame = (isArena) => {
        if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
        applyAllTalentEffects();
        resetGame(isArena);
        state.isPaused = false;
        gameOverMenu.style.display = 'none';
        levelSelectModal.style.display = 'none';
        if (isArena) { 
            arenaLoop(); 
        } else { 
            spawnBossesForStage(state.currentStage);
            loop(); 
        }
    };
    
    const startSpecificLevel = (levelNum) => {
        if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
        applyAllTalentEffects();
        resetGame(false); 
        state.currentStage = levelNum; 
        
        gameOverMenu.style.display = 'none';
        levelSelectModal.style.display = 'none';
        state.isPaused = false;
        
        spawnBossesForStage(state.currentStage);

        updateUI();
        loop();
    };

    // --- FADE OUT LOADING SCREEN AND START ---
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        loadingScreen.addEventListener('transitionend', () => {
            loadingScreen.style.display = 'none';
        }, { once: true });

        initialize();
        const startStage = state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1;
        startSpecificLevel(startStage);
    }, 500);
});

// Start the simulated progress bar immediately
simulateProgress();

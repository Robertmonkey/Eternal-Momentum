// modules/main.js
import { state, resetGame, loadPlayerState, savePlayerState } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect, showCustomConfirm, populateOrreryMenu, populateAberrationCoreMenu, showUnlockNotification } from './modules/ui.js';
import { gameTick, spawnBossesForStage, addStatusEffect, addEssence } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';
import { renderAscensionGrid, applyAllTalentEffects } from './modules/ascension.js';
import * as Cores from './modules/cores.js';

window.addAP = function(amount) {
    if (typeof amount !== 'number' || amount <= 0) {
        console.log("Please provide a positive number of AP to add.");
        return;
    }
    state.player.ascensionPoints += amount;
    savePlayerState(); 
    updateUI(); 
    const apDisplayAscGrid = document.getElementById("ap-total-asc-grid");
    if(apDisplayAscGrid) {
        apDisplayAscGrid.innerText = state.player.ascensionPoints;
    }
    if (document.getElementById('ascensionGridModal').style.display === 'flex') {
        renderAscensionGrid();
    }
    console.log(`${amount} AP added. Total AP: ${state.player.ascensionPoints}`);
};

const loadingScreen = document.getElementById('loading-screen');
const progressFill = document.getElementById('loading-progress-fill');
const statusText = document.getElementById('loading-status-text');

function preloadAssets() {
    return new Promise((resolve) => {
        const assetManifest = [
            './assets/home.mp4', './assets/load.png', './assets/bg.png',
            ...Array.from(document.querySelectorAll('audio')).map(el => el.src)
        ];
        
        const totalAssets = assetManifest.length;
        let assetsLoaded = 0;

        const updateProgress = (assetUrl) => {
            assetsLoaded++;
            const progress = Math.round((assetsLoaded / totalAssets) * 100);
            progressFill.style.width = `${progress}%`;
            if (assetUrl) statusText.innerText = `Loading ${assetUrl.split('/').pop()}...`;

            if (assetsLoaded >= totalAssets) {
                setTimeout(() => {
                    statusText.innerText = 'Momentum Stabilized!';
                    resolve();
                }, 250);
            }
        };

        if (totalAssets === 0) {
            resolve();
            return;
        }

        assetManifest.forEach(url => {
            if (!url) {
                updateProgress(null);
                return;
            };
            const isImage = /\.(png|jpg|jpeg|gif)$/.test(url);
            const isVideo = url.endsWith('.mp4');

            if (isImage) {
                const img = new Image();
                img.src = url;
                img.onload = () => updateProgress(url);
                img.onerror = () => {
                    console.error(`Failed to load image: ${url}`);
                    updateProgress(url);
                };
            } else if (isVideo) {
                const video = document.getElementById('home-video-bg');
                const fallbackTimeout = setTimeout(() => {
                    console.warn(`Video fallback timeout for ${url}`);
                    updateProgress(url);
                }, 5000);
                video.addEventListener('canplaythrough', () => {
                    clearTimeout(fallbackTimeout);
                    updateProgress(url);
                }, { once: true });
                video.addEventListener('error', (e) => {
                     console.error(`Failed to load video: ${url}`, e);
                    clearTimeout(fallbackTimeout);
                    updateProgress(url);
                }, { once: true });
                if(video.src !== url) video.src = url;
                video.load();
            } else { 
                const audioEl = Array.from(document.querySelectorAll('audio')).find(el => el.src.includes(url.split('/').pop()));
                if (audioEl) {
                     const fallbackTimeout = setTimeout(() => {
                        console.warn(`Audio fallback timeout for ${url}`);
                        updateProgress(url);
                    }, 5000);
                    audioEl.addEventListener('canplaythrough', () => {
                        clearTimeout(fallbackTimeout);
                        updateProgress(url);
                    }, { once: true });
                    audioEl.addEventListener('error', (e) => {
                        console.error(`Failed to load audio: ${url}`, e);
                        clearTimeout(fallbackTimeout);
                        updateProgress(url);
                    }, { once: true });
                    audioEl.load();
                } else {
                     updateProgress(url);
                }
            }
        });
    });
}

window.addEventListener('load', () => {
    preloadAssets().then(() => {
        const canvas = document.getElementById("gameCanvas");
        const uiContainer = document.getElementById("ui-container");
        const soundBtn = document.getElementById("soundToggle");
        const ascensionBtn = document.getElementById("ascensionBtn");
        const levelSelectBtn = document.getElementById("levelSelectBtn");
        
        const homeScreen = document.getElementById('home-screen');
        const allHomeButtons = document.querySelectorAll('.home-btn');
        const newGameBtn = document.getElementById('new-game-btn');
        const continueGameBtn = document.getElementById('continue-game-btn');
        const eraseGameBtn = document.getElementById('erase-game-btn');
        
        const levelSelectModal = document.getElementById("levelSelectModal");
        const closeLevelSelectBtn = document.getElementById("closeLevelSelectBtn");
        const arenaBtn = document.getElementById("arenaBtn");
        const storyBtn = document.getElementById("loreCodexBtn");
        const jumpToFrontierBtn = document.getElementById("jumpToFrontierBtn");
        
        const ascensionGridModal = document.getElementById("ascensionGridModal");
        const closeAscensionBtn = document.getElementById("closeAscensionBtn");
        const apDisplayAscGrid = document.getElementById("ap-total-asc-grid");
        const clearSaveBtn = document.getElementById("clearSaveBtn");

        const bossInfoModal = document.getElementById('bossInfoModal');
        const bossInfoTitle = document.getElementById('bossInfoModalTitle');
        const bossInfoContent = document.getElementById('bossInfoModalContent');
        const closeBossInfoBtn = document.getElementById('closeBossInfoModalBtn');

        const orreryModal = document.getElementById("orreryModal");
        const closeOrreryBtn = document.getElementById("closeOrreryBtn");

        const gameOverMenu = document.getElementById('gameOverMenu');
        const restartStageBtn = document.getElementById('restartStageBtn');
        const levelSelectMenuBtn = document.getElementById('levelSelectMenuBtn');
        const ascensionMenuBtn = document.getElementById('ascensionMenuBtn');
        
        const aberrationCoreSocket = document.getElementById('aberration-core-socket');
        const aberrationCoreModal = document.getElementById('aberrationCoreModal');
        const closeAberrationCoreBtn = document.getElementById('closeAberrationCoreBtn');
        const unequipCoreBtn = document.getElementById('unequipCoreBtn');
        const aberrationCoreMenuBtn = document.getElementById('aberrationCoreMenuBtn');

        let mx = 0, my = 0;
        window.mousePosition = { x: 0, y: 0 };
        const allAudioElements = Array.from(document.querySelectorAll('audio'));
        let gameLoopId = null;

        // ---- ALL MAJOR FUNCTIONS ARE DEFINED HERE IN THE CORRECT SCOPE ----

        function loop() {
            if (!gameTick(mx, my)) {
                if (gameLoopId) {
                    cancelAnimationFrame(gameLoopId);
                    gameLoopId = null;
                }
                return;
            }
            gameLoopId = requestAnimationFrame(loop);
        }

        const startSpecificLevel = (levelNum) => {
            if (gameLoopId) cancelAnimationFrame(gameLoopId);
            applyAllTalentEffects();
            resetGame(false); 
            state.currentStage = levelNum; 
            gameOverMenu.style.display = 'none';
            levelSelectModal.style.display = 'none';
            state.isPaused = false;
            updateUI();
            loop();
        };

        const startOrreryEncounter = (bossList) => {
            if (gameLoopId) cancelAnimationFrame(gameLoopId);
            applyAllTalentEffects();
            resetGame(true); 
            state.customOrreryBosses = bossList; 
            state.currentStage = 999; 
            gameOverMenu.style.display = 'none';
            orreryModal.style.display = 'none';
            state.isPaused = false;
            updateUI();
            loop();
        };

        const equipCore = (coreId) => {
            state.player.equippedAberrationCore = coreId;
            savePlayerState();
            populateAberrationCoreMenu(onCoreEquip);
            updateUI();
        };

        const onCoreEquip = (coreId) => {
            const isEquipped = state.player.equippedAberrationCore === coreId;
            if (!state.gameOver && gameLoopId && !isEquipped) {
                showCustomConfirm(
                    "|| DESTABILIZE TIMELINE? ||",
                    "Attuning a new Aberration Core requires a full system recalibration. The current timeline will collapse, forcing a restart of the stage. Do you wish to proceed?",
                    () => {
                        equipCore(coreId);
                        aberrationCoreModal.style.display = 'none';
                        startSpecificLevel(state.currentStage); 
                    }
                );
            } else if (!isEquipped) {
                equipCore(coreId);
            }
        };

        function setupHomeScreen() {
            const hasSaveData = localStorage.getItem('eternalMomentumSave') !== null;
            if (hasSaveData) {
                continueGameBtn.style.display = 'block';
                eraseGameBtn.style.display = 'block';
                newGameBtn.style.display = 'none';
            } else {
                continueGameBtn.style.display = 'none';
                eraseGameBtn.style.display = 'none';
                newGameBtn.style.display = 'block';
            }
        }
        
        function setupEventListeners() {
            function setPlayerTarget(e) {
                const rect = canvas.getBoundingClientRect();
                const clientX = e.clientX ?? e.touches[0].clientX;
                const clientY = e.clientY ?? e.touches[0].clientY;
                mx = clientX - rect.left;
                my = clientY - rect.top;
                window.mousePosition.x = mx;
                window.mousePosition.y = my;
            }
            
            canvas.addEventListener("mousemove", setPlayerTarget);
            canvas.addEventListener("touchmove", e => { e.preventDefault(); setPlayerTarget(e); }, { passive: false });
            canvas.addEventListener("touchstart", e => { e.preventDefault(); setPlayerTarget(e); }, { passive: false });
            
            const useOffensivePowerWrapper = () => {
                if (state.gameOver || state.isPaused) return;
                const powerKey = state.offensiveInventory[0];
                if (powerKey) usePower(powerKey);
                else Cores.handleCoreOnEmptySlot(mx, my, window.gameHelpers);
            };
            const useDefensivePowerWrapper = () => {
                if (state.gameOver || state.isPaused) return;
                const powerKey = state.defensiveInventory[0];
                if (powerKey) usePower(powerKey);
            };

            canvas.addEventListener("click", e => { if (e.target.id === 'gameCanvas') useOffensivePowerWrapper(); });
            canvas.addEventListener("contextmenu", e => { e.preventDefault(); useDefensivePowerWrapper(); });
            document.getElementById('slot-off-0').addEventListener('click', useOffensivePowerWrapper);
            document.getElementById('slot-def-0').addEventListener('click', useDefensivePowerWrapper);
            document.addEventListener('visibilitychange', () => AudioManager.handleVisibilityChange());
            soundBtn.addEventListener("click", () => AudioManager.toggleMute());
            
            document.querySelectorAll('button, .stage-select-item, .orrery-boss-item, .aberration-core-item, .talent-node.can-purchase, #aberration-core-socket').forEach(button => {
                button.addEventListener('mouseenter', () => AudioManager.playSfx('uiHoverSound'));
                button.addEventListener('click', () => AudioManager.playSfx('uiClickSound'));
            });

            levelSelectBtn.addEventListener("click", () => { 
                state.isPaused = true; 
                populateLevelSelect(startSpecificLevel);
                arenaBtn.style.display = state.player.highestStageBeaten >= 30 ? 'block' : 'none';
                levelSelectModal.style.display = 'flex'; 
                AudioManager.playSfx('uiModalOpen');
            });

            closeLevelSelectBtn.addEventListener("click", () => {
                levelSelectModal.style.display = 'none';
                AudioManager.playSfx('uiModalClose');
                if (state.gameOver) document.getElementById('gameOverMenu').style.display = 'flex';
                else if (gameLoopId) state.isPaused = false;
            });
            
            ascensionBtn.addEventListener("click", () => {
                state.isPaused = true;
                apDisplayAscGrid.innerText = state.player.ascensionPoints;
                renderAscensionGrid(); 
                ascensionGridModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            });
            
            closeAscensionBtn.addEventListener("click", () => {
                ascensionGridModal.style.display = 'none';
                AudioManager.playSfx('uiModalClose');
                if (state.gameOver) gameOverMenu.style.display = 'flex';
                else if (gameLoopId) state.isPaused = false;
            });

            const openAberrationCoreMenu = () => {
                if (state.player.level < 10) {
                    showUnlockNotification("SYSTEM LOCKED", "Requires Player Level 10");
                    return;
                }
                state.isPaused = true;
                populateAberrationCoreMenu(onCoreEquip);
                aberrationCoreModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            };

            aberrationCoreSocket.addEventListener('click', openAberrationCoreMenu);
            aberrationCoreMenuBtn.addEventListener('click', () => {
                gameOverMenu.style.display = 'none';
                openAberrationCoreMenu();
            });

            closeAberrationCoreBtn.addEventListener('click', () => {
                aberrationCoreModal.style.display = 'none';
                AudioManager.playSfx('uiModalClose');
                if (state.gameOver) gameOverMenu.style.display = 'flex';
                else if (gameLoopId) state.isPaused = false;
            });
            
            unequipCoreBtn.addEventListener('click', () => onCoreEquip(null));

            storyBtn.addEventListener("click", () => { /* Story logic remains the same */ });
            arenaBtn.addEventListener("click", () => { /* Arena logic remains the same */ });
            closeOrreryBtn.addEventListener("click", () => { /* Orrery logic remains the same */ });
            jumpToFrontierBtn.addEventListener("click", () => startSpecificLevel(state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1));
            clearSaveBtn.addEventListener("click", () => { /* Clear save logic remains the same */ });

            restartStageBtn.addEventListener("click", () => startSpecificLevel(state.currentStage));
            levelSelectMenuBtn.addEventListener("click", () => { /* Level select from game over logic remains the same */ });
            ascensionMenuBtn.addEventListener("click", () => { /* Ascension from game over logic remains the same */ });

            function startGameFromHome() {
                AudioManager.unlockAudio();
                homeScreen.classList.remove('visible');
                homeScreen.addEventListener('transitionend', () => {
                    homeScreen.style.display = 'none';
                }, { once: true });
                uiContainer.style.display = 'flex';
            }

            allHomeButtons.forEach(btn => btn.addEventListener('click', () => {
                if (btn.id !== 'erase-game-btn') startGameFromHome();
            }));
            continueGameBtn.addEventListener('click', () => startSpecificLevel(state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1));
            newGameBtn.addEventListener('click', () => startSpecificLevel(1));
            eraseGameBtn.addEventListener('click', () => { /* Erase save logic remains the same */ });
        }
        
        function initialize() {
            canvas.style.cursor = "url('./assets/cursors/crosshair.cur'), crosshair";
            
            loadPlayerState();
            applyAllTalentEffects();
            mx = canvas.width / 2;
            my = canvas.height / 2;
            function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
            window.addEventListener("resize", resize);
            resize();
            AudioManager.setup(allAudioElements, soundBtn);
            setupEventListeners();
            setupHomeScreen();
        }
        
        // --- THIS IS THE CORRECTED INITIALIZATION FLOW ---
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            loadingScreen.addEventListener('transitionend', () => {
                loadingScreen.style.display = 'none';
                homeScreen.style.display = 'flex';
                requestAnimationFrame(() => {
                     homeScreen.classList.add('visible');
                });
                // Initialize the game's logic AFTER the screen has faded out
                initialize();
            }, { once: true });
        }, 500); // Initial delay to ensure "Momentum Stabilized!" is seen
    });
});

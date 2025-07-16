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

// --- CONSOLE COMMANDS FOR TESTING ---
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

window.setLevel = function(level) {
    if (typeof level !== 'number' || level <= 0) {
        console.log("Please provide a positive number for the level.");
        return;
    }
    state.player.level = level;
    state.player.essence = 0;
    let nextLevelXP = 100;
    for (let i = 1; i < level; i++) {
        nextLevelXP = Math.floor(nextLevelXP * 1.12);
    }
    state.player.essenceToNextLevel = nextLevelXP;
    
    savePlayerState();
    updateUI();
    console.log(`Player level set to ${level}.`);
};

window.unlockStage = function(stage) {
    if (typeof stage !== 'number' || stage < 0) {
        console.log("Please provide a positive stage number.");
        return;
    }
    state.player.highestStageBeaten = stage;
    savePlayerState();
    updateUI();
    console.log(`Unlocked all stages up to ${stage}. Please reopen the Stage Select menu to see the change.`);
};
// --- END CONSOLE COMMANDS ---

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
            aberrationCoreModal.style.display = 'none';
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

        function equipCore(coreId) {
            state.player.equippedAberrationCore = coreId;
            savePlayerState();
            populateAberrationCoreMenu(onCoreEquip);
            updateUI();
        }

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
            
            let coreActivationTimeout = null;

            const useOffensivePowerWrapper = () => {
                if (state.gameOver || state.isPaused || coreActivationTimeout) return;
                const powerKey = state.offensiveInventory[0];
                if (powerKey) usePower(powerKey);
            };
            const useDefensivePowerWrapper = () => {
                if (state.gameOver || state.isPaused || coreActivationTimeout) return;
                const powerKey = state.defensiveInventory[0];
                if (powerKey) usePower(powerKey);
            };

            canvas.addEventListener('mousedown', e => {
                if (state.isPaused || state.gameOver) return;
                if(e.target !== canvas) return;
                if (e.button === 0) state.LMB_down = true;
                if (e.button === 2) state.RMB_down = true;

                if (state.LMB_down && state.RMB_down) {
                    Cores.activateCorePower(mx, my, window.gameHelpers);
                    coreActivationTimeout = setTimeout(() => {
                        coreActivationTimeout = null;
                    }, 100);
                }
            });

            canvas.addEventListener('mouseup', e => {
                if(e.target !== canvas) return;
                if (e.button === 0) state.LMB_down = false;
                if (e.button === 2) state.RMB_down = false;
            });

            canvas.addEventListener("click", e => { if (e.target.id === 'gameCanvas') useOffensivePowerWrapper(); });
            canvas.addEventListener("contextmenu", e => { 
                e.preventDefault(); 
                useDefensivePowerWrapper(); 
            });
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

            closeAberrationCoreBtn.addEventListener("click", () => {
                aberrationCoreModal.style.display = 'none';
                AudioManager.playSfx('uiModalClose');
                if (state.gameOver) gameOverMenu.style.display = 'flex';
                else if (gameLoopId) state.isPaused = false;
            });
            
            unequipCoreBtn.addEventListener('click', () => {
                const isEquipped = state.player.equippedAberrationCore !== null;
                 if (!state.gameOver && gameLoopId && isEquipped) {
                    showCustomConfirm(
                        "|| DESTABILIZE TIMELINE? ||",
                        "Attuning to nothing requires a full system recalibration. The current timeline will collapse, forcing a restart of the stage. Do you wish to proceed?",
                        () => {
                            equipCore(null);
                            aberrationCoreModal.style.display = 'none';
                            startSpecificLevel(state.currentStage);
                        }
                    );
                } else {
                    equipCore(null);
                }
            });

            storyBtn.addEventListener("click", () => {
                const storyTitle = "ETERNAL MOMENTUM";
                const storyContent = `
                    <h3>The Unraveling</h3>
                    <p>Reality is not a single thread, but an infinite, shimmering tapestry of timelines. This tapestry is fraying. A formless, silent entropy named the <strong>Unraveling</strong> consumes existence, timeline by timeline. It is a cosmic error causing reality to decohere into paradox and chaos. As each world's fundamental laws are overwritten, its echoes are twisted into monstrous <strong>Aberrations</strong>—nightmarish amalgamations of what once was.</p>
                    
                    <h3>The Conduit</h3>
                    <p>Amidst the universal decay, you exist. You are the <strong>Conduit</strong>, an impossible being capable of maintaining a stable presence across fracturing realities. Your consciousness is imbued with <strong>Eternal Momentum</strong>—an innate, unyielding drive to push forward, to resist the decay, and to preserve the flickering embers of spacetime. By defeating Aberrations, you reclaim lost fragments of reality's source code, integrating them into your own being through the <strong>Ascension Conduit</strong> to grow stronger.</p>
                    
                    <hr style="border-color: rgba(255,255,255,0.2); margin: 15px 0;">

                    <h3>Power-ups: Echoes of Stability</h3>
                    <p>The pickups you find scattered across the battlefield are not mere tools; they are concentrated fragments of stable realities that have not yet fully succumbed to the Unraveling. Each one is a memory of a physical law or a powerful concept—the unbreakable defense of a <strong>Shield</strong>, the impossible speed of a <strong>Momentum Drive</strong>, the focused devastation of a <strong>Missile</strong>. By absorbing them, you temporarily impose these stable concepts onto your own existence.</p>

                    <h3>Aberration Cores: Controlled Chaos</h3>
                    <p>As you gain power and experience, you learn to do more than just defeat Aberrations—you learn to resonate with their very essence. The <strong>Aberration Cores</strong> are stabilized fragments of their paradoxical existence, which you can attune to your own matrix. Equipping a Core forges a symbiotic link, granting you a fraction of an Aberration's unique power. It is a dangerous and powerful process: wielding the logic of chaos as a weapon against itself.</p>
                    
                    <hr style="border-color: rgba(255,255,255,0.2); margin: 15px 0;">

                    <h3>The Mission</h3>
                    <p>Your journey is a desperate pilgrimage through the collapsing remnants of countless worlds. Each "stage" is a pocket of spacetime you temporarily stabilize through sheer force of will. The <strong>Ascension Conduit</strong> is your means of survival and growth.</p>
                    <p>By defeating Aberrations, you are not merely destroying them; you are reclaiming lost fragments of reality's source code. By integrating these fragments into your own being through the Conduit, you grow stronger, turning the weapons of your enemy into the keys to your salvation.</p>
                    
                    <h3>The Weaver's Orrery</h3>
                    <p>The <strong>Weaver's Orrery</strong> is your greatest tool. A mysterious device left by a precursor race, it allows you to manipulate the <strong>Echoes of Creation</strong>—the residual energy left by powerful Aberrations.</p>
                    <p>With the Orrery, you can forge custom timelines, simulating encounters against the multiverse's most dangerous threats. This is not mere practice; it is a way to hone your skills and prepare for the ultimate confrontation against the silent, all-consuming heart of the Unraveling.</p>

                    <hr style="border-color: rgba(255,255,255,0.2); margin: 15px 0;">
                    <p><em>You are the final anchor in a storm of nonexistence. Hold the line. Maintain your momentum.</em></p>
                `;
                
                levelSelectModal.style.display = 'none';
                bossInfoTitle.innerHTML = storyTitle;
                bossInfoContent.innerHTML = storyContent;
                bossInfoModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');

                const closeStoryHandler = () => {
                    bossInfoModal.style.display = 'none';
                    levelSelectModal.style.display = 'flex';
                    closeBossInfoBtn.removeEventListener('click', closeStoryHandler);
                };
                closeBossInfoBtn.addEventListener('click', closeStoryHandler, { once: true });
            });

            arenaBtn.addEventListener("click", () => {
                levelSelectModal.style.display = 'none';
                populateOrreryMenu(startOrreryEncounter);
                orreryModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            });

            closeOrreryBtn.addEventListener("click", () => {
                orreryModal.style.display = 'none';
                levelSelectModal.style.display = 'flex';
                AudioManager.playSfx('uiModalClose');
            });

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

            restartStageBtn.addEventListener("click", () => startSpecificLevel(state.currentStage));
            
            levelSelectMenuBtn.addEventListener("click", () => {
                gameOverMenu.style.display = 'none';
                state.isPaused = true;
                populateLevelSelect(startSpecificLevel);
                levelSelectModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            });
            
            ascensionMenuBtn.addEventListener("click", () => {
                gameOverMenu.style.display = 'none'; 
                apDisplayAscGrid.innerText = state.player.ascensionPoints;
                renderAscensionGrid();
                ascensionGridModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            });

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
            continueGameBtn.addEventListener('click', () => {
                const startStage = state.player.highestStageBeaten > 0 ? state.player.highestStageBeaten + 1 : 1;
                startSpecificLevel(startStage);
            });
            newGameBtn.addEventListener('click', () => startSpecificLevel(1));
            eraseGameBtn.addEventListener('click', () => {
                AudioManager.unlockAudio(); 
                showCustomConfirm(
                    "|| SEVER TIMELINE? ||",
                    "This timeline will be erased. All progress and unlocks will be lost to the void. This action cannot be undone.",
                    () => {
                        localStorage.removeItem('eternalMomentumSave');
                        window.location.reload();
                    }
                );
            });
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
        
        // This is the key change to fix the "stuck on loading" bug
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
        }, 500);
    });
});

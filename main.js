// modules/main.js
import { state, resetGame, loadPlayerState, savePlayerState } from './modules/state.js';
import { bossData } from './modules/bosses.js';
import { AudioManager } from './modules/audio.js';
import { updateUI, populateLevelSelect, showCustomConfirm, populateOrreryMenu } from './modules/ui.js';
import { gameTick, spawnBossesForStage, addStatusEffect, addEssence } from './modules/gameLoop.js';
import { usePower } from './modules/powers.js';
import * as utils from './modules/utils.js';
import { renderAscensionGrid, applyAllTalentEffects } from './modules/ascension.js';

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
    return new Promise((resolve, reject) => {
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
            statusText.innerText = `Loading ${assetUrl.split('/').pop()}...`;

            if (assetsLoaded === totalAssets) {
                setTimeout(() => {
                    statusText.innerText = 'Momentum Stabilized!';
                    resolve();
                }, 250);
            }
        };

        assetManifest.forEach(url => {
            const isImage = url.endsWith('.png');
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
                video.addEventListener('canplaythrough', () => updateProgress(url), { once: true });
                video.addEventListener('error', () => {
                     console.error(`Failed to load video: ${url}`);
                    updateProgress(url);
                }, { once: true });
                video.load();
            } else { 
                const audioEl = Array.from(document.querySelectorAll('audio')).find(el => el.src.includes(url.split('/').pop()));
                if (audioEl) {
                    audioEl.addEventListener('canplaythrough', () => updateProgress(url), { once: true });
                    audioEl.addEventListener('error', () => {
                        console.error(`Failed to load audio: ${url}`);
                        updateProgress(url);
                    }, { once: true });
                    audioEl.load();
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
        const arenaBtn = document.getElementById("arenaBtn"); // Now the Orrery Button
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

        let mx = 0, my = 0;
        const allAudioElements = Array.from(document.querySelectorAll('audio'));

        function initialize() {
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

        function stopAllLoopingSounds() {
            AudioManager.stopLoopingSfx('beamHumSound');
            AudioManager.stopLoopingSfx('wallShrink');
            AudioManager.stopLoopingSfx('obeliskHum');
            AudioManager.stopLoopingSfx('paradoxTrailHum');
        }

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
            document.addEventListener('visibilitychange', () => AudioManager.handleVisibilityChange());
            soundBtn.addEventListener("click", () => AudioManager.toggleMute());
            
            document.querySelectorAll('button, .stage-select-item, .orrery-boss-item').forEach(button => {
                button.addEventListener('mouseenter', () => AudioManager.playSfx('uiHoverSound'));
                button.addEventListener('click', () => AudioManager.playSfx('uiClickSound'));
            });

            levelSelectBtn.addEventListener("click", () => { 
                state.isPaused = true; 
                stopAllLoopingSounds();
                populateLevelSelect(startSpecificLevel);
                if (state.player.highestStageBeaten >= 30) {
                    arenaBtn.style.display = 'block';
                    arenaBtn.innerText = "WEAVER'S ORRERY";
                } else {
                    arenaBtn.style.display = 'none';
                }
                levelSelectModal.style.display = 'flex'; 
                AudioManager.playSfx('uiModalOpen');
            });
            closeLevelSelectBtn.addEventListener("click", () => { 
                state.isPaused = false; 
                levelSelectModal.style.display = 'none';
                AudioManager.playSfx('uiModalClose');
            });
            
            ascensionBtn.addEventListener("click", () => {
                state.isPaused = true;
                stopAllLoopingSounds();
                apDisplayAscGrid.innerText = state.player.ascensionPoints;
                renderAscensionGrid(); 
                ascensionGridModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            });
            
            closeAscensionBtn.addEventListener("click", () => {
                ascensionGridModal.style.display = 'none';
                AudioManager.playSfx('uiModalClose');
                if (state.gameOver) {
                    gameOverMenu.style.display = 'flex';
                } else {
                    state.isPaused = false;
                }
            });

            storyBtn.addEventListener("click", () => {
                const storyTitle = "ETERNAL MOMENTUM";
                const storyContent = `
                    <h3>The Unraveling</h3>
                    <p>Reality is not a single thread, but an infinite, shimmering tapestry of timelines. This tapestry is fraying.</p>
                    <p>A formless, silent entropy named the <strong>Unraveling</strong> consumes existence, timeline by timeline. It is a cosmic error causing reality to decohere into paradox and chaos. As each world's fundamental laws are overwritten, its echoes are twisted into monstrous <strong>Aberrations</strong>—nightmarish amalgamations of what once was, their very existence a violation of natural law.</p>
                    
                    <h3>The Conduit</h3>
                    <p>Amidst the universal decay, you exist. You are the <strong>Conduit</strong>, an impossible being capable of maintaining a stable presence across fracturing realities, immune to the chaos of the Unraveling. You are the final, desperate immune response of a dying multiverse.</p>
                    <p>Your very existence warps the battlefield on a fundamental level. You passively project a field of <strong>Quantum Friction</strong>, an extension of your own impossible stability. As matter and Aberrations draw near, they enter this aura and are forced to adhere to a stricter set of physical laws. Their chaotic energy dampens, their momentum slows—a localized reality where the multiverse itself grows dense and resistant in your presence.</p>
                    <p>Your consciousness is imbued with <strong>Eternal Momentum</strong>—an innate, unyielding drive to push forward, to resist the decay, and to preserve the flickering embers of spacetime.</p>
                    
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
                stopAllLoopingSounds();
                populateLevelSelect(startSpecificLevel);
                levelSelectModal.style.display = 'flex';
                AudioManager.playSfx('uiModalOpen');
            });
            
            ascensionMenuBtn.addEventListener("click", () => {
                gameOverMenu.style.display = 'none'; 
                stopAllLoopingSounds();
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

        function loop() {
            if (!gameTick(mx, my)) {
                if (state.gameLoopId) {
                    cancelAnimationFrame(state.gameLoopId);
                    stopAllLoopingSounds();
                }
                return;
            }
            state.gameLoopId = requestAnimationFrame(loop);
        }
        
        const startSpecificLevel = (levelNum) => {
            if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
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
            if (state.gameLoopId) cancelAnimationFrame(state.gameLoopId);
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
        
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            loadingScreen.addEventListener('transitionend', () => {
                loadingScreen.style.display = 'none';
                homeScreen.style.display = 'flex';
                requestAnimationFrame(() => {
                     homeScreen.classList.add('visible');
                });
            }, { once: true });
            initialize();
        }, 500);
    });
});

// modules/audio.js

export const AudioManager = {
    // --- STATE ---
    unlocked: false,
    userMuted: false,
    sfxVolume: 0.8, // Adjusted default SFX volume slightly
    musicVolume: 0.5,
    
    // --- Element Storage ---
    soundElements: {},
    musicPlaylist: [],
    
    // --- Music State ---
    currentTrackIndex: -1,
    currentMusic: null,
    isFading: false,
    
    // --- SETUP ---
    setup(audioElements, soundBtn) {
        audioElements.forEach(el => {
            this.soundElements[el.id] = el;
            if (el.id.startsWith('bgMusic')) {
                this.musicPlaylist.push(el);
            }
        });
        
        this.musicPlaylist.sort(() => Math.random() - 0.5);
        
        this.soundBtn = soundBtn;
        this.updateButtonIcon();
    },
    
    unlockAudio() {
        if (this.unlocked) return;
        this.unlocked = true;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        this.playMusic();
    },
    
    // --- GENERAL CONTROLS ---
    toggleMute() {
        if (!this.unlocked) this.unlockAudio();
        this.userMuted = !this.userMuted;
        
        // Mute looping elements directly
        Object.values(this.soundElements).forEach(el => {
            if (el.loop) el.muted = this.userMuted;
        });
        
        if (this.userMuted) {
            if(this.currentMusic) this.currentMusic.pause();
        } else {
            if(this.currentMusic) this.currentMusic.play().catch(e => {});
        }
        
        this.updateButtonIcon();
    },

    updateButtonIcon() {
        if(this.soundBtn) this.soundBtn.innerText = this.userMuted ? "🔇" : "🔊";
    },

    // --- SFX ---
    // --- CHANGE: This is the new, professional implementation for SFX playback ---
    playSfx(soundId) {
        if (!this.unlocked || this.userMuted) return;

        // Find the original audio element to get its source path
        const originalSfx = this.soundElements[soundId];
        
        if (originalSfx) {
            // Create a new, independent Audio object for this specific playback
            const sfxInstance = new Audio(originalSfx.src);
            sfxInstance.volume = this.sfxVolume;
            sfxInstance.play().catch(e => console.warn(`SFX instance for ${soundId} failed to play.`, e));
        } else {
            console.warn(`Sound with ID "${soundId}" not found.`);
        }
    },

    playLoopingSfx(soundId) {
        if (!this.unlocked || this.userMuted) return;
        const sfx = this.soundElements[soundId];
        if (sfx && sfx.paused) {
            sfx.volume = this.sfxVolume;
            sfx.play().catch(e => console.warn(`Looping SFX failed for: ${soundId}`, e));
        }
    },

    stopLoopingSfx(soundId) {
        const sfx = this.soundElements[soundId];
        if (sfx && !sfx.paused) {
            sfx.pause();
        }
    },

    // --- MUSIC SYSTEM ---
    _fade(audioElement, startVol, endVol, duration, onComplete) {
        if (this.isFading && endVol > 0) return;
        this.isFading = true;

        let currentVol = startVol;
        audioElement.volume = currentVol;
        const interval = 50;
        const step = (endVol - startVol) / (duration / interval);

        const fade = setInterval(() => {
            currentVol += step;
            if ((step > 0 && currentVol >= endVol) || (step < 0 && currentVol <= endVol)) {
                currentVol = endVol;
            }

            // Ensure volume is not muted by the master toggle during a fade
            audioElement.muted = false; 
            audioElement.volume = currentVol;

            if (currentVol === endVol) {
                clearInterval(fade);
                this.isFading = false;
                if(onComplete) onComplete();
            }
        }, interval);
    },

    fadeOutMusic(duration = 2000) {
        if (this.currentMusic && !this.isFading) {
            const trackToFade = this.currentMusic;
            this._fade(trackToFade, trackToFade.volume, 0, duration, () => {
                trackToFade.pause();
                if (this.currentMusic === trackToFade) {
                    this.currentMusic = null;
                }
            });
        }
    },

    crossfadeToNextTrack(duration = 3000) {
        if (this.isFading || this.userMuted) return;

        if (this.currentMusic) {
             this.fadeOutMusic(duration);
        }
        
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicPlaylist.length;
        const nextTrack = this.musicPlaylist[this.currentTrackIndex];
        this.currentMusic = nextTrack;
        
        nextTrack.currentTime = 0;
        nextTrack.play().catch(e => {});

        this._fade(nextTrack, 0, this.musicVolume, duration);
    },
    
    playMusic() {
        if (this.currentMusic || this.musicPlaylist.length === 0 || this.userMuted) return;
        this.crossfadeToNextTrack(1000); 
    }
};

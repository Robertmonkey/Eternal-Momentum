// modules/audio.js

export const AudioManager = {
    unlocked: false, 
    userMuted: false, 
    allAudio: [], 
    musicEl: null, 
    soundBtn: null,
    
    setup(audioElements, musicElement, buttonElement) { 
        this.allAudio = audioElements; 
        this.musicEl = musicElement; 
        this.soundBtn = buttonElement; 
        this.musicEl.volume = 0.5; 
        this.updateAllMutedStates(); 
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
        if (!this.userMuted) { 
            this.musicEl.play().catch(e => console.warn("Initial music playback failed.")); 
        } 
    },
    
    toggleMute() { 
        if (!this.unlocked) { 
            this.unlockAudio(); 
        } 
        this.userMuted = !this.userMuted; 
        if (!this.userMuted && this.musicEl.paused) { 
            this.musicEl.play().catch(e => console.error("Secondary music playback failed.", e)); 
        } 
        this.updateAllMutedStates(); 
        this.updateButtonIcon(); 
    },
    
    playSfx(sfxElement) { 
        if (sfxElement && this.unlocked && !this.userMuted) { 
            sfxElement.currentTime = 0; 
            sfxElement.play().catch(e => console.warn("SFX playback failed for:", sfxElement.id, e)); 
        } 
    },

    playLoopingSfx(sfxElement) {
        if (sfxElement && this.unlocked && !this.userMuted && sfxElement.paused) {
            sfxElement.play().catch(e => console.warn("Looping SFX playback failed for:", sfxElement.id, e));
        }
    },

    stopLoopingSfx(sfxElement) {
        if (sfxElement && !sfxElement.paused) {
            sfxElement.pause();
        }
    },
    
    updateAllMutedStates() { 
        this.allAudio.forEach(a => {
            a.muted = this.userMuted; 
            if(a.loop && a.muted) a.pause(); 
        }); 
    },
    
    updateButtonIcon() { 
        this.soundBtn.innerText = this.userMuted ? "🔇" : "🔊"; 
    }
};

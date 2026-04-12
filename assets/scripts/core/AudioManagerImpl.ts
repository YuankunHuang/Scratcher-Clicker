import {AudioSource, AudioClip, resources} from 'cc';
import {IAudioManager, IDisposable} from "./interfaces";

export class AudioManagerImpl implements IAudioManager, IDisposable {
    private readonly _bgmSource: AudioSource;
    private readonly _sfxSource: AudioSource;
    private _masterVolume: number = 1.0;

    constructor(bgmSource: AudioSource, sfxSource: AudioSource) {
        this._bgmSource = bgmSource;
        this._bgmSource.loop = true;
        this._sfxSource = sfxSource;
    }
    
    playBGM(clipName: string): void {
        resources.load<AudioClip>(`audio/bgm/${clipName}`, AudioClip, (err, clip) => {
            if (err) {
                console.error(`[Audio] BGM not found: ${clipName}`, err);
                return;
            }
            
            if (this._bgmSource.clip === clip && this._bgmSource.playing)
                return;
            
            this._bgmSource.clip = clip;
            this._bgmSource.volume = this._masterVolume;
            this._bgmSource.play();
        });
    }
    
    playSFX(clipName: string): void {
        resources.load<AudioClip>(`audio/sfx/${clipName}`, AudioClip, (err, clip) => {
            if (err) {
                console.error(`[Audio] SFX not found: ${clipName}`, err);
                return;
            }
            
            this._sfxSource.playOneShot(clip, this._masterVolume);
        })
    }
    
    stopBGM(): void {
        this._bgmSource.stop();
    }

    setMasterVolume(vol: number) {
        this._masterVolume = Math.max(Math.min(1, vol), 0);
        this._bgmSource.volume = this._masterVolume;
    }
    
    dispose(): void {
        this.stopBGM();
    }
}
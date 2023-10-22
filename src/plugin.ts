import { Mod1 } from 'cc-blitzkrieg/src/types'
import { SpacialAudio } from './spacial-audio'
import type * as _ from 'cc-vim'
import { MenuOptions } from './options'
import { PuzzleBeeper } from './puzzle'
import { LoudWalls } from './loudwalls'
import { SoundManager } from './sound-manager'
import { TTS } from './tts'

export default class CrossedEyes {
    dir: string
    mod: Mod1

    puzzleBeeper!: PuzzleBeeper
    tts!: TTS

    constructor(mod: Mod1) {
        this.dir = mod.baseDirectory
        this.mod = mod
        this.mod.isCCL3 = mod.findAllAssets ? true : false
        this.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
    }

    async prestart() {
        this.addVimAliases()
        MenuOptions.initPrestart()
        SoundManager.preloadSounds()
        new SpacialAudio().initSpacialAudio()
        new LoudWalls().initLoudWalls()

        this.puzzleBeeper = new PuzzleBeeper()
        this.puzzleBeeper.initPrestart()

        this.tts = new TTS()
        this.tts.initPrestart()
    }

    async poststart() {
        MenuOptions.initPoststart()
        this.tts.initPoststart()
    }

    addVimAliases() {
        if (window.vim) { /* optional dependency https://github.com/krypciak/cc-vim */
            vim.addAlias('crossedeyes', 'reset-puzzle', 'Reset puzzle step index', (ingame: boolean) => ingame && blitzkrieg.currSel.name == 'puzzle', () => {
                this.puzzleBeeper.stepI = 0
            })
        }
    }
}

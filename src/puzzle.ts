import type * as _ from 'cc-blitzkrieg'
import { MenuOptions } from './options'
import { mapNumber } from './spacial-audio'
import type { PuzzleSelection, PuzzleSelectionStep } from 'cc-blitzkrieg/types/puzzle-selection'
import { SoundManager } from './sound-manager'

function isAiming(): boolean {
    return ig.input.state('aim') || ig.gamepad.isRightStickDown()
}

class AimHandler {
    constructor(public pb: PuzzleBeeper) {}

    puzzleStartTime!: number

    farAwayFreq: number = 1300
    maxFreq: number = 0

    lastBeepTime: number = 0
    shootSoundPlayed: boolean = false

    minDegDistToSpeedup: number = 110
    lockInDegDist: number = 10

    lockedIn: boolean = false
    normalBeepSlience: boolean = false

    newAim!: Vec2

    initPrestart() {
        const self = this
        ig.ENTITY.Crosshair.inject({
            deferredUpdate(): void {
                this.parent()
                if (self.lockedIn) {
                    Vec2.assign(ig.game.playerEntityCrosshairInstance._aimDir, self.newAim)
                }
            }
        })
    }

    handleAim(step: PuzzleSelectionStep) {
        if (!this.pb.moveToHandler.lockedIn) { this.lockedIn = false; return }
        if (!ig.game || !ig.game.playerEntity || !MenuOptions.puzzleEnabled) { return }

        const nowt: number = sc.stats.getMap('player', 'playtime') * 1000

        if (this.lockedIn) {
            if (sc.control.thrown()) {
                this.lockedIn = false
                this.pb.moveToHandler.lockedIn = false
                this.pb.stepI++
                if (this.pb.stepI == 1) {
                    this.puzzleStartTime = nowt
                }
                return
            }
            const wait = 200
            if (! this.shootSoundPlayed) {
                const lastStep = this.pb.currentSel.data.recordLog!.steps[this.pb.stepI - 1]
                let play: boolean = false
                if (lastStep && !lastStep.split) {
                    const realDiffTime = Math.round((nowt - this.puzzleStartTime) * sc.options.get('assist-puzzle-speed'))
                    const diff = realDiffTime - step.endFrame
                    // console.log(diff, step.endFrame, realDiffTime)
                    if (diff > -wait) {
                        play = true
                    }
                } else { play = true }

                if (!this.shootSoundPlayed && play) {
                    this.shootSoundPlayed = true

                    SoundManager.appendQueue([
                        { wait, name: 'hitCounterEcho', speed: 1.1, condition: () => this.lockedIn },
                    ])
                }
            }
        } else {
            this.shootSoundPlayed = false
        }


        if (! step || ! step.pos) { return }
        const targetDeg = (step.shootAngle! + 360) % 360
        if (! targetDeg) { return }

        const r: number = 15
        const theta: number = targetDeg * (Math.PI / 180)
        
        this.newAim = Vec2.createC(r * Math.cos(theta), r * Math.sin(theta))

        if (! isAiming()) {
            this.lockedIn = false
            return
        }
        if (!ig.game || !ig.game.playerEntity ||  !MenuOptions.puzzleEnabled) { return }
        const deg = (ig.game.playerEntity.aimDegrees + 360) % 360 /* set by cc-blitzkrieg */
        if (! deg) { return }

        const dist: number = Math.min(
            Math.abs(deg - targetDeg),
            360 - Math.abs(deg - targetDeg)
        ) /* distance between target and current aim */

        if (dist <= this.lockInDegDist) {
            if (! this.lockedIn) {
                this.lockedIn = true
                this.normalBeepSlience = true
                SoundManager.appendQueue([
                    {            name: 'countdown1', relativePos: true, pos: this.newAim },
                    { wait: 200, name: 'countdown2', relativePos: true, pos: this.newAim },
                    { wait: 100, name: SoundManager.getElementName(step.element), speed: 1.2,
                        condition: () => isAiming() && step.element !== sc.model.player.currentElementMode,
                        action: () => {
                            this.normalBeepSlience = false
                            this.lastBeepTime = ig.game.now
                        },
                    },
                ])
            }
        } else if (this.lockedIn) {
            this.lockedIn = false
            this.normalBeepSlience = true

            SoundManager.clearQueue()
            SoundManager.appendQueue([
                {            name: 'countdown2', relativePos: true, pos: this.newAim },
                { wait: 200, name: 'countdown1', relativePos: true, pos: this.newAim,
                    action: () => {
                        this.normalBeepSlience = false
                        this.lastBeepTime = ig.game.now
                    }},
            ])
            return
        }
        if (this.lockedIn || this.normalBeepSlience) { return }

        const timeDiff = nowt - this.lastBeepTime
        const time: number = dist >= this.minDegDistToSpeedup ? this.farAwayFreq : 
            Math.max(
            mapNumber(deg, targetDeg - this.minDegDistToSpeedup, targetDeg, this.farAwayFreq, this.maxFreq),
            mapNumber(deg, targetDeg + this.minDegDistToSpeedup, targetDeg, this.farAwayFreq, this.maxFreq))

        if (timeDiff >= time) {
            const speed: number = 1
            SoundManager.playSoundAtRelative('computerBeep', speed, this.newAim)
            this.lastBeepTime = nowt
        }
    }
}

class MoveToHandler {
    constructor(public pb: PuzzleBeeper) {}

    farAwayFreq: number = 1000
    maxFreq: number = 0

    lastBeepTime: number = 0
    normalBeepSlience: boolean = false

    minDistToSpeedup: number = 8 * 16 
    lockinDist: number = 2 * 16
    relockDist: number = 0.5 * 16

    lockedIn: boolean = false
    softLockout: boolean = false
    allowRelock: boolean = false
    
    handleMoveTo(step: PuzzleSelectionStep) {
        const pos: Vec3 & { level: number } = step.pos
        
        const playerPos: Vec3 = Vec3.create(ig.game.playerEntity.coll.pos)
        const dist: number = Vec3.distance(pos, playerPos)

        const self = this
        let lockout: boolean = false
        if (dist <= this.lockinDist && pos.z == playerPos.z) {
            Vec3.add(playerPos, ig.game.playerEntity.coll.vel)
            const distWithVel: number = Vec3.distance(pos, playerPos)
            if (! this.softLockout || distWithVel <= this.relockDist) {
                if (! this.lockedIn) {
                    this.lockedIn = true
                    this.softLockout = false
                    
                    ig.game.playerEntity.setPos(pos.x, pos.y, pos.z)
                    ig.game.playerEntity.coll.vel = Vec3.create()
                    sc.model.player.setCore(sc.PLAYER_CORE.MOVE, false)
                    setTimeout(() => sc.model.player.setCore(sc.PLAYER_CORE.MOVE, true), 700)

                    this.normalBeepSlience = true
                    SoundManager.appendQueue([
                        {            name: 'countdown1', pos, speed: 1.2, },
                        { wait: 150, name: 'countdown2', pos, speed: 1.2,
                            action() {
                                self.normalBeepSlience = false
                                self.lastBeepTime = ig.game.now
                        },},
                    ])
                    return
                } else if (dist !== 0) {
                    lockout = true
                    this.softLockout = true
                }
            }
        } else {
            if (this.lockedIn) {
                lockout = true
            }
            this.softLockout = false
        }
        if (lockout) {
            this.lockedIn = false
            this.normalBeepSlience = true

            SoundManager.appendQueue([
                {            name: 'countdown2', pos, speed: 1.2 },
                { wait: 150, name: 'countdown1', pos, speed: 1.2, action: () => {
                    this.normalBeepSlience = false
                    this.lastBeepTime = ig.game.now
                }},
            ])
            return
        }
        if (this.lockedIn) { return }
        if (this.normalBeepSlience) { return }

        const nowt: number = ig.game.now
        const timeDiff = nowt - this.lastBeepTime
        const time: number = dist >= this.minDistToSpeedup ? this.farAwayFreq : 
            mapNumber(dist, this.minDistToSpeedup, 0, this.farAwayFreq, this.maxFreq)

        if (timeDiff >= time) {
            const speed: number = 1
            SoundManager.playSound('trainCudeHide', speed, pos)
            this.lastBeepTime = nowt
        }
    }
}

export class PuzzleBeeper {
    aimHandler: AimHandler = new AimHandler(this)
    moveToHandler: MoveToHandler = new MoveToHandler(this)

    stepI: number = 0
    currentSel!: PuzzleSelection
    cachedSolution!: keyof ig.KnownVars
    finishCondition: string = ''

    initPrestart() {
        blitzkrieg.sels.puzzle.loadAll()

        this.aimHandler.initPrestart()
        
        const self = this
        ig.ENTITY.Player.inject({
            update() {
                this.parent()

                if (!ig.game || !ig.game.playerEntity || !MenuOptions.puzzleEnabled) { return }

                const sel: PuzzleSelection = blitzkrieg.sels.puzzle.inSelStack.peek()
                if (!sel || !sel.data.recordLog || sel.data.recordLog.steps.length == 0) { return }
                if (self.currentSel !== sel) {
                    self.currentSel = sel
                    self.stepI = 0
                    if (self.currentSel.data.completionType === blitzkrieg.PuzzleCompletionType.Normal) {
                        self.cachedSolution = blitzkrieg.PuzzleSelectionManager.getPuzzleSolveCondition(sel).substring(1) as keyof ig.KnownVars
                    }
                }
                switch (self.currentSel.data.completionType) {
                    case blitzkrieg.PuzzleCompletionType.Normal: {
                        if (ig.vars.get(self.cachedSolution!)) {
                            if (self.stepI > 0) {
                                SoundManager.clearQueue()
                                SoundManager.appendQueue([
                                    {            name: 'botSuccess' },
                                    { wait: 20,  name: 'counter' },
                                    { wait: 150, name: 'botSuccess' },
                                ])
                                self.stepI = 0
                            }
                            return
                        }
                        break
                    }
                    case blitzkrieg.PuzzleCompletionType.GetTo:
                        break
                    case blitzkrieg.PuzzleCompletionType.Item:
                        break

                }
                const step = sel.data.recordLog.steps[self.stepI]
                if (!step || !step.pos) { return }
                self.moveToHandler.handleMoveTo(step)
                self.aimHandler.handleAim(step)
            }
        })
    }
}

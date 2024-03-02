import { interrupt, speakI, speakIC } from './api'
import { Opts } from '../../plugin'
import { SpecialAction } from '../../special-action'

import type * as _ from 'ccmodmanager/types/gui/list-entry'
import type * as __ from 'ccmodmanager/types/gui/menu'
import type { ModEntryLocal, ModEntryServer } from 'ccmodmanager/src/types.d.ts'

let ignoreModEntryButtonPressFrom: number = 0
export function modManager_setignoreModEntryButtonPressFrom(value: number) {
    ignoreModEntryButtonPressFrom = value
}

/* in prestart */
sc.ModListEntry.inject({
    focusGained() {
        this.parent()
        if (!Opts.tts) return
        const m = this.mod
        const lm: ModEntryLocal | undefined = m.isLocal ? m : m.localCounterpart
        const sm: ModEntryServer | undefined = m.isLocal ? m.serverCounterpart : m
        let str = `Mod: ${m.name}, `
        if (this.nameText.text?.toString().startsWith('\\c[3]')) str += `Selected, `
        if (lm) str += `${lm.active ? 'Enabled' : 'Disabled'}, `
        if (m.awaitingRestart) str += `awaiting restart, `
        if (lm?.hasUpdate) str += 'has update availible, '

        speakI(str)

        let desc = `${m.description ?? ''}.\n`
        if (sm) desc += `Tags: ${sm.tags.join(': ')}.\n`
        desc += `${(sm?.authors.length ?? 0) > 1 ? 'Authors' : 'Author'}: ${sm ? sm.authors.join(': ') : 'Unknown'}.\n`
        if (sm) desc += `Stars: ${sm.stars}.\n`
        desc += `Version: ${m.version.replace(/\./g, ': ')}.\n`
        if (sm?.lastUpdateTimestamp)
            desc += `Last updated: ${new Date(sm.lastUpdateTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.\n`

        SpecialAction.setListener('LSP', 'modMenuDescription', () => speakI(desc))
    },
    focusLost() {
        this.parent()
        interrupt()
        SpecialAction.setListener('LSP', 'modMenuDescription', () => {})
    },
    onButtonPress() {
        const resp = this.parent() as string | undefined
        if (resp && Date.now() - ignoreModEntryButtonPressFrom > 50) speakIC(resp)
        return resp
    },
})

sc.ModMenuList.inject({
    setTab(index, ignorePrev, settings) {
        const isSame = this.currentTabIndex == index
        this.parent(index, ignorePrev, settings)
        if (Opts.tts && !isSame && index == sc.MOD_MENU_TAB_INDEXES.SELECTED) {
            const elements = sc.modMenu.list.currentList.buttonGroup.elements.flat()
            if (elements.length == 0) speakI('Empty')
        }
    },
})

sc.ModMenu.inject({
    showModInstallDialog() {
        let say = false
        if (this.list.currentTabIndex != sc.MOD_MENU_TAB_INDEXES.SELECTED) say = true
        this.parent()
        say && speakIC(ig.lang.get('sc.gui.dialogs.yes'))
    },
})
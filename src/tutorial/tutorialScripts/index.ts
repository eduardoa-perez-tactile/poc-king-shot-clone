import type { TutorialScript } from '../tutorialTypes'
import { TUTORIAL_01_SCRIPT } from './tutorial_01'

const scriptsByLevelId: Record<string, TutorialScript> = {
  tutorial_01: TUTORIAL_01_SCRIPT
}

export const getTutorialScriptForLevelId = (levelId: string): TutorialScript | undefined => scriptsByLevelId[levelId]

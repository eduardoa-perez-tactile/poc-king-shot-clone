import type { TutorialScript } from '../tutorialTypes'

export const TUTORIAL_01_SCRIPT: TutorialScript = [
  {
    id: 'tutorial_welcome',
    phase: 'BUILD',
    text: {
      title: 'Welcome to the Frontier Drill',
      body: 'You survive by building during the day and fighting enemy waves at night. We will walk through each core system.'
    },
    anchor: { type: 'none' },
    gating: { required: false }
  },
  {
    id: 'tutorial_stronghold',
    phase: 'MAP',
    text: {
      title: 'This is your Stronghold',
      body: 'Click the Stronghold to inspect it. If you already understand this, you can continue manually.'
    },
    anchor: { type: 'world', target: 'stronghold' },
    gating: { required: false },
    completeWhen: {
      any: [{ event: 'STRONGHOLD_SELECTED' }]
    }
  },
  {
    id: 'tutorial_pads',
    phase: 'BUILD',
    text: {
      title: 'Build Pads',
      body: 'Select the highlighted tower pad to open build options.'
    },
    anchor: { type: 'world', target: 'pad', padId: 'tut_pad_tower_1' },
    gating: { required: true, allowManualAdvance: true },
    completeWhen: {
      any: [{ event: 'PAD_SELECTED' }]
    }
  },
  {
    id: 'tutorial_build_tower',
    phase: 'BUILD',
    text: {
      title: 'Build a Watchtower',
      body: 'Build your first tower. Towers attack enemies automatically from range.'
    },
    anchor: { type: 'ui', testId: 'build-option-watchtower' },
    gating: { required: true, blockInput: false, allowManualAdvance: true },
    completeWhen: {
      any: [
        { event: 'TOWER_PLACED' },
        { event: 'BUILDING_BUILT', match: { buildingType: 'watchtower' } }
      ]
    },
    autoAdvanceAfterMs: 350
  },
  {
    id: 'tutorial_spawn_indicators',
    phase: 'BUILD',
    text: {
      title: 'Incoming Direction',
      body: 'Watch the border indicators and intel to see where enemies will attack from next.'
    },
    anchor: { type: 'ui', testId: 'intel-button' },
    gating: { required: false },
    completeWhen: {
      any: [{ event: 'WAVE_SPAWN_INDICATOR_SHOWN' }]
    }
  },
  {
    id: 'tutorial_battle_cry',
    phase: ['BUILD', 'BATTLE'],
    text: {
      title: 'Start the Battle',
      body: 'Press Battle Cry to begin wave combat.'
    },
    anchor: { type: 'ui', testId: 'battle-cry-button' },
    gating: { required: true, allowManualAdvance: true },
    completeWhen: {
      any: [{ event: 'UI_BATTLE_CRY_CLICKED' }, { event: 'ENEMY_WAVE_STARTED' }]
    },
    autoAdvanceAfterMs: 100
  },
  {
    id: 'tutorial_move_hero',
    phase: 'BATTLE',
    text: {
      title: 'Move Your Hero',
      body: 'Use keyboard arrow keys to move the hero. Arrow keys control hero movement, not camera pan.'
    },
    anchor: { type: 'world', target: 'hero' },
    gating: { required: true },
    completeWhen: {
      all: [{ event: 'HERO_MOVED' }]
    }
  },
  {
    id: 'tutorial_recall_units',
    phase: 'BATTLE',
    text: {
      title: 'Recall Units',
      body: 'Press T to rally squads around your hero using fixed formation slots.'
    },
    anchor: { type: 'ui', testId: 'ability-rally-button' },
    gating: { required: true },
    completeWhen: {
      all: [{ event: 'UNIT_RECALL_USED' }]
    }
  },
  {
    id: 'tutorial_tower_attack',
    phase: 'BATTLE',
    text: {
      title: 'Tower Basics',
      body: 'Your tower fires automatically when enemies enter range.'
    },
    anchor: { type: 'world', target: 'pad', padId: 'tut_pad_tower_1' },
    gating: { required: true },
    completeWhen: {
      any: [{ event: 'TOWER_ATTACKED' }],
      autoAfterMs: 3000
    },
    autoAdvanceAfterMs: 350
  },
  {
    id: 'tutorial_build_producer',
    phase: 'BUILD',
    text: {
      title: 'Expand Production',
      body: 'During build phase, place a Barracks or Range to grow your roster.'
    },
    anchor: { type: 'world', target: 'pad', padId: 'tut_pad_barracks' },
    gating: { required: true },
    completeWhen: {
      any: [
        { event: 'BUILDING_BUILT', match: { buildingType: 'barracks' } },
        { event: 'BUILDING_BUILT', match: { buildingType: 'range' } }
      ]
    }
  },
  {
    id: 'tutorial_place_wall',
    phase: 'BUILD',
    text: {
      title: 'Place a Wall',
      body: 'Place a wall to block enemy pathing. Walls have HP and can be destroyed.'
    },
    anchor: { type: 'ui', testId: 'build-option-wall' },
    gating: { required: true },
    completeWhen: {
      all: [{ event: 'WALL_PLACED' }]
    }
  },
  {
    id: 'tutorial_summary',
    phase: 'SUMMARY',
    text: {
      title: 'End of Day Summary',
      body: 'Review gold earned and the distinct enemy types expected next day.'
    },
    anchor: { type: 'ui', testId: 'day-summary-modal' },
    gating: { required: true },
    completeWhen: {
      all: [{ event: 'NEXT_WAVE_ENEMY_TYPES_SHOWN' }]
    }
  },
  {
    id: 'tutorial_ready',
    phase: 'BUILD',
    text: {
      title: 'You are Ready',
      body: 'You now know the full loop: build, scout borders, start battle, fight waves, and plan the next day.'
    },
    anchor: { type: 'none' },
    gating: { required: false }
  }
]

import React from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { uiActions, useUiStore } from '../../store/uiStore'

export const SettingsDialog: React.FC = () => {
  const open = useUiStore((state) => state.settingsOpen)
  const settings = useUiStore((state) => state.settings)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? uiActions.openSettings() : uiActions.closeSettings())}
      title="Command Settings"
      description="Tune input feel and visual intensity."
      footer={<Button variant="primary" onClick={() => uiActions.closeSettings()}>Done</Button>}
    >
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-text">Reduced Motion</div>
          <div className="text-xs text-muted">Minimize HUD animations.</div>
        </div>
        <Button variant={settings.reducedMotion ? 'primary' : 'secondary'} size="sm" onClick={() => uiActions.toggleSetting('reducedMotion')}>
          {settings.reducedMotion ? 'On' : 'Off'}
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
        <div>
          <div className="text-sm font-semibold text-text">Sound</div>
          <div className="text-xs text-muted">Interface clicks and alerts.</div>
        </div>
        <Button variant={settings.sound ? 'primary' : 'secondary'} size="sm" onClick={() => uiActions.toggleSetting('sound')}>
          {settings.sound ? 'On' : 'Off'}
        </Button>
      </div>
    </Dialog>
  )
}

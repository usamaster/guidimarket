import { t, nl } from '../lib/i18n'

interface StickySaveBarProps {
  dirtyCount: number
  saving: boolean
  error: string | null
  onSave: () => void
  onDiscard: () => void
}

export function StickySaveBar({ dirtyCount, saving, error, onSave, onDiscard }: StickySaveBarProps) {
  if (dirtyCount < 1 && !error) return null

  return (
    <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 w-full max-w-md pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto bg-dark text-card shadow-lg rounded-full pl-5 pr-2 py-2 flex items-center gap-2 sm:gap-3 ring-1 ring-black/10">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">
            {dirtyCount} {nl(dirtyCount, t.predictions.unsavedSingular, t.predictions.unsavedPlural)}
          </span>
          {error && <span className="text-[11px] text-no truncate">{error}</span>}
        </div>
        <button
          onClick={() => {
            if (dirtyCount > 0 && !window.confirm(t.predictions.discardConfirm)) return
            onDiscard()
          }}
          disabled={saving || dirtyCount < 1}
          className="ml-auto text-card/70 hover:text-card disabled:opacity-40 text-sm font-medium px-3 py-2 rounded-full transition-colors cursor-pointer"
        >
          {t.predictions.discard}
        </button>
        <button
          onClick={onSave}
          disabled={saving || dirtyCount < 1}
          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer"
        >
          {saving ? t.predictions.saving : t.predictions.save}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { t } from '../lib/i18n'

export function ScoringLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-card border border-border rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 cursor-pointer text-left"
      >
        <span className="text-sm font-semibold text-dark">{t.predictions.pointsLegend}</span>
        <span className={`text-xs text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-text-secondary">
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-dark mb-2">{t.predictions.legendMatchTitle}</h3>
            <ul className="space-y-1">
              <li>{t.predictions.legendCorrectWinner}</li>
              <li>{t.predictions.legendGoalDiff}</li>
              <li>{t.predictions.legendTeamGoals}</li>
              <li>{t.predictions.legendExactBonus}</li>
              <li className="font-semibold text-dark mt-1">→ {t.predictions.legendExactScore}</li>
            </ul>
          </section>
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-dark mb-2">{t.predictions.legendMultipliersTitle}</h3>
            <p>{t.predictions.legendMultipliers}</p>
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-dark mt-3 mb-2">{t.predictions.legendBoostTitle}</h3>
            <p>{t.predictions.legendBoostBody}</p>
          </section>
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-dark mb-2">{t.predictions.legendAwardsTitle}</h3>
            <p>{t.predictions.legendAwardsBody}</p>
          </section>
          <section>
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-dark mb-2">{t.predictions.legendTotalsTitle}</h3>
            <p>{t.predictions.legendTotalsBody}</p>
            <h3 className="text-[11px] uppercase tracking-wide font-bold text-dark mt-3 mb-2">{t.predictions.legendDramaTitle}</h3>
            <p>{t.predictions.legendDramaBody}</p>
          </section>
        </div>
      )}
    </div>
  )
}

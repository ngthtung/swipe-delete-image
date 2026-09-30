import { AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/useI18n'
import type { PhotoAsset, Settings, SizeIndexStatus, Verdict } from '../photos/types'
import { PhotoCard } from './PhotoCard'
import type { EnterVector, ExitVector } from './PhotoCard'
import './Deck.css'

export type DeckStatus =
  | 'loading'
  | 'cards'
  | 'empty'
  | 'done'
  | 'scanning'

export interface DeckCard {
  asset: PhotoAsset
  thumb?: string
}

interface DeckProps {
  status: DeckStatus
  /** Top 3 cards only — everything below is not rendered. */
  cards: DeckCard[]
  settings: Settings
  markedIds: ReadonlySet<string>
  exitVector: ExitVector
  enterFor: { id: string; vector: EnterVector } | null
  swipedCount: number
  hasActiveFilters: boolean
  sizeIndex: SizeIndexStatus | null
  onVerdict: (verdict: Verdict) => void
  onOpenDetail: (asset: PhotoAsset) => void
  onRestart: () => void
  onClearFilters: () => void
  onCancelScan: () => void
}

export function Deck({
  status,
  cards,
  settings,
  markedIds,
  exitVector,
  enterFor,
  swipedCount,
  hasActiveFilters,
  sizeIndex,
  onVerdict,
  onOpenDetail,
  onRestart,
  onClearFilters,
  onCancelScan,
}: DeckProps) {
  const { t, tn, formatCount } = useI18n()

  if (status === 'scanning') {
    const indexed = sizeIndex?.indexed ?? 0
    const total = sizeIndex?.total ?? 0
    const pct = total > 0 ? Math.min(100, (indexed / total) * 100) : 0
    return (
      <div className="deck">
        <div className="deck-state">
          <div className="spinner" />
          <h2>{t('sizeIndex.title')}</h2>
          <p className="deck-state-body">{t('sizeIndex.body')}</p>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="deck-state-count">
            {total > 0
              ? t('sizeIndex.progress', {
                  indexed: formatCount(indexed),
                  total: formatCount(total),
                })
              : t('sizeIndex.waiting')}
          </p>
          <button type="button" className="btn btn-sm" onClick={onCancelScan}>
            {t('sizeIndex.cancel')}
          </button>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="deck">
        <div className="deck-state">
          <div className="spinner" />
          <p className="deck-state-body">{t('deck.loading')}</p>
        </div>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="deck">
        <div className="deck-state">
          <h2>{t('deck.empty.title')}</h2>
          <p className="deck-state-body">{t('deck.empty.body')}</p>
          {hasActiveFilters && (
            <button type="button" className="btn" onClick={onClearFilters}>
              {t('deck.empty.clear')}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="deck">
        <div className="deck-state">
          <div className="done-mark">✓</div>
          <h2>{t('deck.done.title')}</h2>
          <p className="deck-state-body">
            {tn('deck.done.body', swipedCount, {
              count: formatCount(swipedCount),
            })}
          </p>
          <button type="button" className="btn" onClick={onRestart}>
            {t('deck.done.restart')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="deck">
      <div className="deck-stack">
        <AnimatePresence custom={exitVector} initial={false}>
          {cards.map((card, index) => (
            <PhotoCard
              key={card.asset.id}
              asset={card.asset}
              thumb={card.thumb}
              depth={index}
              inAlbum={markedIds.has(card.asset.id)}
              trashDirection={settings.trashDirection}
              verticalSwipes={settings.verticalSwipes}
              enterFrom={
                enterFor && enterFor.id === card.asset.id
                  ? enterFor.vector
                  : null
              }
              onVerdict={onVerdict}
              onOpen={() => onOpenDetail(card.asset)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

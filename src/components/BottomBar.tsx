import { useI18n } from '../i18n/useI18n'
import type { Verdict } from '../photos/types'
import { IconCheck, IconClock, IconHeart, IconTrash, IconUndo } from './Icons'
import './Chrome.css'

interface BottomBarProps {
  reviewCount: number
  reviewBytes: number
  syncing: boolean
  canUndo: boolean
  canSwipe: boolean
  verticalSwipes: boolean
  onUndo: () => void
  onVerdict: (verdict: Verdict) => void
  onOpenReview: () => void
}

export function BottomBar({
  reviewCount,
  reviewBytes,
  syncing,
  canUndo,
  canSwipe,
  verticalSwipes,
  onUndo,
  onVerdict,
  onOpenReview,
}: BottomBarProps) {
  const { t, tn, formatBytes, formatCount } = useI18n()

  return (
    <footer className="bottombar">
      <div className="bottombar-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t('footer.undo')}
        >
          <IconUndo size={19} />
        </button>
        <button
          type="button"
          className="icon-btn action-trash"
          onClick={() => onVerdict('trash')}
          disabled={!canSwipe}
          aria-label={t('footer.trash')}
        >
          <IconTrash size={21} />
        </button>
        {verticalSwipes && (
          <>
            <button
              type="button"
              className="icon-btn action-later"
              onClick={() => onVerdict('later')}
              disabled={!canSwipe}
              aria-label={t('footer.later')}
            >
              <IconClock size={19} />
            </button>
            <button
              type="button"
              className="icon-btn action-favorite"
              onClick={() => onVerdict('favorite')}
              disabled={!canSwipe}
              aria-label={t('footer.favorite')}
            >
              <IconHeart size={19} />
            </button>
          </>
        )}
        <button
          type="button"
          className="icon-btn action-keep"
          onClick={() => onVerdict('keep')}
          disabled={!canSwipe}
          aria-label={t('footer.keep')}
        >
          <IconCheck size={21} />
        </button>
      </div>

      {reviewCount > 0 && (
        <button type="button" className="btn btn-block review-btn" onClick={onOpenReview}>
          <span>
            {tn('footer.review', reviewCount, {
              count: formatCount(reviewCount),
            })}
          </span>
          <span className="review-btn-size">
            {t('footer.reclaim', { size: formatBytes(reviewBytes) })}
          </span>
        </button>
      )}

      {syncing && <span className="bottombar-sync">{t('footer.syncing')}</span>}
    </footer>
  )
}

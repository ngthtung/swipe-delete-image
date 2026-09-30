import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/useI18n'
import type { PhotoAsset, Settings } from '../photos/types'
import { ConfirmDialog } from './ConfirmDialog'
import { IconClose, IconPhotos, IconPlay, IconScreenshot } from './Icons'
import './ReviewScreen.css'

/** Thumbnails requested per batch while scrolling the grid. */
const PAGE = 48

interface ReviewScreenProps {
  assets: PhotoAsset[]
  bytes: number
  albumName: string
  trashDirection: Settings['trashDirection']
  thumbs: ReadonlyMap<string, string>
  ensureThumbs: (ids: string[]) => void
  loading: boolean
  error: boolean
  deleting: boolean
  onUnmark: (id: string) => void
  onDelete: () => void
  onClose: () => void
}

export function ReviewScreen({
  assets,
  bytes,
  albumName,
  trashDirection,
  thumbs,
  ensureThumbs,
  loading,
  error,
  deleting,
  onUnmark,
  onDelete,
  onClose,
}: ReviewScreenProps) {
  const { t, tn, formatBytes, formatCount, formatDuration, photos } = useI18n()
  const [limit, setLimit] = useState(PAGE)
  const [confirming, setConfirming] = useState(false)
  const [showPhotosNote, setShowPhotosNote] = useState(false)

  const visible = assets.slice(0, limit)
  const visibleKey = visible.map((a) => a.id).join(' ')

  useEffect(() => {
    if (visibleKey) ensureThumbs(visibleKey.split(' '))
  }, [ensureThumbs, visibleKey])

  const trashSide = t(
    trashDirection === 'left' ? 'common.left' : 'common.right',
  )

  return (
    <div className="sheet review">
      <div className="sheet-header">
        <div>
          <div className="sheet-title">{t('review.title')}</div>
          <div className="sheet-subtitle">
            {t('review.subtitle', {
              count: photos(assets.length),
              size: formatBytes(bytes),
            })}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <IconClose size={20} />
        </button>
      </div>

      <div
        className="sheet-body review-body"
        onScroll={(event) => {
          const el = event.currentTarget
          if (
            el.scrollTop + el.clientHeight > el.scrollHeight - 320 &&
            limit < assets.length
          ) {
            setLimit((value) => value + PAGE)
          }
        }}
      >
        {loading && assets.length === 0 && (
          <div className="review-state">
            <div className="spinner" />
            <p className="deck-state-body">{t('review.loading')}</p>
          </div>
        )}

        {error && (
          <p className="review-error">{t('review.error', { album: albumName })}</p>
        )}

        {!loading && assets.length === 0 && (
          <div className="review-state">
            <h2>{t('review.empty.title')}</h2>
            <p className="deck-state-body">
              {t('review.empty.body', { trashSide, album: albumName })}
            </p>
          </div>
        )}

        {assets.length > 0 && (
          <>
            <p className="group-hint">{t('review.hint')}</p>
            <div className="review-grid">
              {visible.map((asset) => (
                <button
                  type="button"
                  key={asset.id}
                  className="review-cell"
                  onClick={() => onUnmark(asset.id)}
                >
                  {thumbs.has(asset.id) ? (
                    <img src={thumbs.get(asset.id)} alt="" draggable={false} />
                  ) : (
                    <span className="review-cell-skeleton" />
                  )}
                  <span className="review-cell-remove">
                    <IconClose size={13} />
                  </span>
                  {asset.mediaType === 'video' && (
                    <span className="review-cell-tag">
                      <IconPlay size={11} />
                      {formatDuration(asset.duration)}
                    </span>
                  )}
                  {asset.isScreenshot && asset.mediaType !== 'video' && (
                    <span className="review-cell-tag">
                      <IconScreenshot size={11} />
                    </span>
                  )}
                  <span className="review-cell-size">
                    {formatBytes(asset.byteSize)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="sheet-footer">
        {showPhotosNote && (
          <p className="review-note">
            {t('review.openPhotos.note', { album: albumName })}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => setShowPhotosNote((value) => !value)}
        >
          <IconPhotos size={18} />
          {t('review.openPhotos')}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-block"
          disabled={assets.length === 0 || deleting}
          onClick={() => setConfirming(true)}
        >
          {deleting
            ? t('review.deleting')
            : tn('review.delete', assets.length, {
                count: formatCount(assets.length),
              })}
        </button>
      </div>

      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            title={tn('confirm.title', assets.length, {
              count: formatCount(assets.length),
            })}
            body={t('confirm.body')}
            detail={t('confirm.freed', { size: formatBytes(bytes) })}
            confirmLabel={t('confirm.ok')}
            cancelLabel={t('common.cancel')}
            destructive
            busy={deleting}
            onConfirm={() => {
              setConfirming(false)
              onDelete()
            }}
            onCancel={() => setConfirming(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

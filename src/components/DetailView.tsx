import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '../i18n/useI18n'
import type { PhotoAsset } from '../photos/types'
import {
  IconCloud,
  IconClose,
  IconHeartFilled,
  IconPlay,
  IconScreenshot,
} from './Icons'
import './DetailView.css'

interface DetailViewProps {
  asset: PhotoAsset
  /** Thumbnail shown instantly while the full image decodes. */
  thumb?: string
  loadFullImage: (id: string) => Promise<string>
  onClose: () => void
}

export function DetailView({
  asset,
  thumb,
  loadFullImage,
  onClose,
}: DetailViewProps) {
  const { t, formatBytes, formatDate, formatDuration } = useI18n()
  const [fullSrc, setFullSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFullSrc(null)
    setFailed(false)
    loadFullImage(asset.id)
      .then((dataUrl) => {
        if (!cancelled) setFullSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [asset.id, loadFullImage])

  return (
    <motion.div
      className="detail"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <button
        type="button"
        className="icon-btn detail-close"
        onClick={onClose}
        aria-label={t('common.close')}
      >
        <IconClose size={20} />
      </button>

      <div className="detail-stage">
        {(fullSrc ?? thumb) ? (
          <img
            className={`detail-img${fullSrc ? '' : ' detail-img-blur'}`}
            src={fullSrc ?? thumb}
            alt=""
            draggable={false}
          />
        ) : (
          <div className="spinner" />
        )}
        {!fullSrc && !failed && (
          <span className="detail-status">{t('detail.loading')}</span>
        )}
        {failed && !thumb && (
          <span className="detail-status">{t('detail.failed')}</span>
        )}
      </div>

      <div className="detail-meta">
        <div className="detail-meta-row">
          <strong>{formatDate(asset.creationDate)}</strong>
          <span>{formatBytes(asset.byteSize)}</span>
          <span>
            {t('detail.dimensions', {
              width: asset.width,
              height: asset.height,
            })}
          </span>
        </div>
        <div className="detail-tags">
          {asset.mediaType === 'video' && (
            <span className="tag">
              <IconPlay size={13} />
              {t('detail.video')} · {formatDuration(asset.duration)}
            </span>
          )}
          {asset.isScreenshot && (
            <span className="tag">
              <IconScreenshot size={13} />
              {t('card.screenshot')}
            </span>
          )}
          {asset.isFavorite && (
            <span className="tag tag-favorite">
              <IconHeartFilled size={13} />
              {t('card.favorite')}
            </span>
          )}
          {asset.isCloudOnly && (
            <span className="tag">
              <IconCloud size={13} />
              {t('detail.cloudOnly')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

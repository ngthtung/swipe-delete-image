import { motion } from 'framer-motion'
import { useI18n } from '../i18n/useI18n'
import type { PhotoAsset, Settings, Verdict } from '../photos/types'
import { useCardSwipe } from '../hooks/useSwipeDeck'
import {
  IconCloud,
  IconHeartFilled,
  IconPlay,
  IconScreenshot,
  IconTrash,
} from './Icons'
import './PhotoCard.css'

export interface ExitVector {
  x: number
  y: number
  rotate: number
}

export interface EnterVector {
  x: number
  y: number
}

interface PhotoCardProps {
  asset: PhotoAsset
  thumb?: string
  /** 0 = top card. Only the top card is interactive. */
  depth: number
  inAlbum: boolean
  trashDirection: Settings['trashDirection']
  verticalSwipes: boolean
  /** Set when the card comes back through undo, so it flies back in. */
  enterFrom?: EnterVector | null
  onVerdict: (verdict: Verdict) => void
  onOpen: () => void
}

const exitVariants = {
  exit: (vector: ExitVector) => ({
    x: vector.x,
    y: vector.y,
    rotate: vector.rotate,
    opacity: 0,
    transition: { duration: 0.28, ease: [0.3, 0, 0.2, 1] as const },
  }),
}

export function PhotoCard({
  asset,
  thumb,
  depth,
  inAlbum,
  trashDirection,
  verticalSwipes,
  enterFrom,
  onVerdict,
  onOpen,
}: PhotoCardProps) {
  const { t, formatBytes, formatDate, formatDuration } = useI18n()
  const interactive = depth === 0
  const swipe = useCardSwipe({ trashDirection, verticalSwipes, onCommit: onVerdict })

  const scale = 1 - depth * 0.05
  // Cards behind peek out *above* the top card: peeking downwards would sit
  // on top of the hint line below the stack.
  const offsetY = -depth * 12
  const keepSide = trashDirection === 'left' ? 'right' : 'left'
  const trashSide = trashDirection === 'left' ? 'left' : 'right'

  return (
    <motion.div
      className="card-slot"
      style={{ zIndex: 30 - depth }}
      initial={
        enterFrom
          ? { x: enterFrom.x, y: enterFrom.y, scale, opacity: 0.4 }
          : { x: 0, y: offsetY + 10, scale: scale - 0.03, opacity: 0 }
      }
      animate={{ x: 0, y: offsetY, scale, opacity: 1 }}
      exit="exit"
      variants={exitVariants}
      transition={{ type: 'spring', stiffness: 360, damping: 34 }}
    >
      <motion.div
        className="card"
        style={{ x: swipe.x, y: swipe.y, rotate: swipe.rotate }}
        drag={interactive ? (verticalSwipes ? true : 'x') : false}
        dragElastic={0.6}
        dragMomentum={false}
        onDragStart={swipe.onDragStart}
        onDrag={swipe.onDrag}
        onDragEnd={swipe.onDragEnd}
        // onTap (not onClick): the card owns the pointer while dragging, so the
        // gesture layer is the only thing that can tell a tap from a swipe.
        onTap={() => {
          if (!interactive || swipe.wasDragged()) return
          onOpen()
        }}
      >
        <div className="card-media">
          {thumb ? (
            <img className="card-img" src={thumb} alt="" draggable={false} />
          ) : (
            <div className="card-skeleton" />
          )}
        </div>

        {interactive && (
          <>
            <motion.div
              className="card-tint tint-keep"
              style={{ opacity: swipe.keepTint }}
            />
            <motion.div
              className="card-tint tint-trash"
              style={{ opacity: swipe.trashTint }}
            />
            {verticalSwipes && (
              <>
                <motion.div
                  className="card-tint tint-favorite"
                  style={{ opacity: swipe.favoriteTint }}
                />
                <motion.div
                  className="card-tint tint-later"
                  style={{ opacity: swipe.laterTint }}
                />
              </>
            )}

            <motion.div
              className={`card-stamp stamp-keep stamp-${keepSide}`}
              style={{ opacity: swipe.keepOpacity }}
            >
              {t('card.badge.keep')}
            </motion.div>
            <motion.div
              className={`card-stamp stamp-trash stamp-${trashSide}`}
              style={{ opacity: swipe.trashOpacity }}
            >
              {t('card.badge.trash')}
            </motion.div>
            {verticalSwipes && (
              <>
                <motion.div
                  className="card-stamp stamp-favorite"
                  style={{ opacity: swipe.favoriteOpacity }}
                >
                  {t('card.badge.favorite')}
                </motion.div>
                <motion.div
                  className="card-stamp stamp-later"
                  style={{ opacity: swipe.laterOpacity }}
                >
                  {t('card.badge.later')}
                </motion.div>
              </>
            )}
          </>
        )}

        <div className="card-tags">
          {asset.mediaType === 'video' && (
            <span className="tag">
              <IconPlay size={13} />
              {formatDuration(asset.duration)}
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
            </span>
          )}
          {asset.isCloudOnly && (
            <span className="tag">
              <IconCloud size={13} />
              {t('card.cloud')}
            </span>
          )}
          {inAlbum && (
            <span className="tag tag-trash">
              <IconTrash size={13} />
              {t('card.inAlbum')}
            </span>
          )}
        </div>

        <div className="card-meta">
          <span>{formatDate(asset.creationDate)}</span>
          <span className="card-meta-dot">·</span>
          <span>{formatBytes(asset.byteSize)}</span>
          <span className="card-meta-dim">
            {t('detail.dimensions', {
              width: asset.width,
              height: asset.height,
            })}
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

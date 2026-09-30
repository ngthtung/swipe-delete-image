import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { PhotoFilters, Settings, SizeIndexStatus } from '../photos/types'
import {
  MB,
  activeFilterCount,
  detectDatePreset,
  detectSizePreset,
  fromDateInputValue,
  oneYearAgo,
  startOfThisYear,
  toDateInputValue,
} from '../hooks/filters'
import type { DatePreset, SizePreset } from '../hooks/filters'
import { IconClose } from './Icons'
import './FilterSheet.css'

interface FilterSheetProps {
  filters: PhotoFilters
  sortBy: Settings['sortBy']
  sortOrder: Settings['sortOrder']
  sizeIndex: SizeIndexStatus | null
  onChangeFilters: (filters: PhotoFilters) => void
  onChangeSort: (sortBy: Settings['sortBy'], sortOrder: Settings['sortOrder']) => void
  /** Called when the user picks something that needs the size index. */
  onNeedSizeIndex: () => void
  onClose: () => void
}

export function FilterSheet({
  filters,
  sortBy,
  sortOrder,
  sizeIndex,
  onChangeFilters,
  onChangeSort,
  onNeedSizeIndex,
  onClose,
}: FilterSheetProps) {
  const { t, tn, formatBytes, formatCount } = useI18n()
  const datePreset = detectDatePreset(filters)
  const sizePreset = detectSizePreset(filters)
  const [customMin, setCustomMin] = useState(
    filters.minByteSize ? String(Math.round(filters.minByteSize / MB)) : '',
  )
  const [customMax, setCustomMax] = useState(
    filters.maxByteSize ? String(Math.round(filters.maxByteSize / MB)) : '',
  )

  const count = activeFilterCount(filters)
  const indexReady = sizeIndex?.state === 'ready'

  const patch = (next: Partial<PhotoFilters>) => {
    onChangeFilters({ ...filters, ...next })
  }

  const applyDatePreset = (preset: DatePreset) => {
    if (preset === 'all') {
      patch({ dateFrom: undefined, dateTo: undefined })
    } else if (preset === 'thisYear') {
      patch({ dateFrom: startOfThisYear(), dateTo: undefined })
    } else if (preset === 'older1y') {
      patch({ dateFrom: undefined, dateTo: oneYearAgo() })
    } else {
      patch({
        dateFrom: filters.dateFrom ?? startOfThisYear(),
        dateTo: filters.dateTo,
      })
    }
  }

  const applySizePreset = (preset: SizePreset) => {
    if (preset !== 'all') onNeedSizeIndex()
    if (preset === 'all') {
      setCustomMin('')
      setCustomMax('')
      patch({ minByteSize: undefined, maxByteSize: undefined })
      return
    }
    if (preset === 'custom') {
      patch({
        minByteSize: filters.minByteSize ?? 5 * MB,
        maxByteSize: filters.maxByteSize,
      })
      return
    }
    const mb = preset === 'over5' ? 5 : preset === 'over20' ? 20 : 100
    setCustomMin(String(mb))
    setCustomMax('')
    patch({ minByteSize: mb * MB, maxByteSize: undefined })
  }

  const commitCustomSize = (minText: string, maxText: string) => {
    const min = Number.parseFloat(minText)
    const max = Number.parseFloat(maxText)
    const minBytes = Number.isFinite(min) && min > 0 ? min * MB : undefined
    const maxBytes = Number.isFinite(max) && max > 0 ? max * MB : undefined
    if (minBytes !== undefined || maxBytes !== undefined) onNeedSizeIndex()
    patch({ minByteSize: minBytes, maxByteSize: maxBytes })
  }

  const summary: string[] = []
  if (filters.mediaType && filters.mediaType !== 'all') {
    summary.push(
      t(filters.mediaType === 'image' ? 'filters.media.image' : 'filters.media.video'),
    )
  }
  if (filters.screenshotsOnly) summary.push(t('filters.screenshotsOnly'))
  if (filters.dateFrom !== undefined || filters.dateTo !== undefined) {
    summary.push(
      datePreset === 'thisYear'
        ? t('filters.date.thisYear')
        : datePreset === 'older1y'
          ? t('filters.date.older1y')
          : t('filters.date.custom'),
    )
  }
  if (filters.minByteSize !== undefined) {
    summary.push(t('filters.size.over', { size: formatBytes(filters.minByteSize) }))
  }

  return (
    <div className="sheet">
      <div className="sheet-header">
        <div>
          <div className="sheet-title">{t('filters.title')}</div>
          <div className="sheet-subtitle">
            {count > 0
              ? tn('filters.active', count, { count: formatCount(count) })
              : t('filters.summary.none')}
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

      <div className="sheet-body">
        {summary.length > 0 && (
          <div className="filter-summary">
            {summary.map((item) => (
              <span className="chip chip-on" key={item}>
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="group">
          <span className="group-label">{t('filters.media')}</span>
          <div className="segmented">
            {(['all', 'image', 'video'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`seg${(filters.mediaType ?? 'all') === value ? ' seg-on' : ''}`}
                onClick={() => patch({ mediaType: value })}
              >
                {t(
                  value === 'all'
                    ? 'filters.media.all'
                    : value === 'image'
                      ? 'filters.media.image'
                      : 'filters.media.video',
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <div className="row">
            <span className="row-text">
              <span className="row-label">{t('filters.screenshotsOnly')}</span>
            </span>
            <button
              type="button"
              className={`switch${filters.screenshotsOnly ? ' switch-on' : ''}`}
              role="switch"
              aria-checked={Boolean(filters.screenshotsOnly)}
              aria-label={t('filters.screenshotsOnly')}
              onClick={() =>
                patch({ screenshotsOnly: filters.screenshotsOnly ? undefined : true })
              }
            />
          </div>
          <span className="group-hint">{t('filters.screenshotsOnly.hint')}</span>
        </div>

        <div className="group">
          <span className="group-label">{t('filters.date')}</span>
          <div className="segmented segmented-wrap">
            {(['all', 'thisYear', 'older1y', 'custom'] as const).map((preset) => (
              <button
                type="button"
                key={preset}
                className={`seg${datePreset === preset ? ' seg-on' : ''}`}
                onClick={() => applyDatePreset(preset)}
              >
                {t(
                  preset === 'all'
                    ? 'filters.date.all'
                    : preset === 'thisYear'
                      ? 'filters.date.thisYear'
                      : preset === 'older1y'
                        ? 'filters.date.older1y'
                        : 'filters.date.custom',
                )}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="filter-inputs">
              <label className="filter-field">
                <span>{t('filters.date.from')}</span>
                <input
                  className="field"
                  type="date"
                  value={toDateInputValue(filters.dateFrom)}
                  onChange={(event) =>
                    patch({
                      dateFrom: fromDateInputValue(event.target.value, 'start'),
                    })
                  }
                />
              </label>
              <label className="filter-field">
                <span>{t('filters.date.to')}</span>
                <input
                  className="field"
                  type="date"
                  value={toDateInputValue(filters.dateTo)}
                  onChange={(event) =>
                    patch({ dateTo: fromDateInputValue(event.target.value, 'end') })
                  }
                />
              </label>
            </div>
          )}
        </div>

        <div className="group">
          <span className="group-label">{t('filters.size')}</span>
          <div className="segmented segmented-wrap">
            {(['all', 'over5', 'over20', 'over100', 'custom'] as const).map(
              (preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`seg${sizePreset === preset ? ' seg-on' : ''}`}
                  onClick={() => applySizePreset(preset)}
                >
                  {preset === 'all'
                    ? t('filters.size.all')
                    : preset === 'custom'
                      ? t('filters.size.custom')
                      : t('filters.size.over', {
                          size: formatBytes(
                            (preset === 'over5' ? 5 : preset === 'over20' ? 20 : 100) *
                              MB,
                          ),
                        })}
                </button>
              ),
            )}
          </div>
          {sizePreset === 'custom' && (
            <div className="filter-inputs">
              <label className="filter-field">
                <span>{t('filters.size.min')}</span>
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={customMin}
                  onChange={(event) => {
                    setCustomMin(event.target.value)
                    commitCustomSize(event.target.value, customMax)
                  }}
                />
              </label>
              <label className="filter-field">
                <span>{t('filters.size.max')}</span>
                <input
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={customMax}
                  onChange={(event) => {
                    setCustomMax(event.target.value)
                    commitCustomSize(customMin, event.target.value)
                  }}
                />
              </label>
            </div>
          )}
          {!indexReady && (
            <span className="group-hint">{t('filters.size.needsIndex')}</span>
          )}
        </div>

        <div className="group">
          <span className="group-label">{t('filters.sort')}</span>
          <div className="segmented">
            {(['date', 'size'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`seg${sortBy === value ? ' seg-on' : ''}`}
                onClick={() => {
                  if (value === 'size') onNeedSizeIndex()
                  onChangeSort(value, sortOrder)
                }}
              >
                {t(value === 'date' ? 'filters.sort.date' : 'filters.sort.size')}
              </button>
            ))}
          </div>
          <div className="segmented">
            {(['newest', 'oldest'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`seg${sortOrder === value ? ' seg-on' : ''}`}
                onClick={() => onChangeSort(sortBy, value)}
              >
                {sortBy === 'size'
                  ? t(
                      value === 'newest'
                        ? 'filters.order.largest'
                        : 'filters.order.smallest',
                    )
                  : t(
                      value === 'newest'
                        ? 'filters.order.newest'
                        : 'filters.order.oldest',
                    )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet-footer">
        <button
          type="button"
          className="btn btn-block"
          disabled={count === 0 && sortBy === 'date' && sortOrder === 'newest'}
          onClick={() => {
            setCustomMin('')
            setCustomMax('')
            onChangeFilters({ mediaType: 'all' })
            onChangeSort('date', 'newest')
          }}
        >
          {t('filters.clear')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onClose}
        >
          {t('filters.done')}
        </button>
      </div>
    </div>
  )
}

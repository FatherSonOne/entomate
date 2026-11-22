import React from 'react'

export interface DateStampProps {
  date: Date
  /** Show the year under the month when it isn't the current year. */
  showYear?: boolean
}

/** First column of an index list: a big mono day over a mono caps month. */
export function DateStamp({ date, showYear }: DateStampProps): React.ReactElement {
  const year = date.getFullYear()
  const withYear = showYear ?? year !== new Date().getFullYear()
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return (
    <time className="bs-date" dateTime={date.toISOString()}>
      <b>{String(date.getDate()).padStart(2, '0')}</b>
      <span>{withYear ? `${month} ${String(year).slice(2)}` : month}</span>
    </time>
  )
}

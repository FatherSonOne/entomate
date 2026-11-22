import React from 'react'
import { highlightParts } from '../../services/searchEngine'
import type { Range } from '../../services/searchEngine'

/** Text with the matched words marked (no HTML from the server is ever rendered). */
export function Highlight({ text, hits }: { text: string; hits: ReadonlyArray<Range> }): React.ReactElement {
  return (
    <>
      {highlightParts(text, hits).map((p, i) => (p.hit ? <mark key={i} className="bs-hit">{p.text}</mark> : <React.Fragment key={i}>{p.text}</React.Fragment>))}
    </>
  )
}

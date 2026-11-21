import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { guideSections, CATEGORIES, guideVersion, guideUpdated } from '../UsersGuide/guideData'
import AnimatedIcon from '../icons/AnimatedIcons'

/**
 * Public User Guide section of the landing page (section 06).
 * Moved out of the old LandingPage.jsx unchanged in behaviour: a master toggle,
 * collapsible categories and entries, steps, sub-features, tips and use cases,
 * all driven by UsersGuide/guideData.
 */
export default function LandingGuide() {
  const [guideOpen, setGuideOpen] = useState(false)          // master toggle
  const [openCats, setOpenCats] = useState(new Set())         // open category indices
  const [openSections, setOpenSections] = useState(new Set()) // open section ids

  const toggleCat = useCallback((idx) => {
    setOpenCats(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }, [])

  const toggleSection = useCallback((id) => {
    setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  const expandAllGuide = useCallback(() => {
    setOpenCats(new Set(CATEGORIES.map((_, i) => i)))
    setOpenSections(new Set(guideSections.map(s => s.id)))
  }, [])

  const collapseAllGuide = useCallback(() => {
    setOpenCats(new Set())
    setOpenSections(new Set())
  }, [])

  return (
    <section className="lc-pad lc-wrap lc-guide" id="guide" aria-labelledby="lc-guide-h">
      <div className="lc-sh">
        <span className="lc-n">06</span>
        <h2 id="lc-guide-h">The user guide, in the open.</h2>
        <p>{guideSections.length} sections covering every feature in Entomate. Browse it here, or sign in for the full interactive guide.</p>
      </div>

      {/* Master toggle */}
      <div className="guide-master-toggle">
        <button
          className={`guide-toggle-btn${guideOpen ? ' is-open' : ''}`}
          onClick={() => setGuideOpen(prev => !prev)}
          aria-expanded={guideOpen}
        >
          <span className="guide-toggle-icon">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="ani-icon">
              <path d="M6 4 L20 4 L26 10 L26 28 L6 28 Z" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
              <path d="M20 4 L20 10 L26 10" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
              <line x1="10" y1="16" x2="22" y2="16" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="10" y1="20" x2="19" y2="20" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="10" y1="24" x2="16" y2="24" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="guide-toggle-text">
            {guideOpen ? 'Hide User Guide' : 'Open User Guide'}
          </span>
          <span className="guide-toggle-meta">v{guideVersion} &middot; {guideUpdated}</span>
          <span className={`guide-chevron${guideOpen ? ' is-open' : ''}`}>&rsaquo;</span>
        </button>

        {guideOpen && (
          <div className="guide-expand-controls">
            <button className="guide-ctrl-btn" onClick={expandAllGuide}>Expand All</button>
            <button className="guide-ctrl-btn" onClick={collapseAllGuide}>Collapse All</button>
          </div>
        )}
      </div>

      {/* Collapsible guide body */}
      {guideOpen && (
        <div className="guide-body">
          {CATEGORIES.map((cat, catIdx) => (
            <div key={catIdx} className="guide-category">
              <button
                className={`guide-cat-header${openCats.has(catIdx) ? ' is-open' : ''}`}
                onClick={() => toggleCat(catIdx)}
                aria-expanded={openCats.has(catIdx)}
              >
                <span className="guide-cat-label">{cat.label}</span>
                <span className="guide-cat-count">{cat.ids.length}</span>
                <span className={`guide-chevron${openCats.has(catIdx) ? ' is-open' : ''}`}>&rsaquo;</span>
              </button>

              {openCats.has(catIdx) && (
                <div className="guide-cat-body">
                  {cat.ids.map(sectionId => {
                    const section = guideSections.find(s => s.id === sectionId)
                    if (!section) return null
                    const isOpen = openSections.has(sectionId)

                    return (
                      <div key={sectionId} className="guide-entry">
                        <button
                          className={`guide-entry-header${isOpen ? ' is-open' : ''}`}
                          onClick={() => toggleSection(sectionId)}
                          aria-expanded={isOpen}
                        >
                          <span className="guide-entry-icon" aria-hidden="true"><AnimatedIcon name={section.icon} size={18} /></span>
                          <span className="guide-entry-title">{section.title}</span>
                          {section.badge && (
                            <span className={`guide-badge guide-badge--${section.badge === 'New' ? 'new' : 'updated'}`}>
                              {section.badge}
                            </span>
                          )}
                          <span className={`guide-chevron${isOpen ? ' is-open' : ''}`}>&rsaquo;</span>
                        </button>

                        {isOpen && (
                          <div className="guide-entry-body">
                            <p className="guide-entry-summary">{section.summary}</p>

                            {/* Steps */}
                            {section.steps?.length > 0 && (
                              <div className="guide-steps">
                                <div className="guide-steps-label">How to use it</div>
                                <ol className="guide-step-list">
                                  {section.steps.map((step, i) => (
                                    <li key={i} className="guide-step-item">
                                      <span className="guide-step-num">{i + 1}</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Subsections */}
                            {section.subsections?.length > 0 && (
                              <div className="guide-subsections">
                                <div className="guide-steps-label">Features &amp; Details</div>
                                {section.subsections.map(sub => (
                                  <details key={sub.id} className="guide-sub-detail">
                                    <summary className="guide-sub-summary">{sub.title}</summary>
                                    <div className="guide-sub-body">
                                      {sub.description && <p className="guide-sub-desc">{sub.description}</p>}
                                      <ol className="guide-step-list guide-step-list--sm">
                                        {sub.steps.map((step, i) => (
                                          <li key={i} className="guide-step-item guide-step-item--sm">
                                            <span className="guide-step-num guide-step-num--sm">{i + 1}</span>
                                            <span>{step}</span>
                                          </li>
                                        ))}
                                      </ol>
                                      {sub.note && <div className="guide-note"><span className="guide-note-sq" aria-hidden="true"></span>{sub.note}</div>}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            )}

                            {/* Tips */}
                            {section.tips?.length > 0 && (
                              <div className="guide-tips">
                                <div className="guide-steps-label">Pro Tips</div>
                                {section.tips.map((tip, i) => (
                                  <div key={i} className="guide-tip">
                                    <span className="guide-tip-arrow">&rarr;</span>
                                    <span>{tip}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Use cases */}
                            {section.useCases?.length > 0 && (
                              <div className="guide-subsections">
                                <div className="guide-steps-label">Use Cases</div>
                                {section.useCases.map(uc => (
                                  <details key={uc.id} className="guide-sub-detail guide-sub-detail--uc">
                                    <summary className="guide-sub-summary">{uc.title}</summary>
                                    <div className="guide-sub-body">
                                      <p className="guide-sub-desc"><strong>Scenario:</strong> {uc.scenario}</p>
                                      <ol className="guide-step-list guide-step-list--sm">
                                        {uc.steps.map((step, i) => (
                                          <li key={i} className="guide-step-item guide-step-item--sm">
                                            <span className="guide-step-num guide-step-num--sm">{i + 1}</span>
                                            <span>{step}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                  </details>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      <div className="guide-cta">
        <Link to="/sign-in" className="lc-btn">Full interactive guide <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  )
}

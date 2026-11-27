import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LOGO_MOTIONS, renderLogoMotion } from './logoMotion'
import { CIRCUIT_FINISH, CIRCUIT_MARK_IDS, renderCircuitMark } from './circuitMarks'
import { APERTURE_ID, BLOOM_ID, CONSTELLATION_ID, FACET_HANDS_ID, IGNITION_ID, NEURAL_CORE_ID, NODE_HANDS_ID, ORBIT_ID, ORBITAL_NETWORK_ID, RELAY_ID, RELAY_ORBITS_ID, RIBBON_CATALYST_ID, RIFT_ID, SIGNAL_CASCADE_ID, SLIPSTREAM_ID, THRESHOLD_ID, isLogoId, logoAsset, logoById, useLogoSystem } from '../services/logoSystem'
import relaySvg from '../assets/relay.svg?raw'
import relayOrbitsSvg from '../assets/relay-orbits.svg?raw'
import slipstreamSvg from '../assets/slipstream.svg?raw'
import thresholdSvg from '../assets/threshold.svg?raw'
import nodeHandsSvg from '../assets/node-hands.svg?raw'
import facetHandsSvg from '../assets/facet-hands.svg?raw'
import riftSvg from '../assets/rift.svg?raw'
import { createCircuitCrownTimeline } from './circuitCrownMotion'
import { createCircuitEFlowTimeline } from './circuitEFlow'
import { createOrbitTimeline } from './orbitMotion'
import { createOrbitalNetworkTimeline } from './orbitalNetworkMotion'
import { createConstellationTimeline } from './constellationMotion'
import { createSlipstreamTimeline } from './slipstreamMotion'
import { createThresholdTimeline } from './thresholdMotion'
import { createRelayTimeline } from './relayMotion'
import { createRelayOrbitsTimeline } from './relayOrbitsMotion'
import { createNodeHandsTimeline } from './nodeHandsMotion'
import { createFacetHandsTimeline } from './facetHandsMotion'
import { createIgnitionTimeline } from './ignitionMotion'
import { createApertureTimeline } from './apertureMotion'
import { createBloomTimeline } from './bloomMotion'
import { createRiftTimeline } from './riftMotion'
import { createNeuralCoreTimeline, renderNeuralCoreLoading } from './neuralCoreMotion'
import { createRibbonCatalystTimeline } from './ribbonCatalystMotion'
import { createSignalCascadeTimeline } from './signalCascadeMotion'
import { useMotionPlayback } from './bench/motion'
import './AnimatedLoadingLogo.css'

const VECTOR_LOADING = {
  [RELAY_ORBITS_ID]: { svg: relayOrbitsSvg, namespace: 'relay-orbits', createTimeline: createRelayOrbitsTimeline },
  [RELAY_ID]: { svg: relaySvg, namespace: 'relay-mark', createTimeline: createRelayTimeline },
  [THRESHOLD_ID]: { svg: thresholdSvg, namespace: 'threshold', createTimeline: createThresholdTimeline },
  [SLIPSTREAM_ID]: { svg: slipstreamSvg, namespace: 'slipstream', createTimeline: createSlipstreamTimeline },
  [RIFT_ID]: { svg: riftSvg, namespace: 'rift-mark', createTimeline: createRiftTimeline },
  [NEURAL_CORE_ID]: { render: renderNeuralCoreLoading, createTimeline: createNeuralCoreTimeline },
  [NODE_HANDS_ID]: {
    // Leave room under the wrists for the boot progress track.
    svg: nodeHandsSvg.replace('viewBox="0 0 800 800"', 'viewBox="-80 -60 960 960"'),
    namespace: 'node-hands',
    createTimeline: createNodeHandsTimeline,
  },
  [FACET_HANDS_ID]: {
    svg: facetHandsSvg.replace('viewBox="0 0 704 704"', 'viewBox="-24 -24 752 752"'),
    namespace: 'facet-hands',
    createTimeline: createFacetHandsTimeline,
  },
}

const RASTER_LOADING = {
  [ORBIT_ID]: createOrbitTimeline,
  [ORBITAL_NETWORK_ID]: createOrbitalNetworkTimeline,
  [CONSTELLATION_ID]: createConstellationTimeline,
  [IGNITION_ID]: createIgnitionTimeline,
  [APERTURE_ID]: createApertureTimeline,
  [BLOOM_ID]: createBloomTimeline,
  [RIBBON_CATALYST_ID]: createRibbonCatalystTimeline,
  [SIGNAL_CASCADE_ID]: createSignalCascadeTimeline,
}

const CIRCUIT_TIMELINES = {
  'circuit-e': createCircuitEFlowTimeline,
  'circuit-spire': createCircuitCrownTimeline,
}

/**
 * The animated mark of a logo system. Uses the system picked in
 * Settings > Appearance unless `logoId` is given (the picker's previews).
 * `size` picks the artwork resolution: 512 for small stages, 1024 full screen.
 * `controls={false}` drops the Pause key (previews inside another control).
 */
export default function AnimatedLoadingLogo({ logoId, size = 512, controls = true }) {
  const picked = useLogoSystem().id
  const id = isLogoId(logoId) ? logoId : picked
  const vector = VECTOR_LOADING[id]
  const createRasterTimeline = RASTER_LOADING[id]
  const createSvgTimeline = CIRCUIT_TIMELINES[id] ?? vector?.createTimeline
  const hasTimeline = Boolean(createRasterTimeline || createSvgTimeline)
  const svgId = useId().replaceAll(':', '-')
  const artRef = useRef(null)
  const [playing, setPlaying, reduced] = useMotionPlayback()
  const [supportsSmil, setSupportsSmil] = useState(true)
  const [unavailableId, setUnavailableId] = useState(null)
  const rasterUnavailable = id === unavailableId
  const supported = createRasterTimeline ? !rasterUnavailable : Boolean(createSvgTimeline) || supportsSmil
  const [failed, setFailed] = useState(false)
  const markup = useMemo(() => {
    // The card, drawer, and full-screen preview can share the page at once.
    if (vector?.render) return vector.render(logoAsset(id, size), svgId)
    if (vector) return vector.svg.replaceAll(`${vector.namespace}-`, `${vector.namespace}${svgId}-`)
    if (createRasterTimeline) {
      return `<svg viewBox="0 0 1000 1000" role="img" aria-label="${logoById(id).name}"><image href="${logoAsset(id, size)}" width="1000" height="1000" /></svg>`
    }
    return CIRCUIT_MARK_IDS.includes(id)
      ? renderCircuitMark(id, CIRCUIT_FINISH, 6, LOGO_MOTIONS[id].name)
      : renderLogoMotion(id, logoAsset(id, size), 6, LOGO_MOTIONS[id].name)
  }, [id, vector, createRasterTimeline, size, svgId])

  useEffect(() => { setFailed(false) }, [id])

  useLayoutEffect(() => {
    const svg = artRef.current?.querySelector('svg')
    if (!svg || failed) return
    if (!hasTimeline && typeof svg.pauseAnimations !== 'function') {
      setSupportsSmil(false)
      return
    }
    svg.classList.toggle('motion-opt-in', reduced && playing)
    // Show the complete resting mark when paused or reduced motion is on.
    svg.classList.toggle('motion-still', !playing)
    if (hasTimeline && !playing) return
    if (rasterUnavailable) return

    const timeline = createRasterTimeline
      ? createRasterTimeline(svg, () => setUnavailableId(id))
      : createSvgTimeline?.(svg)
    const pause = () => (timeline ? timeline.pause() : svg.pauseAnimations())
    const play = () => (timeline ? timeline.play() : svg.unpauseAnimations())
    const canObserve = typeof IntersectionObserver === 'function'
    let visible = !canObserve
    pause()
    const sync = () => {
      if (playing && visible && !document.hidden) play()
      else pause()
    }
    const observer = canObserve ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    }, { threshold: 0.02 }) : null
    const image = svg.querySelector('image')
    const error = () => setFailed(true)
    image?.addEventListener('error', error)
    observer?.observe(svg)
    if (!observer) sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', sync)
      image?.removeEventListener('error', error)
      if (timeline) timeline.revert()
      else pause()
    }
  }, [playing, reduced, failed, id, createRasterTimeline, createSvgTimeline, hasTimeline, rasterUnavailable, markup])

  return (
    <div className={`en-app-loading-logo ${supported ? '' : 'en-app-loading-still'}`} data-loading-logo={id}>
      {failed ? (
        <img className="en-app-loading-logo-art" src="/favicon.svg" alt="" aria-hidden="true" />
      ) : (
        <div className={`en-app-loading-logo-art${createRasterTimeline ? ' en-raster-motion-art' : ''}`} ref={artRef} aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: markup }} />
      )}
      {controls && supported && !failed && (
        <button className="en-app-loading-motion-control" type="button"
          onClick={() => setPlaying(!playing)}>
          {playing ? 'Pause loading animation' : 'Play loading animation'}
        </button>
      )}
    </div>
  )
}

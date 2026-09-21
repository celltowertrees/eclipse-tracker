// Reads the map-related design tokens from the CSS custom properties in index.css,
// so the map overlays follow the same theme (and light/dark scheme) as the UI.

export interface MapTheme {
  style: string
  font: string
  total: string
  annular: string
  hybrid: string
  partial: string
  sky: string
  horizon: string
  pathOpacity: number
  limitWidth: number
  centralWidth: number
  zoneOpacity: number
  zoneLineWidth: number
  isolineWidth: number
  penumbra: string
  penumbraOpacity: number
  umbra: string
  umbraOpacity: number
  terminator: string
  label: string
  labelHalo: string
  marker: string
  markerStroke: string
  greatest: string
}

export function readMapTheme(): MapTheme {
  const css = getComputedStyle(document.documentElement)
  const str = (name: string) => css.getPropertyValue(name).trim().replace(/^['"]|['"]$/g, '')
  const num = (name: string, fallback: number) => {
    const v = parseFloat(str(name))
    return Number.isFinite(v) ? v : fallback
  }
  return {
    style: str('--map-style'),
    font: str('--map-font'),
    total: str('--color-total'),
    annular: str('--color-annular'),
    hybrid: str('--color-hybrid'),
    partial: str('--color-partial'),
    sky: str('--map-sky'),
    horizon: str('--map-horizon'),
    pathOpacity: num('--map-path-opacity', 0.3),
    limitWidth: num('--map-limit-width', 2),
    centralWidth: num('--map-central-width', 1.4),
    zoneOpacity: num('--map-zone-opacity', 0.06),
    zoneLineWidth: num('--map-zone-line-width', 2),
    isolineWidth: num('--map-isoline-width', 1.6),
    penumbra: str('--map-penumbra'),
    penumbraOpacity: num('--map-penumbra-opacity', 0.2),
    umbra: str('--map-umbra'),
    umbraOpacity: num('--map-umbra-opacity', 0.7),
    terminator: str('--map-terminator'),
    label: str('--map-label'),
    labelHalo: str('--map-label-halo'),
    marker: str('--map-marker'),
    markerStroke: str('--map-marker-stroke'),
    greatest: str('--map-greatest'),
  }
}

/** Call `cb` whenever the browser's light/dark preference changes. Returns an unsubscribe function. */
export function onColorSchemeChange(cb: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

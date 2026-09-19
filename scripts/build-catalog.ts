// Builds public/data/catalog.json: every central (total/annular/hybrid) solar eclipse
// 1900–2100 with its Besselian elements, NASA summary stats and a curated city list.
//
// Sources (in scripts/data):
//   canon-1900-2100.json — Five Millennium Canon Besselian elements (Espenak & Meeus,
//     via github.com/gmiller123456/FiveMillenniumCanonOfSolarEclipses-Besselian-Elements)
//   cities.json — Natural Earth 10m populated places (public domain), slimmed
//
// Run: npm run build:catalog

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summaryFromCanon, type CanonRecord, type Catalog, type CityEntry, type EclipseSummary } from '../src/astro/catalog'
import { haversineKm } from '../src/astro/earth'
import { localCircumstances } from '../src/astro/local'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const canon = JSON.parse(readFileSync(join(root, 'scripts/data/canon-1900-2100.json'), 'utf8')) as {
  acknowledgement: string
  data: CanonRecord[]
}
const cities = JSON.parse(readFileSync(join(root, 'scripts/data/cities.json'), 'utf8')) as CityEntry[]
cities.sort((a, b) => b.pop - a.pop)

const MAX_CITIES = 8
const MIN_CITIES = 5
const MIN_SEPARATION_KM = 200

function pick(candidates: CityEntry[], chosen: CityEntry[], limit: number) {
  for (const c of candidates) {
    if (chosen.length >= limit) break
    if (chosen.some((p) => haversineKm(p.lat, p.lon, c.lat, c.lon) < MIN_SEPARATION_KM)) continue
    chosen.push(c)
  }
}

const eclipses: EclipseSummary[] = []
for (const r of canon.data) {
  if (!/^[TAH]/.test(r.eclipse_type)) continue
  const s = summaryFromCanon(r)

  const central: CityEntry[] = []
  const partial: { city: CityEntry; mag: number }[] = []
  for (const city of cities) {
    const lc = localCircumstances(s.elements, city.lat, city.lon)
    if (!lc.max || lc.max.alt <= 0) continue
    if (lc.type === 'total' || lc.type === 'annular') central.push(city)
    else if (lc.type === 'partial' && city.pop >= 500_000) partial.push({ city, mag: lc.magnitude })
  }

  const chosen: CityEntry[] = []
  pick(central, chosen, MAX_CITIES)
  if (chosen.length < MIN_CITIES) {
    partial.sort((a, b) => b.mag - a.mag)
    pick(
      partial.map((p) => p.city),
      chosen,
      MIN_CITIES,
    )
  }

  eclipses.push({ ...s, cities: chosen })
  process.stdout.write(`\r${s.id} ${s.typeCode.padEnd(3)} central cities: ${String(central.length).padStart(4)}`)
}

const catalog: Catalog = { acknowledgement: canon.acknowledgement, eclipses }
const out = join(root, 'public/data/catalog.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(catalog))
console.log(`\nWrote ${eclipses.length} eclipses to ${out}`)

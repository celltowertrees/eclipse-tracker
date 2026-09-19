# Eclipse Tracker

Interactive 3D globe of every central solar eclipse (total, annular, hybrid) from 1900 to 2100.
Pick an eclipse to see the path of totality/annularity, the partial-eclipse zone with magnitude
isolines, and an animated Moon shadow. Click anywhere (or on a listed city) for local contact
times in UTC and the location's own time zone, duration of totality, magnitude and Sun altitude.

## Running

```bash
npm install
npm run dev            # dev server
npm test               # golden tests against NASA path tables / local circumstances
npm run build          # production build → dist/
npm run build:catalog  # regenerate public/data/catalog.json from scripts/data
```

## How it works

No eclipse API is used — everything is computed in the browser from **Besselian elements**
(Espenak & Meeus, *Five Millennium Canon of Solar Eclipses*), following the Explanatory
Supplement to the Astronomical Almanac.

| Module | Purpose |
| --- | --- |
| `src/astro/besselian.ts` | Evaluate element polynomials; TDT ↔ UTC |
| `src/astro/earth.ts` | Fundamental plane ↔ geodetic (WGS84 ellipsoid), observer geometry |
| `src/astro/local.ts` | Local circumstances: C1–C4, maximum, magnitude, obscuration, duration |
| `src/astro/path.ts` | Central line and northern/southern path limits |
| `src/astro/shadow.ts` | Umbra/penumbra outlines at an instant (clipped at the terminator) |
| `src/astro/partialZone.ts` | Visibility zone + magnitude isolines (grid + `d3-contour`) |
| `src/workers/eclipse.worker.ts` | Runs path/zone computation off the main thread |
| `scripts/build-catalog.ts` | Builds the catalog and auto-picks ~8 cities per eclipse |

Accuracy: path limits match NASA's published path table to < 1 km (same ΔT); local durations
are within a few seconds of NASA values (lunar limb profile is not modelled).

Globe: MapLibre GL (globe projection) with OpenFreeMap tiles — no API keys required.

## Credits

Eclipse Predictions by Fred Espenak, NASA's GSFC. Besselian elements via
[gmiller123456/FiveMillenniumCanonOfSolarEclipses-Besselian-Elements](https://github.com/gmiller123456/FiveMillenniumCanonOfSolarEclipses-Besselian-Elements).
Cities: Natural Earth (public domain). Map data © OpenStreetMap contributors, OpenFreeMap.

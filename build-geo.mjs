// Builds same-origin map data for the globe from world-atlas + us-atlas (Natural Earth, public domain).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const out = new URL('../public/geo/', import.meta.url);
mkdirSync(out, { recursive: true });
let topojson;
try { topojson = require('topojson-client'); } catch { console.warn('[geo] topojson-client not installed; globe will use CDN fallback.'); process.exit(0); }
const iso = JSON.parse(readFileSync(new URL('../content/iso3166.json', import.meta.url), 'utf8')); // numeric -> alpha2
const world = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'));
const wf = topojson.feature(world, world.objects.countries).features.map((f) => ({
  type: 'Feature', geometry: f.geometry, properties: { name: f.properties?.name || '', id: iso[String(f.id).padStart(3, '0')] || '' },
}));
writeFileSync(new URL('world.json', out), JSON.stringify({ type: 'FeatureCollection', features: wf }));
const thin = (g, step) => {
  const ring = (r) => (r.length <= 12 ? r : [...r.filter((_, i) => i % step === 0), r[r.length - 1]]);
  if (g?.type === 'Polygon') return { ...g, coordinates: g.coordinates.map(ring) };
  if (g?.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map((p) => p.map(ring)) };
  return g;
};
const usPath = require.resolve('us-atlas/states-10m.json');
if (existsSync(usPath)) {
  const us = JSON.parse(readFileSync(usPath, 'utf8'));
  const uf = topojson.feature(us, us.objects.states).features.map((f) => ({
    type: 'Feature', geometry: thin(f.geometry, 4), properties: { name: f.properties?.name || '', id: 'US-' + (f.properties?.name || f.id) },
  }));
  writeFileSync(new URL('us.json', out), JSON.stringify({ type: 'FeatureCollection', features: uf }));
}
console.log(`[geo] ${wf.length} countries written to public/geo/`);

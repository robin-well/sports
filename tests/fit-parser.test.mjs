import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseFit } from '../js/parsers.js';

const normal = parseFit(fs.readFileSync(new URL('../sample-data/demo-run.fit', import.meta.url)));
const a = normal.activities[0];
assert.equal(a.type, 'running');
assert.equal(a.distance, 8.42);
assert.equal(a.avgHr, 148);
assert.ok(a.stream.length >= 2);

const flagged = parseFit(fs.readFileSync(new URL('./fixtures/fit-flagged-base.fit', import.meta.url)));
const f = flagged.activities[0];
assert.equal(f.distance, 5);
assert.equal(f.avgHr, 145);
assert.equal(f.stream.at(-1).dist, 5);
assert.ok(f.stream.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)), 'GPS should be preserved');

const dev = parseFit(fs.readFileSync(new URL('./fixtures/fit-developer-field.fit', import.meta.url)));
const d = dev.activities[0];
assert.equal(d.type, 'strength');
assert.equal(d.duration, 30);
assert.equal(d.calories, 250);
assert.equal(d.stream.length, 3);

const compressed = parseFit(fs.readFileSync(new URL('./fixtures/fit-compressed.fit', import.meta.url)));
const b = compressed.activities[0];
assert.equal(b.type, 'running');
assert.equal(b.duration, 20);
assert.equal(b.distance, 10);
assert.ok(b.stream.length > 100, 'compressed timestamp stream should be complete');
assert.equal(b.stream.at(-1).t, 20, 'compressed timestamps should reconstruct to the full duration');

console.log('FIT parser tests passed:', {
  normal: `${a.duration}min / ${a.distance}km / ${a.stream.length} points`,
  flaggedBaseTypes: `${f.duration}min / ${f.distance}km / ${f.stream.length} points`,
  developerFields: `${d.type} / ${d.duration}min / ${d.stream.length} points`,
  compressed: `${b.duration}min / ${b.distance}km / ${b.stream.length} points`
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'record-catalog.json')));
assert.equal(catalog.topics.length, 4);
assert.equal(new Set(catalog.dialects.map(d => d.id)).size, 15);
assert.equal(Object.keys(catalog.artwork).length, 60);
for (const t of catalog.topics) for (const d of catalog.dialects) {
  const art = catalog.artwork[t.id + '/' + d.id];
  for (const side of ['front', 'back']) {
    assert(fs.existsSync(path.join(root, art[side])), t.id + '/' + d.id + ' ' + side);
    const resolved = new URL(art[side], 'http://127.0.0.1:4173/public/gallery.html');
    assert.equal(resolved.pathname, '/' + art[side].replace(/^\/+/, ''), 'Artwork must resolve from embedded gallery: ' + t.id + '/' + d.id + ' ' + side);
  }
}
let source = fs.readFileSync(path.join(root, 'src/gallery/data.ts'), 'utf8').replace('import.meta.env.BASE_URL', '"/public/"');
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
const scope = {exports: {}, require: id => { assert.equal(id, '../../record-catalog.json'); return catalog; }};
vm.runInNewContext(js, scope);
const build = scope.exports.buildVoiceCatalog;
const first = {id: 'one', topic: '家乡味道', dialectId: 'wu', hasAudio: true, phrase: '侬好'};
const second = {...first, id: 'two', phrase: '新录音'};
const mood = {...first, id: 'mood', topic: '今日心情'};
const templates = scope.exports.buildArtworkCatalog;
const all = build([first, second, {...first, id:'pending', hasAudio:false}, {...first}]);
assert.equal(all.length, 2, 'Each recording has its own disc; repeated IDs are excluded');
assert.equal(new Set(all.map(d => d.slug)).size, 2);
assert.equal(all.find(d => d.voiceId === 'two').recording.id, 'two');
for (const disc of all) {
  assert.equal(disc.disc, templates().find(d => d.dialectId === 'wu').disc);
  assert.equal(disc.backDisc, catalog.artwork['taste/wu'].back);
  assert.equal(disc.voicePhrase, catalog.topics[0].prompt);
}
assert.equal(build([first], 'childhood').length, 0);
assert.equal(build([]).length, 0, 'No unrecorded template discs on the public wall');
assert.equal(templates('mood')[0].voicePhrase, catalog.topics[1].prompt);
assert.equal(templates().length, 15, 'All artwork remains available for personal previews');
const combined = build([first, second, mood, {...first, id:'alias', recordingId:'one'}], 'all');
assert.equal(combined.length, 3);
assert.equal(new Set(combined.map(d => d.voiceId)).size, combined.length);
assert.equal(combined.filter(d => d.voiceTopic === '家乡味道').length, 2);
assert.equal(combined.filter(d => d.voiceTopic === '今日心情').length, 1);
assert.equal(build([mood, {...first, id:'invalid', topic:'missing'}], 'all').length, 1);
const gallery = fs.readFileSync(path.join(root, 'src/gallery/GalleryView.tsx'), 'utf8');
assert(!gallery.includes('听不同人的声音'));
assert(!gallery.includes('<select'));
assert(gallery.includes('films.length'));
console.log('PASS: 60 paired assets; each published recording has one disc; repeated IDs excluded; topic counts and empty states; no recording dropdown.');
// Verify the live waveform helper against silence and a localized signal.
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const waveformSource = app.slice(app.indexOf('function waveformBars('), app.indexOf('function makeBars('));
const waveScope = {}; vm.runInNewContext(waveformSource, waveScope);
const signal = Array.from({length:64}, (_, i) => i === 30 ? 1 : 0);
const rendered = waveScope.waveformBars(signal);
assert.equal((rendered.match(/wave-bar/g) || []).length, 64);
assert.equal((rendered.match(/height:92%/g) || []).length, 1);
assert.equal((rendered.match(/height:3%/g) || []).length, 63);
assert(!waveScope.waveformBars([0,0]).includes('NaN'));
// Every literal DOM id referenced by the main app is present, except legacy optional mapFocus.
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...page.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
for (const m of app.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) if (m[1] !== 'mapFocus') assert(ids.has(m[1]), 'Missing DOM id: '+m[1]);
console.log('PASS: waveform reflects audio envelope; all main-flow DOM targets exist.');

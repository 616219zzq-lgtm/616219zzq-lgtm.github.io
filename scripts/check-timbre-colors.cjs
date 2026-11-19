const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),scope={};
vm.createContext(scope);vm.runInContext(app.slice(app.indexOf('function waveformBars('),app.indexOf('function makeBars(')),scope);
function tone(frequency,volume,rate){let diff=0,energy=0,previous=0;for(let i=0;i<rate;i++){const sample=volume*Math.sin(i*2*Math.PI*frequency/rate);energy+=sample*sample;if(i)diff+=Math.abs(sample-previous);previous=sample}return scope.classifyTimbre(diff/rate,Math.sqrt(energy/rate),rate)}
assert.equal(tone(300,.2,48000),'轻柔');assert.equal(tone(1200,.2,48000),'温润');assert.equal(tone(3000,.2,48000),'明亮');
for(const frequency of [300,1200,3000]){assert.equal(tone(frequency,.03,48000),tone(frequency,.8,48000));assert.equal(tone(frequency,.2,44100),tone(frequency,.2,48000))}
const patterns=JSON.parse(fs.readFileSync(path.join(root,'wave-patterns.json')));
const results=['明亮','温润','轻柔'].map(timbre=>scope.waveformBars([.1,.5,1],'wu',patterns,{timbre}));
assert.equal(new Set(results).size,3);
for(const result of results){assert(result.includes(patterns.wu[0]));assert(result.includes('--voice-position:0%'));assert(result.includes('--voice-position:100%'))}
console.log('PASS: three gradient families, volume/sample-rate consistency, regional masks and full-width color progression.');

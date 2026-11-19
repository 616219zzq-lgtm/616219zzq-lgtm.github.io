const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),patterns=JSON.parse(fs.readFileSync(path.join(root,'wave-patterns.json'))),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const context={};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function waveformBars('),app.indexOf('function makeBars(')),context);
const ids=['ne','bj','jl','zy','sw','jh','wu','gan','xiang','yue','min','sha','wuxi','jiangyin','yixing'];
for(const id of ids){
 assert(patterns[id]?.length>0,id);
 for(const file of patterns[id])assert(fs.existsSync(path.join(root,file)),file);
 const signal=Array.from({length:64},(_,i)=>i===30?1:0);
 const html=context.waveformBars(signal,id,patterns);
 assert.equal((html.match(/--voice-mask:/g)||[]).length,64);
 assert.equal((html.match(/height:92%/g)||[]).length,1);
 assert.equal((html.match(/height:3%/g)||[]).length,63);
 assert(html.includes(patterns[id][0]));assert(!html.includes('NaN'));
}
assert.notDeepEqual(patterns.wuxi,patterns.jiangyin);assert.notDeepEqual(patterns.jiangyin,patterns.yixing);
assert.equal(context.waveformBars([], 'wu',patterns),'<span>音波正在准备，请稍候</span>');
console.log('PASS: 15 region mappings, motif files, distinct city styles, amplitude preservation and pending audio.');

const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const code=app.slice(app.indexOf('function hasKeepsake()'),app.indexOf("document.getElementById('toKeepsake').onclick"));
const state={wallFromHome:true,recordedBlob:{},recognizedTranscript:'我的录音',setScreen(n){state.screen=n},toast(){},publicVoices:[{hasAudio:true,phrase:'别人的录音'}]};
vm.createContext(state);vm.runInContext(code,state);
assert.equal(state.hasKeepsake(),false);state.openKeepsake();assert.equal(state.screen,1);
state.wallFromHome=false;assert.equal(state.hasKeepsake(),true);state.openKeepsake();assert.equal(state.screen,9);
state.recordedBlob=null;assert.equal(state.hasKeepsake(),false);state.openKeepsake();assert.equal(state.screen,1);
console.log('PASS: browsing hides card access; current recording opens card; stored public voices never become personal cards.');

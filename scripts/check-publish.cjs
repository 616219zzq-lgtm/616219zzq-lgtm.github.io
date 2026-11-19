const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const code=app.slice(app.indexOf('async function commitVoice('),app.indexOf("document.getElementById('joinPublic').onclick"));
function setup(){
 const elements={dialectSelect:{value:'wu'},joinPublic:{},privateSave:{},publishStatus:{}};
 const state={voiceSaving:false,recordedBlob:{},recognizedTranscript:'侬好',dialects:[{id:'wu',count:0}],addedVoice:null,voicePrivate:false,pendingWallVoiceId:null,publicVoices:[],privateVoices:[],PUBLIC_VOICES_KEY:'public',PRIVATE_VOICES_KEY:'private',document:{getElementById:id=>elements[id]},voiceRecordFromCurrent:()=>({id:'test',dialectId:'wu'}),saveVoiceAudio:async()=>{},writeVoiceStore(){},toast(){},setScreen(n){assert.equal(state.voiceSaving,false);state.screen=n}};
 vm.createContext(state);vm.runInContext(code,state);return{state,elements};
}
(async()=>{
 const {state,elements}=setup();state.writeVoiceStore=()=>{throw Error('quota')};
 await state.commitVoice(true);
 assert.equal(state.screen,undefined);assert.equal(state.publicVoices.length,0);assert.equal(state.addedVoice,null);assert.equal(state.voiceSaving,false);assert.equal(elements.joinPublic.disabled,false);
 state.writeVoiceStore=()=>{};await state.commitVoice(true);
 assert.equal(state.screen,8);assert.equal(state.publicVoices.length,1);assert.equal(state.pendingWallVoiceId,'test');
 await state.commitVoice(true);assert.equal(state.publicVoices.length,1);
 const next=setup();let complete,calls=0;
 next.state.saveVoiceAudio=()=>{calls++;return new Promise(resolve=>complete=resolve)};
 const pending=next.state.commitVoice(false);await next.state.commitVoice(false);
 assert.equal(calls,1);assert.equal(next.elements.privateSave.disabled,true);complete();await pending;
 assert.equal(next.state.screen,9);assert.equal(next.state.privateVoices.length,1);assert.equal(next.state.publicVoices.length,0);
 const failed=setup();failed.state.saveVoiceAudio=async()=>{throw Error('aborted')};await failed.state.commitVoice(true);
 assert.equal(failed.state.publicVoices.length,0);assert.equal(failed.state.screen,undefined);
 console.log('PASS: audio/metadata failures stay on publishing; retries save once; duplicate submissions blocked; private saves remain private.');
})().catch(error=>{console.error(error);process.exitCode=1});

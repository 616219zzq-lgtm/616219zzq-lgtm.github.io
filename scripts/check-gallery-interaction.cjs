const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
(async () => {
  const THREE = await import('three');
  const root = path.resolve(__dirname, '..');
  const config = fs.readFileSync(path.join(root, 'src/gallery/data.ts'), 'utf8').replace('import.meta.env.BASE_URL', JSON.stringify('/public/'));
  const dataScope = { exports: {}, require: () => JSON.parse(fs.readFileSync(path.join(root, 'record-catalog.json'))) };
  vm.runInNewContext(ts.transpileModule(config, { compilerOptions: {module: ts.ModuleKind.CommonJS, esModuleInterop:true} }).outputText, dataScope);
  const W = dataScope.exports.DISC_ENGINE;
  const stubGsap = { registerPlugin() {}, killTweensOf() {}, CustomEase: null };
  const scope = { exports: {}, require: id => id === 'three' ? THREE : id === './data' ? dataScope.exports : id === 'gsap' ? {default:stubGsap} : id.includes('CustomEase') ? {CustomEase:{create:()=>'none'}} : {}, performance, requestAnimationFrame:()=>1 };
  const source = fs.readFileSync(path.join(root,'src/gallery/discEngine.ts'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,scope);
  const prototype=scope.exports.DiscEngine.prototype;
  // Focus a recording by its unique ID, even when identical artwork is shuffled.
  const focus=Object.create(prototype);let focusIndex=-1;
  Object.assign(focus,{films:[{voiceId:'other'},{voiceId:'published'}],destroyed:false,snapToIndex:i=>focusIndex=i,start(){}});
  assert.equal(focus.focusVoice('published'),true);assert.equal(focusIndex,1);
  assert.equal(focus.focusVoice('missing'),false);assert.equal(focusIndex,1);
  focus.destroyed=true;assert.equal(focus.focusVoice('published'),false);
  const outline=Object.create(prototype);
  Object.assign(outline,{host:{dataset:{}},films:[{voiceId:'one'},{voiceId:'two'}],scroll:1,hoverIndex:1,finePointer:true,start(){}});
  outline.setPlayingVoice('two');assert.equal(outline.scribbleTargetIndex(),1);
  outline.hoverIndex=-1;outline.finePointer=false;assert.equal(outline.scribbleTargetIndex(),1);
  outline.setPlayingVoice(null);outline.hoverIndex=1;outline.finePointer=true;assert.equal(outline.scribbleTargetIndex(),-1);
  // A single click on a side disc centers it and opens that same recording.
  const click=Object.create(prototype);let opened=null,complete;
  const clickedFilm={voiceId:'clicked'};
  Object.assign(click,{flightLocked:false,swapping:false,clickBlockUntil:0,films:[{},clickedFilm],
    updatePointerFromEvent(){},hitDiscIndex:()=>1,activeIndex:()=>0,abortWheelGesture(){},applyPressImpulse(){},
    snapToIndex(i,options){assert.equal(i,1);complete=options.onComplete;},onOpenFilm:film=>opened=film});
  const clickSource=source.slice(source.indexOf('  private onDiscClick ='),source.indexOf('  private wheelDelta('));
  vm.runInNewContext(ts.transpileModule('class ClickHarness {'+clickSource+'}; exports.ClickHarness=ClickHarness;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,scope);
  const clickHarness=Object.assign(new scope.exports.ClickHarness(),click);
  clickHarness.onDiscClick({target:null,preventDefault(){}});assert.equal(opened,null);
  complete();assert.equal(opened,clickedFilm);
  const frameSource=source.slice(source.indexOf('  private tick ='),source.indexOf('  destroy()'));
  scope.clamp=(value,min,max)=>Math.max(min,Math.min(max,value));scope.W=W;
  vm.runInNewContext(ts.transpileModule('class FrameHarness {'+frameSource+'}; exports.FrameHarness = FrameHarness;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,scope);
  // A hidden disc directly in front of a visible one must never intercept a click.
  const camera=new THREE.PerspectiveCamera(40,1,.1,100); camera.position.z=5; camera.updateMatrixWorld();
  const visible=new THREE.Mesh(new THREE.CircleGeometry(1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));visible.userData.discIndex=0;
  const hidden=new THREE.Mesh(visible.geometry,visible.material);hidden.position.z=1;hidden.userData.discIndex=18;
  const visibleGroup=new THREE.Group();visibleGroup.add(visible);visibleGroup.updateMatrixWorld();
  const hiddenGroup=new THREE.Group();hiddenGroup.add(hidden);hiddenGroup.visible=false;hiddenGroup.updateMatrixWorld();
  const discs=[];discs[0]={index:0,group:visibleGroup};discs[18]={index:18,group:hiddenGroup};
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  assert.equal(prototype.pickDisc.call({pickMeshes:[hidden,visible],discs,scroll:0,raycaster}).object.userData.discIndex,0);
  hiddenGroup.visible=true; // A distant disc remains excluded even during entrance.
  assert.equal(prototype.pickDisc.call({pickMeshes:[hidden,visible],discs,scroll:0,raycaster}).object.userData.discIndex,0);
  // Run the actual frame-layout code with 48 discs, including its locked entrance state.
  for (const flightLocked of [false,true]) for (const active of [0,18,47]) {
    const engine=Object.create(prototype);
    Object.assign(engine,{running:true,lastTime:0,films:Array(48).fill({}),scroll:active,prevScroll:active,scrollVel:0,settleVel:0,flow:0,pointerDown:false,dragCommitted:false,pointerInside:false,finePointer:false,flightLocked,flight:{active:1,others:1,inbound:true},hoverIndex:-1,spinDiscIndex:-1,spinReset:null,preload:{active:false},renderer:{render(){}},scene:{},camera:{},snapTween:null,emitIndex(){},loadTextureWindow(){},tickScribble(){}});
    engine.discs=Array.from({length:48},(_,index)=>({index,group:new THREE.Group(),spin:new THREE.Group(),spinX:0,spinY:0,spinZ:0,hover:0,pushX:0,pushY:0,pushZ:0,pushVX:0,pushVY:0,pushVZ:0,pushRotX:0,pushRotY:0,pushRotVX:0,pushRotVY:0}));
    const harness=Object.assign(new scope.exports.FrameHarness(),engine);harness.isSnapTweening=()=>false;harness.tick(16.667);
    for(const disc of engine.discs) assert.equal(disc.group.visible,Math.abs(disc.index-active)<=W.renderRadius+.5);
  }
  const selection=Object.create(prototype);
  let selected=-1;
  Object.assign(selection,{films:[{},{}],snapTarget:-1,snapTween:null,scroll:1,scrollVel:0,settleVel:0,flow:0,lastIndex:0,isSettled:true,spinReset:{index:0},onIndexChange:i=>selected=i,
    discs:[0,1].map(()=>({group:new THREE.Group(),spinX:.4,spinY:Math.PI}))});
  selection.discs[0].group.userData.flipY=Math.PI;
  prototype.emitIndex.call(selection,true);
  assert.equal(selected,1);assert.equal(selection.discs[0].group.userData.flipY,0);assert.equal(selection.discs[0].spinY,0);assert.equal(selection.spinReset,null);
  // Loading that completes after destroy must not rebuild meshes in the old scene.
  const stale=Object.create(prototype);let finish;
  Object.assign(stale,{shared:{frontGeometry:{}},films:[],destroyed:false,ensureTextures:()=>new Promise(resolve=>{finish=resolve;})});
  const loading=prototype.buildDiscs.call(stale);stale.destroyed=true;finish();await loading;
  console.log('PASS: hidden/distant click targets excluded; 48-disc visibility bounded during entrance and scrolling; cancelled loads cannot rebuild old scenes.');
})().catch(error=>{console.error(error);process.exitCode=1});

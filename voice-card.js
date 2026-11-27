window.VoiceCard = (() => {
  const load = src => new Promise((resolve,reject) => {const im=new Image(),timer=setTimeout(()=>reject(Error('卡片素材加载超时，请刷新重试')),12000);im.onload=()=>{clearTimeout(timer);resolve(im)};im.onerror=()=>{clearTimeout(timer);reject(Error('卡片素材加载失败，请重试'))};im.src=src;});
  function heights(frames){const peak=Math.max(.001,...frames);return Array.from({length:64},(_,i)=>{let v=0;for(let j=Math.floor(i*frames.length/64);j<Math.max(Math.floor(i*frames.length/64)+1,Math.floor((i+1)*frames.length/64));j++)v=Math.max(v,frames[j]||0);return Math.round(Math.max(3,v/peak*92));});}
  const dialectIds=['ne','bj','jl','zy','sw','jh','wu','gan','xiang','yue','min','wuxi','jiangyin','yixing'];
  function encode(d){const data=String.fromCharCode(dialectIds.indexOf(d.d),['bright','warm','soft'].indexOf(d.c),d.t||0,...d.h.map(Math.round));return btoa(data).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function decode(s){const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/'));if(raw.length!==67)throw Error('卡片链接无效');const d={v:1,d:dialectIds[raw.charCodeAt(0)],c:['bright','warm','soft'][raw.charCodeAt(1)],t:raw.charCodeAt(2),h:Array.from(raw.slice(3),c=>c.charCodeAt(0))};if(!d.d||!['bright','warm','soft'].includes(d.c)||d.h.some(n=>n<3||n>92))throw Error('卡片链接无效');return d;}
  function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  async function prepare(d,patterns,region){
    const assets=window.VoiceCardAssets,atlasInfo=assets&&assets.patterns[d.d];
    const gradient=await load(assets?assets.gradients[d.c]:'assets/voice-gradients/'+d.c+'.png');
    const atlas=atlasInfo?await load(atlasInfo.src):null;
    const motifs=atlas?[]:await Promise.all((patterns[d.d]||[]).map(load));
    const canvas=document.createElement('canvas');canvas.width=1544;canvas.height=940;const ctx=canvas.getContext('2d');
    const background=document.createElement('canvas');background.width=1544;background.height=940;const x=background.getContext('2d');
    rounded(x,0,0,1544,940,32);x.clip();const bg=x.createLinearGradient(0,0,1544,820);[[0,'#d0d4d8'],[.22,'#f5f6f7'],[.43,'#c3c8ce'],[.6,'#e6e9ec'],[.73,'#f8f9fa'],[1,'#bdc3ca']].forEach(([p,c])=>bg.addColorStop(p,c));x.fillStyle=bg;x.fillRect(0,0,1544,940);
    for(let y=0;y<940;y+=4){x.fillStyle='#ffffff24';x.fillRect(0,y,1544,1);x.fillStyle='#78818b0a';x.fillRect(0,y+1,1544,1);}
    x.strokeStyle='#bdc3ca';x.lineWidth=2;rounded(x,1,1,1542,938,31);x.stroke();x.font='26px sans-serif';x.fillStyle='#2b2824';x.fillText('独属于你的音浪',60,90);x.font='22px Arial';x.fillStyle='#6a655c';x.textAlign='right';x.fillText('UNIQUE VOICEPRINT',1484,90);
    x.fillStyle='#ffffff88';x.beginPath();x.arc(104,862,28,0,Math.PI*2);x.fill();x.fillStyle='#2b2824';x.font='26px sans-serif';x.textAlign='center';x.fillText('声',104,872);x.textAlign='left';x.fillText(region,154,872);x.textAlign='right';x.fillText('00:'+String(d.t).padStart(2,'0'),1466,872);
    const bars=d.h.map((height,i)=>{const bar=document.createElement('canvas');bar.width=16;bar.height=Math.max(1,Math.ceil(height/100*592.2));const b=bar.getContext('2d');b.drawImage(gradient,Math.round(i/63*(gradient.width-1)),0,1,gradient.height,0,0,16,bar.height);b.globalCompositeOperation='destination-in';if(atlas)b.drawImage(atlas,(i%atlasInfo.count)*32,0,32,256,0,0,16,bar.height);else if(motifs.length)b.drawImage(motifs[i%motifs.length],0,0,16,bar.height);return bar;});
    function draw(time=0,playing=false){ctx.clearRect(0,0,1544,940);ctx.drawImage(background,0,0);bars.forEach((bar,i)=>{const factor=playing?.78+.22*Math.sin(time*8+i*.71):1,h=bar.height*factor;ctx.drawImage(bar,134+i*20,508-h/2,16,h);});}
    draw();return {canvas,draw,png:()=>{draw();return canvas.toDataURL('image/png')}};
  }
  async function render(d,patterns,region){return (await prepare(d,patterns,region)).png();}
  async function video(scene,blob,onProgress){
    if(!window.MediaRecorder||!scene.canvas.captureStream)throw Error('当前浏览器不支持视频导出，请使用 Chrome');
    const AC=window.AudioContext||window.webkitAudioContext,context=new AC();let recorder,stream,frame,source;
    try{await context.resume();const audio=await context.decodeAudioData(await blob.arrayBuffer()),destination=context.createMediaStreamDestination();source=context.createBufferSource();source.buffer=audio;source.connect(destination);stream=scene.canvas.captureStream(30);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));const type=['video/mp4;codecs=avc1.42001E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('浏览器没有可用的视频编码器');const chunks=[];recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:5000000});const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));recorder.onerror=()=>reject(Error('视频生成失败，请重试'));});recorder.start();const start=context.currentTime;function tick(){scene.draw(context.currentTime-start,true);if(onProgress)onProgress(Math.min(1,(context.currentTime-start)/audio.duration));frame=requestAnimationFrame(tick)}tick();source.onended=()=>{cancelAnimationFrame(frame);scene.draw();if(recorder.state!=='inactive')recorder.stop()};source.start();return await done;}finally{cancelAnimationFrame(frame);if(source)try{source.stop()}catch(_){}if(recorder&&recorder.state!=='inactive')recorder.stop();if(stream)stream.getTracks().forEach(t=>t.stop());await context.close();scene.draw();}
  }
  return {heights,encode,decode,render,prepare,video};
})();

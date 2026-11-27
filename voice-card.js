window.VoiceCard = (() => {
  const load = src => new Promise((resolve,reject) => {const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('卡片素材加载失败，请重试'));im.src=src;});
  function heights(frames){const peak=Math.max(.001,...frames);return Array.from({length:64},(_,i)=>{let v=0;for(let j=Math.floor(i*frames.length/64);j<Math.max(Math.floor(i*frames.length/64)+1,Math.floor((i+1)*frames.length/64));j++)v=Math.max(v,frames[j]||0);return Math.round(Math.max(3,v/peak*92));});}
  const dialectIds=['ne','bj','jl','zy','sw','jh','wu','gan','xiang','yue','min','wuxi','jiangyin','yixing'];
  function encode(d){const data=String.fromCharCode(dialectIds.indexOf(d.d),['bright','warm','soft'].indexOf(d.c),d.t||0,...d.h.map(Math.round));return btoa(data).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function decode(s){const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/'));if(raw.length!==67)throw Error('卡片链接无效');const d={v:1,d:dialectIds[raw.charCodeAt(0)],c:['bright','warm','soft'][raw.charCodeAt(1)],t:raw.charCodeAt(2),h:Array.from(raw.slice(3),c=>c.charCodeAt(0))};if(!d.d||!['bright','warm','soft'].includes(d.c)||d.h.some(n=>n<3||n>92))throw Error('卡片链接无效');return d;}
  async function render(d,patterns,region){
    const canvas=document.createElement('canvas');canvas.width=1544;canvas.height=940;const ctx=canvas.getContext('2d');
    ctx.beginPath();ctx.roundRect(0,0,1544,940,32);ctx.clip();
    const bg=ctx.createLinearGradient(0,0,1544,820);[[0,'#d0d4d8'],[.22,'#f5f6f7'],[.43,'#c3c8ce'],[.6,'#e6e9ec'],[.73,'#f8f9fa'],[1,'#bdc3ca']].forEach(([p,c])=>bg.addColorStop(p,c));ctx.fillStyle=bg;ctx.fillRect(0,0,1544,940);
    for(let y=0;y<940;y+=4){ctx.fillStyle='#ffffff24';ctx.fillRect(0,y,1544,1);ctx.fillStyle='#78818b0a';ctx.fillRect(0,y+1,1544,1);}
    ctx.strokeStyle='#bdc3ca';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(1,1,1542,938,31);ctx.stroke();
    ctx.font='26px -apple-system, BlinkMacSystemFont, PingFang SC, sans-serif';ctx.fillStyle='#2b2824';ctx.fillText('独属于你的音浪',60,90);ctx.font='22px Arial';ctx.fillStyle='#6a655c';ctx.textAlign='right';ctx.fillText('UNIQUE VOICEPRINT',1484,90);ctx.textAlign='left';
    const gradient=await load('assets/voice-gradients/'+d.c+'.png'),motifs=await Promise.all((patterns[d.d]||[]).map(load));
    const width=16,gap=4,left=(1544-64*width-63*gap)/2,center=508;
    for(let i=0;i<64;i++){const h=d.h[i]/100*592.2,bar=document.createElement('canvas');bar.width=16;bar.height=Math.max(1,Math.ceil(h));const b=bar.getContext('2d');b.drawImage(gradient,Math.round(i/63*(gradient.width-1)),0,1,gradient.height,0,0,16,bar.height);if(motifs.length){b.globalCompositeOperation='destination-in';b.drawImage(motifs[i%motifs.length],0,0,16,bar.height);}ctx.drawImage(bar,left+i*(width+gap),center-h/2,16,h);}
    ctx.fillStyle='#ffffff88';ctx.beginPath();ctx.arc(104,862,28,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2b2824';ctx.font='26px -apple-system, BlinkMacSystemFont, PingFang SC, sans-serif';ctx.textAlign='center';ctx.fillText('声',104,872);ctx.textAlign='left';ctx.fillText(region,154,872);ctx.textAlign='right';ctx.fillText('00:'+String(d.t).padStart(2,'0'),1466,872);return canvas.toDataURL('image/png');
  }
  return {heights,encode,decode,render};
})();

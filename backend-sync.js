(function(){
 const KEY='xiangyin-public-voices-v1';let busy=false;
 function audioDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('xiangyin-audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('recordings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function sync(){
  if(busy)return;busy=true;
  try{
   const response=await fetch('/api/voices');if(!response.ok)throw Error('后台未连接');
   const existing=new Set((await response.json()).voices.map(v=>v.id));
   const voices=JSON.parse(localStorage.getItem(KEY)||'[]').filter(v=>v.hasAudio&&!existing.has(v.id));
   if(!voices.length)return;
   const db=await audioDb();
   try{for(const voice of voices){
    const blob=await new Promise((resolve,reject)=>{const r=db.transaction('recordings').objectStore('recordings').get(voice.recordingId||voice.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    if(!blob)continue;
    const audio=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
    const result=await fetch('/api/voices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice,audio,mime:blob.type||'audio/webm'})});
    if(!result.ok)throw Error('录音同步失败');
   }}finally{db.close()}
  }catch(e){console.warn('乡音后台同步：',e.message)}finally{busy=false}
 }
 window.syncXiangyinBackend=sync;sync();setInterval(sync,15000);window.addEventListener('online',sync);
})();

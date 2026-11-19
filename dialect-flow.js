(function(){
 const frame=document.getElementById('dialectPile'),select=document.getElementById('dialectSelect');
 window.addEventListener('message',function(event){
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='dialect:selected')return;
  if(!document.querySelector('[data-screen="5"].active'))return;
  const key=event.data.key;
  if(!Array.from(select.options).some(o=>o.value===key&&key!=='sha'))return;
  select.value=key;select.dispatchEvent(new Event('change',{bubbles:true}));
  window.dispatchEvent(new CustomEvent('xiangyin:select-dialect',{detail:key}));
 });
})();

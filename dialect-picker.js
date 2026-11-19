(function(){
 const select=document.getElementById('dialectSelect');if(!select)return;
 const wrap=document.createElement('div');wrap.className='dialect-picker';select.before(wrap);wrap.append(select);select.hidden=true;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='dialect-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','方言类别');
 const menu=document.createElement('div');menu.className='dialect-menu';menu.hidden=true;menu.setAttribute('role','listbox');menu.setAttribute('aria-label','方言地区');wrap.append(trigger,menu);
 function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}
 function sync(){trigger.textContent=select.selectedOptions[0]?.textContent||'请选择方言地区'}
 function open(){sync();menu.replaceChildren();Array.from(select.options).forEach(option=>{if(!option.value)return;const item=document.createElement('button');item.type='button';item.textContent=option.textContent;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===select.value));item.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();trigger.focus()};menu.append(item)});menu.hidden=false;trigger.setAttribute('aria-expanded','true');menu.firstElementChild?.focus()}
 trigger.onclick=()=>menu.hidden?open():close();
 wrap.addEventListener('keydown',event=>{const items=Array.from(menu.children),i=items.indexOf(document.activeElement);if(event.key==='Escape'){close();trigger.focus()}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(menu.hidden){open();return}items[event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}});
 document.addEventListener('click',event=>{if(!wrap.contains(event.target))close()});wrap.addEventListener('focusout',event=>{if(!wrap.contains(event.relatedTarget))close()});select.addEventListener('change',sync);
 new MutationObserver(sync).observe(select,{childList:true});new MutationObserver(()=>{close();sync()}).observe(document.querySelector('.confirm-layout').parentElement,{attributes:true,attributeFilter:['class']});window.syncDialectPicker=sync;sync();
})();

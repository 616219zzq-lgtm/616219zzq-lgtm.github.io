(function(){
  var root=document.getElementById('stickerHeading');
  if(!root)return;
  var titleLines=['声音的旅程','从一句家乡话开始'],letters=[],lastMaterial={},active=[],lastAuto=-1,pointerInside=false,reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stickerFiles=['northeast','beijing','jilu','zhongyuan','southwest','wu','cantonese','min','jianghuai','gan','xiang'].map(function(name){return 'assets/heading/'+name+'-front.webp'});var characterImages={'程':'assets/heading/cheng-custom.webp','旅':'assets/heading/lv-custom.webp','音':'assets/heading/yin-custom.webp','的':'assets/heading/de-custom.webp','家':'assets/heading/jia-custom.webp','句':'assets/heading/ju-custom.webp','乡':'assets/heading/xiang-custom.webp','话':'assets/heading/hua-custom.webp','开':'assets/heading/kai-custom.webp','始':'assets/heading/shi-custom.webp','一':'assets/heading/yi-custom.webp','从':'assets/heading/cong-custom.webp','声':'assets/heading/sheng-custom.webp'};var materialCount=stickerFiles.length;
  titleLines.forEach(function(line,lineIndex){
    if(lineIndex){root.appendChild(document.createElement('br'))}
    var titleParts=line.split(/(\s+)/);
    titleParts.forEach(function(part){
    if(/^\s+$/.test(part)){var space=document.createElement('span');space.className='sticker-space';space.setAttribute('aria-hidden','true');space.textContent=' ';root.appendChild(space);return}
    var word=document.createElement('span');word.className='sticker-word';root.appendChild(word);
    Array.from(part).forEach(function(char){
      var wrap=document.createElement('span');wrap.className='sticker-letter';wrap.dataset.index=letters.length;wrap.dataset.char=char;wrap.style.setProperty('--tilt',['-9deg','7deg','-5deg','8deg','-7deg','6deg','-4deg'][letters.length%7]);
      var text=document.createElement('span');text.className='sticker-char';text.textContent=char;wrap.appendChild(text);
      var sticker=document.createElement('span');sticker.className='sticker-image';sticker.setAttribute('aria-hidden','true');var picture=document.createElement('img');picture.src=characterImages[char]||stickerFiles[letters.length%materialCount];picture.alt='';picture.draggable=false;picture.decoding='async';sticker.appendChild(picture);wrap.appendChild(sticker);
      word.appendChild(wrap);letters.push(wrap);
    });
    });
  });
  function show(index,random){
    var el=letters[index],char=el&&el.dataset.char;if(!el)return;
    var previous=lastMaterial[index],choices=Array.from({length:materialCount},function(_,i){return i}).filter(function(i){return i!==previous});
    var material=random?choices[Math.floor(Math.random()*choices.length)]:(index*3)%materialCount;lastMaterial[index]=material;
    var sticker=el.querySelector('.sticker-image');sticker.className='sticker-image';sticker.querySelector('img').src=characterImages[char]||stickerFiles[material];
    el.classList.add('is-sticker');active=active.filter(function(i){return i!==index});active.push(index);
    if(active.length>4){var old=active.shift();if(old!==index)letters[old].classList.remove('is-sticker')}
    window.setTimeout(function(){if(!pointerInside&&active.indexOf(index)>=0){el.classList.remove('is-sticker');active=active.filter(function(i){return i!==index})}},random?1000:900);
  }
  var intro=letters.map(function(_,i){return i});
  if(!reduce){intro.forEach(function(index,i){window.setTimeout(function(){show(index,false)},40*i);window.setTimeout(function(){letters[index].classList.remove('is-sticker');active=active.filter(function(x){return x!==index})},40*(intro.length-1)+660+45*i)});}
  root.addEventListener('pointerenter',function(){pointerInside=true});
  root.addEventListener('pointermove',function(e){
    if(reduce||e.pointerType==='touch')return;pointerInside=true;
    var el=document.elementFromPoint(e.clientX,e.clientY);el=el&&el.closest('.sticker-letter');
    if(el&&root.contains(el)){var index=Number(el.dataset.index);if(index!==root._lastHit){root._lastHit=index;show(index,true)}}else root._lastHit=null;
  });
  root.addEventListener('pointerleave',function(){pointerInside=false;root._lastHit=null});
  root.addEventListener('pointerdown',function(e){
    if(reduce)return;var el=document.elementFromPoint(e.clientX,e.clientY);el=el&&el.closest('.sticker-letter');if(el){show(Number(el.dataset.index),true)}
  });
  if(!reduce){var delay=1600+Math.random()*1200;window.setTimeout(function tick(){if(!pointerInside){var pool=intro.filter(function(i){return i!==lastAuto}),index=pool[Math.floor(Math.random()*pool.length)];lastAuto=index;show(index,true)}window.setTimeout(tick,1300+Math.random()*1500)},delay)}
})();

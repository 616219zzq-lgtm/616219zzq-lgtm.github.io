/* Shared hand-drawn sound contour for all visitor-facing controls. */
(() => {
  if (window.__xiangyinSoundLines) return;
  window.__xiangyinSoundLines = true;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'button-sound-lines');
  svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:2147483000;';
  const paths = [0, 1].map(() => {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#24231f');
    path.setAttribute('stroke-width', '1.25');
    path.setAttribute('stroke-linecap', 'round');
    svg.append(path);
    return path;
  });
  document.body.append(svg);
  const selector = 'button, [role="button"], a[href], input[type="button"], input[type="submit"]';
  let hovered = null, focused = null, pressed = null, frame = 0, last = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const control = node => {
    const el = node instanceof Element ? node.closest(selector) : null;
    const isReturn = el && (el.matches('#backButton,.back-button,#previewFlip,.record-flip') || /返回|翻回正面|翻面看看|翻面/.test((el.textContent || '') + (el.getAttribute('aria-label') || '')));
    const isAudioPlayback = el && el.matches('#playRecording,.confirm-play,#holdRecord');
    return el && !isReturn && !isAudioPlayback && !el.closest('[data-sound-lines]') && !el.matches(':disabled,[aria-disabled="true"],[hidden]') ? el : null;
  };
  function draw(time) {
    frame = 0;
    const el = pressed || hovered || focused;
    if (!el || !el.isConnected || el.matches(':disabled,[aria-disabled="true"]') || !el.getClientRects().length) {
      svg.style.display = 'none';
      return;
    }
    svg.style.display = 'block';
    if (time - last > 80) {
      last = time;
      const r = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      const zoom = r.width / (el.offsetWidth || r.width);
      const radius = Math.min(r.width / 2, r.height / 2, (parseFloat(css.borderRadius) || 8) * zoom);
      const phase = reduced.matches ? 0 : Math.floor(time / 140) * .28;
      paths.forEach((path, layer) => {
        const pad = 4 + layer * 4;
        const w = r.width + pad * 2, h = r.height + pad * 2;
        const rr = Math.min(w / 2, h / 2, radius + pad);
        let d = '';
        // Trace rounded corners and straight edges with subtle pencil variation.
        const centers = [[w-rr,rr],[w-rr,h-rr],[rr,h-rr],[rr,rr]];
        const points = [];
        centers.forEach(([cx,cy], corner) => {
          for (let j=0;j<=12;j++) {
            const a = (-90 + corner*90 + j*7.5) * Math.PI/180;
            points.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);
          }
          const next = centers[(corner+1)%4];
          const a = corner*Math.PI/2;
          const end = [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr];
          const start = [next[0]+Math.cos(a)*rr,next[1]+Math.sin(a)*rr];
          for(let j=1;j<9;j++) points.push([end[0]+(start[0]-end[0])*j/9,end[1]+(start[1]-end[1])*j/9]);
        });
        points.forEach(([x,y],i) => {
          const jitter = Math.sin(i*.73 + layer*2 + phase)*.65;
          const gap = layer ? i>=8&&i<=16 : i>=3&&i<=6;
          if(gap)return;
          d += (i===0 || (layer ? i===17 : i===7) ? 'M' : 'L') + (r.left-pad+x+jitter).toFixed(2)+' '+(r.top-pad+y+jitter*.7).toFixed(2);
        });
        path.setAttribute('d',d);
      });
    }
    frame = requestAnimationFrame(draw);
  }
  function refresh() { last=0; if (!frame) frame=requestAnimationFrame(draw); }
  document.addEventListener('pointerover', e => { hovered=control(e.target);refresh(); });
  document.addEventListener('pointerout', e => { hovered=control(e.relatedTarget);refresh(); });
  document.addEventListener('focusin', e => { focused=control(e.target);refresh(); });
  document.addEventListener('focusout', () => { focused=null;refresh(); });
  document.addEventListener('pointerdown', e => { pressed=control(e.target);refresh(); },true);
  document.addEventListener('pointerup', () => { pressed=null;refresh(); },true);
  document.addEventListener('pointercancel', () => { pressed=null;refresh(); },true);
  window.addEventListener('blur', () => { hovered=focused=pressed=null;refresh(); });
})();

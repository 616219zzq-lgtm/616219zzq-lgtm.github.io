(async function(){
 var status=document.getElementById('status');
 try{
  if(!window.VoiceCard||!window.VoiceCardAssets)throw Error('卡片脚本或素材未加载，请刷新重试');
  var data=VoiceCard.decode(decodeURIComponent(location.hash.slice(1))),labels={ne:'东北官话 · 哈尔滨',bj:'北京官话 · 北京',jl:'冀鲁官话 · 济南',zy:'中原官话 · 开封',sw:'西南官话 · 成都',jh:'江淮官话 · 扬州',wu:'吴语 · 江苏苏州',gan:'赣语 · 江西赣州',xiang:'湘语 · 湖南长沙',yue:'粤语 · 广东广州',min:'闽语 · 福建厦门',wuxi:'吴语 · 江苏无锡',jiangyin:'吴语 · 江苏江阴',yixing:'吴语 · 江苏宜兴'};
  if(!labels[data.d])throw Error('卡片地区无效');
  status.textContent='正在绘制你的声纹…';
  var scene=await VoiceCard.prepare(data,{},labels[data.d]),image=scene.png(),card=document.getElementById('card'),link=document.getElementById('download');
  card.src=image;card.hidden=false;link.href=image;link.hidden=false;
  status.textContent='长按图片可保存静态卡片；带原声的动态卡片请在录音设备上选择“保存动态卡片视频”。';
  clearTimeout(window.cardLoadingTimer);
 }catch(error){status.textContent=error.message||'卡片链接无效，请重新扫码。';clearTimeout(window.cardLoadingTimer)}
})();

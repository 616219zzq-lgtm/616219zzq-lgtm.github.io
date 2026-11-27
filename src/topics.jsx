import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CardSwap, { Card } from './components/CardSwap';
import './topics.css';
const topics = [...document.querySelectorAll('#topicGrid .topic-card')].map((el, index) => ({title:el.dataset.topic, phrase:el.querySelector('small').textContent, icon:el.querySelector('.topic-symbol').textContent, index}));
const topicArtwork = {'家乡味道':'food','今日心情':'mood','日常问候':'greeting','小时候常听的话':'childhood'};
function Topics(){
 const deck=useRef(null),[active,setActive]=useState(0),[autoplay,setAutoplay]=useState(true);
 function select(index){setActive(index);document.querySelectorAll('#topicGrid .topic-card')[index].click()}
 return <div className="topic-deck-layout"><div className="topic-deck-stage"><CardSwap ref={deck} width={460} height={351.9} cardDistance={105} verticalDistance={70} depth={90} skewAmount={6} visibleCards={4} cardRadius={54} delay={4000} speed={1} bounce={.35} parallax={.5} hoverSpread={.12} dim={.5} autoplay={autoplay} pauseOnHover draggable theme="light" onChange={select} onCardClick={index=>{setAutoplay(false);select(index)}}>{topics.map((t,i)=><Card key={t.title} customClass={'topic-deck-card topic-deck-card-'+i}><img className="topic-deck-artwork" loading="lazy" decoding="async" src={"assets/topics/"+topicArtwork[t.title]+".webp"} alt={t.title+"："+t.phrase} draggable={false} /></Card>)}</CardSwap></div><div className="topic-deck-nav"><button aria-label="上一个话题" onClick={()=>{setAutoplay(false);deck.current?.prev()}}>←</button><span>0{active+1} <i>/ 04</i></span><button aria-label="下一个话题" onClick={()=>{setAutoplay(false);deck.current?.next()}}>→</button></div></div>
}
const host=document.getElementById('topicSwapHost');
if(host){createRoot(host).render(<Topics/>);document.querySelector('.topic-layout').classList.add('has-topic-deck')}

/* <yuki-agent state="idle|listening|thinking|responding|done|searching|downloading|playing|scanning|playlist|syncing|recommending|asking|success|error|sleeping" speed="1">
   Animated agent avatar — Yuki Rhythm Studio palette (191919/1450F0/7DF08A/F7F6F3), dithered, 20fps stepped. Swap states live via attribute. */
(function(){
const B=[[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],[3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]];
const KX=[[25,25,25],[16,50,150],[20,80,240],[144,160,250],[125,240,138],[247,246,243]];
function marble(x,y,t,warp){warp=warp||3;let v=0,a=1,f=0.013;for(let o=0;o<4;o++){v+=a*Math.sin(x*f+warp*Math.sin(y*f*1.7+o*2.1+t*.6)+o*5+t*.4);a*=.55;f*=2.1;}return v;}
function hash(n){return Math.abs(Math.sin(n*127.1+311.7)*43758.5)%1;}
const S=110,C=S/2;
function rr(x,y){const dx=x-C,dy=y-C;return Math.sqrt(dx*dx+dy*dy);}
// each state: {f:(x,y,t)=>v 0..1, g:(ctx,t)=>glyph overlay (optional)}
const ST={
  idle:{f:(x,y,t)=>{const br=Math.sin(t*.9)*.5+.5;const r=rr(x,y);return Math.max(0,1-r/(34+br*12))*(.3+br*.2)+((marble(x,y,t*.25)+2)/4)*.12;}},
  listening:{f:(x,y,t)=>{const env=.4+.6*Math.abs(Math.sin(t*3.1)*.6+Math.sin(t*7.3)*.4);const r=rr(x,y);return (Math.sin(r*.33+t*4)*.5+.5)*env*Math.max(0,1-r/58)+.05;}},
  thinking:{f:(x,y,t)=>(marble(x*1.8,y*1.8,t*1.1)+2)/4},
  responding:{f:(x,y,t)=>{const row=Math.floor(y/9);const w=Math.sin(x*.22-t*7+row*1.7)*.5+.5;const on=((t*2.5)%1.25)>row/12*.9?1:.15;return w*.75*on+.05;}},
  done:{f:(x,y,t)=>{const p=(t*.55)%1.6;const r=rr(x,y);const ring=Math.max(0,1-Math.abs(r-p*70)/9)*Math.max(0,1-p*.6);return .14+((marble(x,y,t*.2)+2)/4)*.1+ring*.8;}},
  searching:{f:(x,y,t)=>{const r=rr(x,y);if(r>52)return .03;let a=Math.atan2(y-C,x-C)-t*2.2;a=((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);const sweep=Math.max(0,1-a/1.6)*.85;const blip=(hash(Math.floor(x/9)*31+Math.floor(y/9))>.93&&(Math.sin(t*3+x)>0))?.9:0;const grid=(x%18<1.5||y%18<1.5)?.1:0;return .05+grid+sweep*Math.max(.2,1-r/60)+blip;}},
  downloading:{f:(x,y,t)=>{const col=Math.floor(x/8);const fill=(t*.22)%1;const lvl=S*(1-fill);if(y>lvl)return .78+((Math.floor(x/4)+Math.floor(y/4))%2)*.14;const fall=((y*.02-t*1.6+hash(col)*9)%1+1)%1;return fall>.75?.55+hash(col*7)*.3:.06;}},
  playing:{f:(x,y,t)=>{const col=Math.floor(x/(S/11));const hgt=(Math.sin(col*2.7+t*3.4)*.5+.5)*.55+.2+Math.sin(col*13.7+t*5.2)*.12;const frac=(S-y)/S;return frac<hgt?(frac>hgt-.1?.95:.55+((marble(x*4,y*4,t*.5)+2)/4)*.15):.05;}},
  scanning:{f:(x,y,t)=>{const sw=((t*.45)%1.3)*S;const d=Math.abs(y-sw);const cell=((Math.floor(x/11)+Math.floor(y/11))%2)?.1:.16;const near=Math.max(0,1-d/16);return cell+near*.75;}},
  playlist:{f:(x,y,t)=>{const rh=13,scroll=t*rh*1.2;const gy=y+scroll;const row=Math.floor(gy/rh);const inRow=x>10&&x<10+hash(row*13)*75;const appear=Math.min(1,Math.max(0,(S-y)/18)); // rows fade in at the bottom edge
    return inRow?(.5+(row%2?0:.15))*appear+(1-appear)*.9*(inRow?1:0):(x>=6&&x<=8?.35:.04);}},
  syncing:{f:(x,y,t)=>{const r=rr(x,y);const ring=Math.max(0,1-Math.abs(r-30)/3)*.25;let v=ring+.05;for(const s of[0,Math.PI]){const px=C+Math.cos(t*2.4+s)*30,py=C+Math.sin(t*2.4+s)*30;const d=Math.sqrt((x-px)**2+(y-py)**2);v+=Math.max(0,1-d/11)*(s?0.75:0.95);}return v;}},
  recommending:{f:(x,y,t)=>{const p=(Math.sin(x*.08+t)+Math.sin(y*.09-t*.7)+Math.sin((x+y)*.05+t))/6+.3;const gl=hash(Math.floor(x/6)*57+Math.floor(y/6)*13+Math.floor(t*2.5))>.965?1:0;return p*.5+gl;}},
  asking:{f:(x,y,t)=>{const r=rr(x,y);return .08+(Math.sin(r*.3-t*1.6)*.5+.5)*.16;},g:(ctx,t)=>{ctx.font='bold 58px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=Math.floor(t*1.6)%2?'#7df08a':'#f7f6f3';ctx.fillText('?',C,C+4);}},
  success:{f:(x,y,t)=>{const p=(t*.9)%1.8;const r=rr(x,y);const burst=Math.max(0,1-Math.abs(r-p*62)/10)*Math.max(0,1-p*.55);const flood=Math.max(0,.5-p*.4);return .12+burst*.9+flood*Math.max(0,1-r/50);},g:(ctx,t)=>{ctx.strokeStyle='#7df08a';ctx.lineWidth=7;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(C-18,C+2);ctx.lineTo(C-5,C+15);ctx.lineTo(C+20,C-14);ctx.stroke();}},
  error:{f:(x,y,t)=>{const gl=Math.sin(y*.7+Math.floor(t*9))>0?Math.random()*.4:0;const band=(Math.floor(y/7)+Math.floor(t*8))%9===0?.5:0;return .06+gl+band;},g:(ctx,t)=>{if(Math.floor(t*2.5)%2)return;ctx.strokeStyle='#f7f6f3';ctx.lineWidth=8;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(C-16,C-16);ctx.lineTo(C+16,C+16);ctx.moveTo(C+16,C-16);ctx.lineTo(C-16,C+16);ctx.stroke();}},
  sleeping:{f:(x,y,t)=>((marble(x*.8,y*.8,t*.08)+2)/4)*.14,g:(ctx,t)=>{ctx.font='bold 20px monospace';ctx.fillStyle='#1450f0';const dr=(t*.25)%1;ctx.globalAlpha=1-dr;ctx.fillText('z',C+14,C-6-dr*22);ctx.font='bold 28px monospace';ctx.fillStyle='#90a0f8';ctx.fillText('Z',C+26,C-18-dr*30);ctx.globalAlpha=1;}}
};
// b-variants — alternate motions, no glyph overlays
ST['idle-b']={f:(x,y,t)=>{const br=Math.sin(t*.7)*.5+.5;const hor=Math.max(0,1-Math.abs(y-(C+Math.sin(x*.05+t*.5)*6))/ (5+br*7));return .05+hor*(.35+br*.3)+((marble(x*.7,y*.7,t*.15)+2)/4)*.1;}};
ST['done-b']={f:(x,y,t)=>{const p=1-((t*.4)%1.5)/1.5;const r=rr(x,y);const ring=Math.max(0,1-Math.abs(r-p*66)/7)*(1-p)*.9;return .12+ring+Math.max(0,1-r/22)*.25*(1-p);}};
ST['playlist-b']={f:(x,y,t)=>{const rh=13,scroll=t*rh*1.2;const gy=y+scroll;const row=Math.floor(gy/rh);const born=row*0.83;const age=Math.max(0,t-born+9);const slide=Math.min(1,age*1.4);const w=(14+hash(row*13)*70)*slide;if(x>10&&x<10+w)return slide<1?.9:(row%2?.5:.65);return x>=6&&x<=8?.3:.04;}};
ST['recommending-b']={f:(x,y,t)=>{let v=.06+((marble(x,y,t*.3)+2)/4)*.12;for(let k=0;k<5;k++){const a=t*.9+k*1.26;const rad=18+((t*14+k*17)%42);const px=C+Math.cos(a)*rad,py=C+Math.sin(a)*rad;const d=Math.sqrt((x-px)**2+(y-py)**2);v+=Math.max(0,1-d/6)*(1-rad/70);}return v;}};
ST['asking-b']={f:(x,y,t)=>{const rise=(Math.sin(y*.24+t*3.2)*.5+.5)*Math.pow(1-y/S,1.4);const tilt=Math.sin(t*2.2);const p1=Math.max(0,1-Math.sqrt((x-(C-20))**2+(y-C)**2)/13)*(.5+tilt*.4);const p2=Math.max(0,1-Math.sqrt((x-(C+20))**2+(y-C)**2)/13)*(.5-tilt*.4);return .05+rise*.3+p1+p2;}};
ST['success-b']={f:(x,y,t)=>{const p=(t*.8)%2;const flood=Math.max(0,.85-p*.7);const conf=hash(Math.floor(x/5)*41+Math.floor((y-t*55)/5)*17)>.94?1:0;const r=rr(x,y);return .1+flood*Math.max(.3,1-r/70)+conf*Math.max(0,.9-p*.35);}};
ST['error-b']={f:(x,y,t)=>{const band=Math.floor(y/6);const tear=hash(band*31+Math.floor(t*7))>.6?hash(band*7+Math.floor(t*7))*30:0;const xx=x+tear;const stripe=(Math.floor(xx/9)+Math.floor(t*8))%7===0?.7:0;const flick=Math.floor(t*11)%13===0?.5:0;return .05+stripe+Math.random()*.22+flick;}};
ST['sleeping-b']={f:(x,y,t)=>{const br=Math.sin(t*.35)*.5+.5;const sea=Math.max(0,(y-(66-br*8))/S)*.5;return sea*(.3+((marble(x*1.2,y*2,t*.06)+2)/4)*.3)+.02;}};
class YukiAgent extends HTMLElement{
  static get observedAttributes(){return['state','speed'];}
  attributeChangedCallback(){this._state=this.getAttribute('state')||'idle';this._speed=parseFloat(this.getAttribute('speed')||'1');}
  connectedCallback(){
    if(this._c)return;
    this._state=this.getAttribute('state')||'idle';
    this._speed=parseFloat(this.getAttribute('speed')||'1');
    this.style.display='block';
    const c=this._c=document.createElement('canvas');c.width=S;c.height=S;
    c.style.cssText='width:100%;height:100%;display:block;image-rendering:pixelated';
    this.appendChild(c);
    const ctx=c.getContext('2d');
    let visible=true,raf=0,last=0;
    try{const io=new IntersectionObserver(e=>{const v=e[0].isIntersecting;const was=visible;visible=v;if(v&&!was)raf=requestAnimationFrame(tick);});io.observe(this);}catch(err){}
    const tick=(now)=>{
      if(!visible||document.visibilityState==='hidden'){raf=0;return;}
      raf=requestAnimationFrame(tick);
      if(now-last<50)return;last=now;
      const t=now/1000*this._speed;
      const st=ST[this._state]||ST.idle;
      const id=ctx.createImageData(S,S),d=id.data;
      for(let y=0;y<S;y++)for(let x=0;x<S;x++){
        let v=st.f(x,y,t);v=Math.max(0,Math.min(1,v));
        const dt=(B[y%8][x%8]/64-.5)*.16;
        let idx=Math.round((v+dt)*(KX.length-1));idx=Math.max(0,Math.min(KX.length-1,idx));
        const p=KX[idx],i=(y*S+x)*4;d[i]=p[0];d[i+1]=p[1];d[i+2]=p[2];d[i+3]=255;
      }
      ctx.putImageData(id,0,0);
      if(st.g)st.g(ctx,t);
    };
    raf=requestAnimationFrame(tick);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&visible&&!raf)raf=requestAnimationFrame(tick);});
  }
}
customElements.define('yuki-agent',YukiAgent);
})();

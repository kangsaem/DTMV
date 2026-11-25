const C=require('../src/core.js');
const w=200,h=200,p=new Float32Array(w*h);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const r=Math.hypot(x-100,y-100); if(r<70&&r>=25)p[y*w+x]=1; // 도넛
 if(Math.hypot(x-100,y-100)<5)p[y*w+x]=1;  // 구멍 안 작은 섬
 if(x>=190&&y>=190&&x<193&&y<193)p[y*w+x]=1; // 잡티
}
p[5*w+5]=1;p[6*w+6]=1; // 대각선 접촉
const t0=Date.now();
for(const o of [{speck:0.01,hole:0,largestOnly:false},{speck:0.01,hole:0.5,largestOnly:false},{speck:0,hole:0,largestOnly:false}]){
 const r=C.vectorize(p,w,h,{threshold:.5,smooth:2,simplify:1,curve:true,scale:1,...o});
 console.log(o, 'paths',r.paths,'nodes',r.nodes, r.d.slice(0,80));
}
// 큰 이미지 성능
const W=2048,H=1536,q=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)q[y*W+x]=Math.hypot((x-1024)/700,(y-800)/600)<1+0.05*Math.sin(x/7)?1:0;
let t=Date.now();const r=C.vectorize(q,W,H,{threshold:.5,smooth:3,simplify:1.5,curve:true,scale:1,speck:.01,hole:.01,largestOnly:false});
console.log('big',Date.now()-t,'ms paths',r.paths,'nodes',r.nodes);
require('fs').writeFileSync(__dirname+'/out_core.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path fill-rule="evenodd" d="${C.vectorize(p,w,h,{threshold:.5,smooth:2,simplify:1,curve:true,scale:1,speck:0,hole:0,largestOnly:false}).d}"/></svg>`);

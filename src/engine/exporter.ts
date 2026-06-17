import type { SceneDoc } from "./types";

// Minified self-contained runtime as a string. Mirrors runtime2d/3d but plain JS.
const RUNTIME_JS = `
const $doc = __SCENE__;
const allNodes = () => { const out=[]; const w=a=>a.forEach(n=>{out.push(n); w(n.children);}); w($doc.nodes); return out; };
const Input = class { constructor(){this.k=new Set(); this.b=new Set(); this.ax={x:0,y:0};} attach(el){this.el=el; el.tabIndex=0; const kd=e=>this.k.add(e.code), ku=e=>this.k.delete(e.code); window.addEventListener('keydown',kd); window.addEventListener('keyup',ku);}
  isDown(c){return this.k.has(c)||this.b.has(c);} isJump(){return this.k.has('Space')||this.b.has('jump');} isRun(){return this.k.has('ShiftLeft')||this.b.has('run');}
  axis(){let x=0,y=0; if(this.k.has('ArrowLeft')||this.k.has('KeyA'))x--; if(this.k.has('ArrowRight')||this.k.has('KeyD'))x++; if(this.k.has('ArrowUp')||this.k.has('KeyW'))y--; if(this.k.has('ArrowDown')||this.k.has('KeyS'))y++; if(this.ax.x||this.ax.y){x=this.ax.x;y=this.ax.y;} const m=Math.hypot(x,y)||1; return {x:x/Math.max(1,m),y:y/Math.max(1,m)};} };

function runBeh(n,p,b,ctx){
  if(b==='walk'||b==='platformer'){const sp=(p.speed??260)*(ctx.input.isRun()?(p.runMul??1.5):1); const a=ctx.input.axis(); if(ctx.mode==='2d') ctx.s.vx=a.x*sp*(ctx.mode==='2d'?1:60); else {ctx.s.vx=a.x*(p.speed??5); ctx.s.vz=a.y*(p.speed??5);} }
  if(b==='jump'||b==='platformer'){if(ctx.input.isJump()&&ctx.s.grounded){ if(ctx.mode==='2d') ctx.s.vy=-(p.jump??520); else ctx.s.vy=Math.sqrt(2*($doc.settings.gravity||25)*(p.height??1.5)); ctx.s.grounded=false; }}
  if(b==='topdown'){const a=ctx.input.axis(); const sp=(p.speed??200)*(ctx.input.isRun()?1.6:1); n.transform.x+=a.x*sp*ctx.dt; n.transform.y+=a.y*sp*ctx.dt;}
  if(b==='rotate'){const sp=p.speed??1; if(ctx.mode==='2d') n.transform.rz+=sp*ctx.dt; else n.transform.ry+=sp*ctx.dt;}
  if(b==='follow'){const t=allNodes().find(x=>x.name===p.target); if(t){const k=p.smooth??0.1; n.transform.x+=(t.transform.x-n.transform.x)*k; n.transform.y+=(t.transform.y-n.transform.y)*k; n.transform.z+=(t.transform.z-n.transform.z)*k;}}
}

function makeMobile(input){
  const wrap=document.createElement('div'); wrap.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:10';
  const stick=document.createElement('div'); stick.style.cssText='position:absolute;left:24px;bottom:24px;width:120px;height:120px;border-radius:50%;background:#0008;pointer-events:auto;touch-action:none';
  const knob=document.createElement('div'); knob.style.cssText='position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:#fff8';
  stick.appendChild(knob); wrap.appendChild(stick);
  let active=null;
  const onMove=(cx,cy)=>{const r=stick.getBoundingClientRect(); const dx=cx-r.left-r.width/2, dy=cy-r.top-r.height/2; const m=Math.min(40,Math.hypot(dx,dy))||1; const nx=dx/Math.hypot(dx,dy||1), ny=dy/Math.hypot(dx,dy||1); input.ax.x=nx*(m/40); input.ax.y=ny*(m/40); knob.style.left=(35+nx*m*0.6)+'px'; knob.style.top=(35+ny*m*0.6)+'px';};
  stick.addEventListener('pointerdown',e=>{active=e.pointerId; stick.setPointerCapture(e.pointerId); onMove(e.clientX,e.clientY);});
  stick.addEventListener('pointermove',e=>{if(active===e.pointerId)onMove(e.clientX,e.clientY);});
  stick.addEventListener('pointerup',e=>{active=null; input.ax.x=0;input.ax.y=0; knob.style.left='35px'; knob.style.top='35px';});
  const mkBtn=(label,key,right,bottom)=>{const b=document.createElement('button'); b.textContent=label; b.style.cssText='position:absolute;right:'+right+'px;bottom:'+bottom+'px;width:70px;height:70px;border-radius:50%;background:#7c5cff;color:#fff;border:none;font:600 16px system-ui;pointer-events:auto;touch-action:none'; b.addEventListener('pointerdown',e=>{input.b.add(key); e.preventDefault();}); b.addEventListener('pointerup',()=>input.b.delete(key)); b.addEventListener('pointercancel',()=>input.b.delete(key)); wrap.appendChild(b);};
  mkBtn('A','jump',24,40); mkBtn('B','action',104,90);
  document.body.appendChild(wrap);
}

async function start(){
  const input=new Input();
  if(matchMedia('(pointer:coarse)').matches && $doc.settings.mobileControls) makeMobile(input);

  if($doc.mode==='2d'){
    const cv=document.createElement('canvas'); cv.width=$doc.settings.width; cv.height=$doc.settings.height;
    cv.style.cssText='display:block;margin:auto;background:'+$doc.settings.background+';max-width:100%;max-height:100vh';
    document.body.appendChild(cv); input.attach(cv);
    const ctx=cv.getContext('2d');
    const states=new Map(); allNodes().forEach(n=>states.set(n.id,{vx:0,vy:0,grounded:false}));
    let cam={x:0,y:0}; let last=performance.now();
    function aabb(a,b){return Math.abs(a.transform.x-b.transform.x)<(a.props.w+b.props.w)/2 && Math.abs(a.transform.y-b.transform.y)<(a.props.h+b.props.h)/2;}
    function loop(t){const dt=Math.min(0.05,(t-last)/1000); last=t;
      const solids=allNodes().filter(n=>n.props.solid);
      for(const n of allNodes()){const s=states.get(n.id); const c={input,dt,s,mode:'2d'};
        n.behaviors.forEach(b=>runBeh(n,b.params,b.kind,c));
        if(n.type==='player2d'){ s.vy+=$doc.settings.gravity*dt; n.transform.x+=s.vx*dt;
          for(const sd of solids) if(aabb(n,sd)){ if(s.vx>0)n.transform.x=sd.transform.x-sd.props.w/2-n.props.w/2; else if(s.vx<0)n.transform.x=sd.transform.x+sd.props.w/2+n.props.w/2; s.vx=0; }
          n.transform.y+=s.vy*dt; s.grounded=false;
          for(const sd of solids) if(aabb(n,sd)){ if(s.vy>0){n.transform.y=sd.transform.y-sd.props.h/2-n.props.h/2; s.grounded=true;} else if(s.vy<0) n.transform.y=sd.transform.y+sd.props.h/2+n.props.h/2; s.vy=0; }
        }
      }
      const cm=allNodes().find(n=>n.type==='camera2d'); if(cm){const f=cm.props.follow?allNodes().find(n=>n.name===cm.props.follow):null; if(f){cam.x=f.transform.x; cam.y=f.transform.y;}}
      ctx.fillStyle=$doc.settings.background; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.save(); ctx.translate(cv.width/2-cam.x, cv.height/2-cam.y);
      for(const n of allNodes()){ ctx.save(); ctx.translate(n.transform.x,n.transform.y); ctx.rotate(n.transform.rz);
        if(n.type==='sprite'||n.type==='player2d'){ctx.fillStyle=n.props.color||'#fff'; ctx.fillRect(-n.props.w/2,-n.props.h/2,n.props.w,n.props.h);}
        else if(n.type==='text'){ctx.fillStyle=n.props.color||'#fff'; ctx.font=(n.props.size||20)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(n.props.text||'',0,0);}
        else if(n.type==='button'){ctx.fillStyle=n.props.color||'#7c5cff'; ctx.fillRect(-n.props.w/2,-n.props.h/2,n.props.w,n.props.h); ctx.fillStyle='#fff'; ctx.font='14px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(n.props.label||'',0,0);}
        ctx.restore();
      }
      ctx.restore();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  } else {
    const THREE=window.THREE;
    const ren=new THREE.WebGLRenderer({antialias:true}); ren.setPixelRatio(devicePixelRatio); ren.setSize(innerWidth,innerHeight); document.body.appendChild(ren.domElement); input.attach(ren.domElement);
    const sc=new THREE.Scene(); sc.background=new THREE.Color($doc.settings.background);
    const cam=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,500);
    addEventListener('resize',()=>{ren.setSize(innerWidth,innerHeight); cam.aspect=innerWidth/innerHeight; cam.updateProjectionMatrix();});
    const states=new Map();
    function mk(n){let o=null;
      if(n.type==='box') o=new THREE.Mesh(new THREE.BoxGeometry(n.props.w,n.props.h,n.props.d),new THREE.MeshStandardMaterial({color:n.props.color}));
      else if(n.type==='sphere') o=new THREE.Mesh(new THREE.SphereGeometry(n.props.r,24,16),new THREE.MeshStandardMaterial({color:n.props.color}));
      else if(n.type==='plane'){o=new THREE.Mesh(new THREE.PlaneGeometry(n.props.w,n.props.h),new THREE.MeshStandardMaterial({color:n.props.color})); o.rotation.x=-Math.PI/2;}
      else if(n.type==='player3d') o=new THREE.Mesh(new THREE.CapsuleGeometry(n.props.r,n.props.h,4,8),new THREE.MeshStandardMaterial({color:n.props.color}));
      else if(n.type==='light'){if(n.props.kind==='ambient') o=new THREE.AmbientLight(n.props.color,n.props.intensity); else if(n.props.kind==='directional') o=new THREE.DirectionalLight(n.props.color,n.props.intensity); else o=new THREE.PointLight(n.props.color,n.props.intensity,50);}
      if(o){o.position.set(n.transform.x,n.transform.y,n.transform.z); if(n.type!=='plane') o.rotation.set(n.transform.rx,n.transform.ry,n.transform.rz);}
      return o;
    }
    for(const n of allNodes()){const o=mk(n); if(o){sc.add(o); states.set(n.id,{obj:o,vx:0,vy:0,vz:0,grounded:false});}}
    let last=performance.now();
    function loop(t){const dt=Math.min(0.05,(t-last)/1000); last=t;
      for(const n of allNodes()){const s=states.get(n.id); if(!s) continue; const c={input,dt,s,mode:'3d'};
        n.behaviors.forEach(b=>runBeh(n,b.params,b.kind,c));
        if(n.type==='player3d'){s.vy-=$doc.settings.gravity*dt; n.transform.x+=s.vx*dt; n.transform.z+=s.vz*dt; n.transform.y+=s.vy*dt; const gy=(n.props.h)/2+(n.props.r); if(n.transform.y<gy){n.transform.y=gy; s.vy=0; s.grounded=true;}}
        s.obj.position.set(n.transform.x,n.transform.y,n.transform.z); if(n.type!=='plane') s.obj.rotation.set(n.transform.rx,n.transform.ry,n.transform.rz);
      }
      const cm=allNodes().find(n=>n.type==='camera3d'); if(cm){const f=cm.props.follow?allNodes().find(n=>n.name===cm.props.follow):null; if(f){cam.position.set(f.transform.x,f.transform.y+4,f.transform.z+8); cam.lookAt(f.transform.x,f.transform.y,f.transform.z);} else {cam.position.set(cm.transform.x,cm.transform.y,cm.transform.z); cam.lookAt(0,0,0);}}
      ren.render(sc,cam); requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
}
start();
`;

export function exportHTML(doc: SceneDoc): string {
  const three = doc.mode === "3d"
    ? `<script src="https://unpkg.com/three@0.184.0/build/three.min.js"></script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>${escape(doc.name)}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:system-ui}canvas{display:block}</style>
${three}</head><body><script>${RUNTIME_JS.replace("__SCENE__", JSON.stringify(doc))}</script></body></html>`;
}

function escape(s: string) { return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }

export function download(filename: string, content: string, mime = "text/html") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


const fs=require('fs'), path=require('path'), acorn=require('acorn');
const ROOT='/Volumes/work/code/rea/screen-studio';
const NM=ROOT+'/app-extracted/node_modules';
const STR_RE=/(['"])((?:\\.|(?!\1)[^\\\n]){6,80})\1/g;

function stringsOfFile(file,cap){
  let txt;
  try{txt=fs.readFileSync(file,'utf8');}catch(e){return [];}
  if(txt.length>cap)txt=txt.slice(0,cap);
  const out=new Set();let m;
  while((m=STR_RE.exec(txt))){const v=m[2];if(v&&!/^[0-9a-f]{8,}$/i.test(v))out.add(v);if(out.size>4000)break;}
  return [...out];
}
const pkgs=fs.readdirSync(NM).filter(p=>!p.startsWith('.'));
const index=new Map(); // string -> Map(pkg,count)
let totalStrings=0;
for(const p of pkgs){
  const dir=path.join(NM,p);
  if(!fs.statSync(dir).isDirectory())continue;
  let files=[];
  (function walkD(d,depth){if(depth>4)return;let ents;try{ents=fs.readdirSync(d,{withFileTypes:true});}catch(e){return;}
    for(const e of ents){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const fp=path.join(d,e.name);
      if(e.isDirectory())walkD(fp,depth+1);
      else if(/\.(js|cjs|mjs|json)$/.test(e.name))files.push(fp);if(files.length>300)return;}})(dir,0);
  const set=new Set();
  for(const f of files){for(const s of stringsOfFile(f,200000))set.add(s);if(set.size>6000)break;}
  totalStrings+=set.size;
  for(const s of set){let m=index.get(s);if(!m){m=new Map();index.set(s,m);}m.set(p,(m.get(p)||0)+1);}
}
console.log('packages',pkgs.length,'fingerprint strings',index.size,'total',totalStrings);

// classify main blocks
const src=fs.readFileSync(ROOT+'/main-deob2.js','utf8');
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'});
const results=[];
for(const node of ast.body){
  const len=node.end-node.start;
  if(len<1500)continue;
  const txt=src.slice(node.start,node.end);
  if(/^\s*(function _0x[0-9a-f]+\(\_0x[0-9a-f]+,|\(function\(_0x[0-9a-f]+,_0x[0-9a-f]+\)\{)/.test(txt)&&node.start<200){
    results.push({start:node.start,end:node.end,len,owner:'__obfuscator__',score:999});continue;
  }
  const strs=[];const re=/(['"])((?:\\.|(?!\1)[^\\\n]){6,80})\1/g;let m;
  while((m=re.exec(txt)))strs.push(m[2]);
  const pkgScore=new Map();
  for(const s of strs){const hit=index.get(s);if(!hit)continue;for(const [p,c] of hit)pkgScore.set(p,(pkgScore.get(p)||0)+1);}
  let best=null,bestScore=0;
  for(const [p,c] of pkgScore)if(c>bestScore){best=p;bestScore=c;}
  results.push({start:node.start,end:node.end,len,owner:bestScore>=4?best:'APP',score:bestScore,strs:strs.length});
}
const byOwner={};
for(const r of results){byOwner[r.owner]=(byOwner[r.owner]||0)+r.len;}
console.log('blocks',results.length);
console.log('--- bytes by owner (top 25) ---');
Object.entries(byOwner).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([o,b])=>console.log(String(b).padStart(9),o));
const appBytes=results.filter(r=>r.owner==='APP').reduce((a,r)=>a+r.len,0);
console.log('APP total bytes',appBytes,'blocks',results.filter(r=>r.owner==='APP').length);
fs.writeFileSync(ROOT+'/main-owners.json',JSON.stringify(results));

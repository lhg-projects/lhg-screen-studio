
const fs=require('fs'), path=require('path'), acorn=require('acorn');
const ROOT='/Volumes/work/code/rea/screen-studio';
const src=fs.readFileSync(ROOT+'/main-deob2.js','utf8');
const owners=JSON.parse(fs.readFileSync(ROOT+'/main-owners.json','utf8'));
const OUT=ROOT+'/reconstructed/src/main/blocks';
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'});
const byStart=new Map();for(const n of ast.body)byStart.set(n.start,n);
const BAD=/^(all|get|set|check|home|test|context|has|add|remove|update|on|emit|query|mutation)$/i;
function slug(node){
  const strs=[];const re=/(['"])((?:\\.|(?!\1)[^\\\n]){6,60})\1/g;let m;
  const txt=src.slice(node.start,node.end);
  while((m=re.exec(txt))&&strs.length<40)strs.push(m[2]);
  const words=[];
  for(const s of strs){
    if(/^[0-9a-f-]{8,}$/i.test(s))continue;
    if(/^[\x00-\x1f]+$/.test(s))continue;
    for(const w of s.split(/[^A-Za-z0-9]+/)){
      if(w.length<5||words.includes(w.toLowerCase()))continue;
      if(['https','http','function','object','string','number','boolean','return','value','length','prototype','undefined'].includes(w.toLowerCase()))continue;
      words.push(w.toLowerCase());
      if(words.length>=3)break;
    }
    if(words.length>=3)break;
  }
  return words.join('-')||'anon';
}
const stats={};
let n=0;
const manifest=[];
for(const r of owners.sort((a,b)=>a.start-b.start)){
  n++;
  const node=byStart.get(r.start);if(!node)continue;
  const owner=(r.owner||'APP').replace(/[^A-Za-z0-9@._-]/g,'_');
  const dir=path.join(OUT,owner);
  fs.mkdirSync(dir,{recursive:true});
  const sl=slug(node);
  const file=path.join(dir,String(n).padStart(3,'0')+'-'+sl.slice(0,44)+'.js');
  const head='/* [block] owner='+owner+' score='+(r.score||0)+' bytes='+r.len+' range='+r.start+'..'+r.end+'\n'
    +' * slice of minified bundle — not an original source file. */\n';
  fs.writeFileSync(file,head+src.slice(r.start,r.end));
  stats[owner]=(stats[owner]||0)+r.len;
  manifest.push({file:path.relative(OUT,file),owner,bytes:r.len,range:[r.start,r.end]});
}
fs.writeFileSync(path.join(OUT,'_manifest.json'),JSON.stringify(manifest,null,1));
console.log('blocks',manifest.length,'owners',Object.keys(stats).length);
Object.entries(stats).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([o,b])=>console.log(String(b).padStart(9),o));

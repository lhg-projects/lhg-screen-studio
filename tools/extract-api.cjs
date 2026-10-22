
const fs=require('fs'), acorn=require('acorn'), walk=require('acorn-walk');
const ROOT='/Volumes/work/code/rea/screen-studio';
const s=fs.readFileSync(ROOT+'/main-deob2.js','utf8');
const ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'script'});
const IPC_M=['handle','handleOnce','on','once','send','invoke','sendSync'];
const ipc=new Map(), trpcQ=new Map(), trpcM=new Map();
function strArg(n){if(!n)return null;if(n.type==='Literal'&&typeof n.value==='string')return n.value;return null;}
walk.full(ast,n=>{
  if(n.type!=='CallExpression')return;
  const c=n.callee;
  if(!c||c.type!=='MemberExpression')return;
  const prop=c.property&&(c.property.name||c.property.value);
  if(!prop)return;
  const a=strArg(n.arguments&&n.arguments[0]);
  if(!a)return;
  if(IPC_M.includes(prop)){
    if(!ipc.has(a))ipc.set(a,new Set());
    ipc.get(a).add(prop);
  }
  if(prop==='query'){trpcQ.set(a,(trpcQ.get(a)||0)+1);}
  if(prop==='mutation'){trpcM.set(a,(trpcM.get(a)||0)+1);}
});
console.log('=== IPC channels:',ipc.size,'===');
const chans=[...ipc.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
const ns={};
for(const [name,ops] of chans){const n=name.includes(':')?name.split(':')[0]:(name.includes('.')?name.split('.')[0]:'(flat)');(ns[n]=ns[n]||[]).push(name+' ['+[...ops].join(',')+']');}
for(const k of Object.keys(ns).sort())console.log('\n## '+k+' ('+ns[k].length+')\n  '+ns[k].join('\n  '));
console.log('\n=== trpc query names ===');
console.log([...trpcQ.keys()].sort().join('\n'));
console.log('\n=== trpc mutation names ===');
console.log([...trpcM.keys()].sort().join('\n'));
fs.writeFileSync(ROOT+'/index-ipc.json',JSON.stringify({ipc:[...ipc].map(([k,v])=>[k,[...v]]),trpcQuery:[...trpcQ.keys()],trpcMutation:[...trpcM.keys()]},null,1));

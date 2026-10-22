
const fs=require('fs'), acorn=require('acorn');
const s=fs.readFileSync('/Volumes/work/code/rea/screen-studio/main-deob2.js','utf8');
const t0=Date.now();
const ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'script',locations:false});
console.log('parsed in',Date.now()-t0,'ms; top-level statements:',ast.body.length);
const decls=[];
for(const node of ast.body){
  let name=null,kind=node.type;
  if(node.type==='FunctionDeclaration')name=node.id&&node.id.name;
  else if(node.type==='VariableDeclaration'){name=node.declarations.map(d=>d.id&&d.id.name).filter(Boolean).join(',');kind='var';}
  else if(node.type==='ExpressionStatement'){const e=node.expression;if(e.type==='AssignmentExpression'&&e.left.type==='Identifier'){name='assign:'+e.left.name;kind='assign';}}
  const len=node.end-node.start;
  if(len>2000)decls.push({name:name||node.type,kind,start:node.start,end:node.end,len});
}
decls.sort((a,b)=>b.len-a.len);
console.log('statements >2KB:',decls.length);
console.log('total bytes in them:',decls.reduce((a,d)=>a+d.len,0));
console.log('--- top 25 by size ---');
for(const d of decls.slice(0,25))console.log(String(d.len).padStart(9), d.kind.padEnd(6), (d.name||'').slice(0,60));
fs.writeFileSync('/Volumes/work/code/rea/screen-studio/main-blocks.json',JSON.stringify(decls,null,0));

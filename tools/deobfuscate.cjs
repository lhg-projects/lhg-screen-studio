
const fs=require('fs'),vm=require('vm');
const BS=String.fromCharCode(92);
function balanced(src,start){const open=src[start],close=open==='('?')':'}';let depth=0,inStr=null,esc=false;
 for(let i=start;i<src.length;i++){const c=src[i];
  if(inStr){if(esc){esc=false;continue;}if(c===BS){esc=true;continue;}if(c===inStr){inStr=null;}continue;}
  if(c==="'"||c==='"'){inStr=c;continue;}
  if(c===open)depth++;else if(c===close){depth--;if(depth===0)return{text:src.slice(start,i+1),end:i};}}
 throw new Error('unbalanced');}
function fnSource(s,name){const i=s.indexOf('function '+name+'(');if(i<0)return null;const p=balanced(s,s.indexOf('(',i));const b=balanced(s,p.end+1);return{start:i,end:b.end,params:p.text,body:b.text,full:'function '+name+p.text+b.text};}
const [,,file,out]=process.argv;
let s=fs.readFileSync(file,'utf8');
// decoder + array detection
let decName=null,arrName=null;
for(const m of s.matchAll(/function (_0x[0-9a-f]+)\(_0x[0-9a-f]+,_0x[0-9a-f]+\)\{(?:var|const|let) (_0x[0-9a-f]+)=(_0x[0-9a-f]+)\(\)/g)){
  decName=m[1];arrName=m[3];break;
}
if(!decName)throw new Error('no decoder');
const decFn=fnSource(s,decName), arrFn=fnSource(s,arrName);
if(!arrFn)throw new Error('no array fn '+arrName);
// rotation
let rotStart=-1,rotEnd=-1;
const reRot=/\(function\(_0x[0-9a-f]+,_0x[0-9a-f]+\)\{/g;let m2;
while((m2=reRot.exec(s))){const marker=s.indexOf('}('+arrName+',',m2.index);if(marker>m2.index){rotStart=m2.index;rotEnd=s.indexOf('));',marker)+3;break;}}
const ctx={console,atob:x=>Buffer.from(x,'base64').toString('binary'),Buffer,decodeURIComponent,unescape};
vm.createContext(ctx);
vm.runInContext(arrFn.full+';'+decFn.full+';'+(rotStart>=0?s.slice(rotStart,rotEnd):'')+';globalThis.__dec='+decName+';',ctx);
const dec=ctx.__dec;
const aliasDecl=[...s.matchAll(/(?:var|const|let) (_0x[0-9a-f]+)=(_0x[0-9a-f]+)(?=[,;])/g)].filter(m=>m[2]!==arrName);
const aliases=[...new Set(aliasDecl.map(m=>m[1]))];
const ranges=[[arrFn.start,arrFn.end],[decFn.start,decFn.end],[rotStart,rotEnd]];
const names=[decName,...aliases];
let count=0,skipped=0;const sk=[];
const re=new RegExp('('+names.join('|')+')[(](0x[0-9a-f]+)[)]','g');
s=s.replace(re,(m,name,h,offset)=>{
  for(const rg of ranges)if(offset>=rg[0]&&offset<=rg[1])return m;
  const v=dec(parseInt(h,16));
  if(typeof v!=='string'){skipped++;if(sk.length<3)sk.push(name+'('+h+')');return m;}
  count++;return JSON.stringify(v);
});
fs.writeFileSync(out,s);
console.log('dec',decName,'arr',arrName,'rot',rotStart,'aliases',aliases.length,'replaced',count,'skipped',skipped,sk.join(','));

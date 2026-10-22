
const fs=require('fs'), path=require('path'), cp=require('child_process');
const ROOT='/Volumes/work/code/rea/screen-studio';
const SRC=ROOT+'/app-extracted/dist';
const OUT=ROOT+'/reconstructed/src/renderer';
fs.mkdirSync(OUT,{recursive:true});
const files=fs.readdirSync(SRC).filter(f=>f.endsWith('.js')).sort();
let ok=0, copied=0, failed=[];
for(const f of files){
  const src=path.join(SRC,f), dst=path.join(OUT,f);
  const txt=fs.readFileSync(src,'utf8');
  const obfuscated=/function _0x[0-9a-f]+\(_0x[0-9a-f]+,_0x[0-9a-f]+\)\{/.test(txt);
  if(!obfuscated){fs.copyFileSync(src,dst);copied++;continue;}
  try{
    cp.execFileSync(process.execPath,[ROOT+'/deob4.cjs',src,dst],{stdio:'pipe'});
    ok++;
  }catch(e){failed.push(f+': '+String(e.stderr||e.message).slice(0,120));fs.copyFileSync(src,dst);copied++;}
}
console.log('deobfuscated',ok,'copied-as-is',copied,'failed',failed.length);
failed.slice(0,10).forEach(x=>console.log(' -',x));


const fs=require('fs'), path=require('path');
const ROOT='/Volumes/work/code/rea/screen-studio';
const src=fs.readFileSync(ROOT+'/main-deob2.js','utf8');
const OUT=ROOT+'/reconstructed/src/main/slices';
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const ANCHORS=[
 ['licensing-token-store','auth-persistance',30000,30000],
 ['licensing-token-validate',"'auth.isTokenValid'",25000,35000],
 ['licensing-activation-status',"'activation.status'",20000,20000],
 ['licensing-license-verify',"'license.verify'",15000,25000],
 ['licensing-server-client','x-screen-studio-app-version',15000,25000],
 ['licensing-token-payload-schema','decodeIfValid',8000,12000],
 ['recording-unfinished-store',"'unfinishedRecordings'",15000,20000],
 ['recording-capture-kit','ScreenCaptureKit',15000,20000],
 ['recording-model','recordingTimeMs',15000,20000],
 ['project-model-zoom','zoomRanges',15000,20000],
 ['project-read','readProject',15000,20000],
 ['project-recent','markAsRecent',8000,12000],
 ['export-pipeline','exportTranscriptAsSRT',15000,20000],
 ['ffmpeg-bridge','setFfmpegPath',10000,15000],
 ['updater','autoUpdater',12000,18000],
 ['window-management','browser-window-created',12000,18000],
 ['app-menu','setApplicationMenu',12000,18000],
 ['permissions','node-mac-permissions',8000,12000],
 ['sharing','share.prepareShareableLink',10000,15000],
 ['captions','generateMissing',10000,15000],
 ['telemetry','Sentry.init',8000,12000],
 ['ipc-bridge-router','AppBridge',12000,16000],
 ['dev-tools','dev.test',8000,12000]
];
const ranges=[];
for(const [name,needle,before,after] of ANCHORS){
  let i=src.indexOf(needle);
  if(i<0){console.log('MISS',name,needle);continue;}
  ranges.push({name,needle,at:i,start:Math.max(0,i-before),end:Math.min(src.length,i+after)});
}
ranges.sort((a,b)=>a.start-b.start);
const merged=[];
for(const r of ranges){
  const last=merged[merged.length-1];
  if(last&&r.start<=last.end){last.end=Math.max(last.end,r.end);last.names.push(r.name);last.needles.push(r.needle);}
  else merged.push({start:r.start,end:r.end,names:[r.name],needles:[r.needle]});
}
const manifest=[];
let n=0;
for(const m of merged){
  n++;
  const base=String(n).padStart(2,'0')+'-'+m.names[0]+'.js';
  const file=path.join(OUT,base);
  const head='/*\n * [reconstructed slice] '+m.names.join(', ')+'\n'
   +' * anchors: '+m.needles.join(' | ')+'\n'
   +' * byte range: '+m.start+'..'+m.end+' ('+(m.end-m.start)+' bytes)\n'
   +' * source: dist-electron/index.js -> javascript-obfuscator string array deobfuscated\n'
   +' * NOTE: slice of a minified bundle; not an original source file.\n */\n';
  fs.writeFileSync(file,head+src.slice(m.start,m.end));
  manifest.push({file:base,names:m.names,bytes:m.end-m.start,range:[m.start,m.end]});
  console.log(('slices/'+base).padEnd(52),(m.end-m.start)+'B',m.names.join('+'));
}
fs.writeFileSync(OUT+'/_manifest.json',JSON.stringify(manifest,null,1));
console.log('total',merged.length);

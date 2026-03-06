const http=require("http"),fs=require("fs"),path=require("path"),url=require("url"),cp=require("child_process");
const root=path.resolve(process.argv[2]||process.cwd());
const port=parseInt(process.argv[3]||process.env.PORTA||"8000",10);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".ico":"image/x-icon"};
const st={running:false,last_start:0,last_end:0,last_ok:0,last_err:"",next_run:0,tm:null};
const fdb=String(process.env.FDB_FILE||"").trim();
const script=String(process.env.GEN_SCRIPT||"").trim();
const dbuser=String(process.env.DBUSER||"SYSDBA").trim();
const dbpass=String(process.env.DBPASS||"masterkey").trim();
const key=String(process.env.SRVKEY||"").trim();
const webip=String(process.env.WEB_IP||"127.0.0.1").trim();
const hist=path.join(root,"historico");
const atual=path.join(root,"relatorio_atual.html");
const tmp=path.join(root,"_tmp_relatorio.html");
const MS15=15*60*1000;
const ua=()=>String(process.env.USERPROFILE||"").trim();
const ensureDir=p=>{if(!fs.existsSync(p))fs.mkdirSync(p,{recursive:true});};
const proibFile=path.join(root,"_proibidos.txt");
const normP=s=>String(s||"").trim().toUpperCase().replace(/\s+/g," ");
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const parseLista=s=>uniq(String(s||"").split(/\n|,/g).map(normP).filter(Boolean));
const lerProib=cb=>{fs.readFile(proibFile,"utf8",(e,txt)=>{cb(parseLista(e?"":txt));});};
const salvarProib=(arr,cb)=>{fs.writeFile(proibFile,uniq(arr).map(normP).filter(Boolean).join("\n"),"utf8",()=>{cb&&cb();});};

const deskPath=d=>{
const up=ua();
if(!up)return"";
const dd=String(d.getDate()).padStart(2,"0");
const mm=String(d.getMonth()+1).padStart(2,"0");
const yy=String(d.getFullYear());
return path.join(up,"Desktop",`(FDB-DIA)_relatorio_${dd}-${mm}-${yy}.html`);
};
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const okJson=(res,obj,code=200,extra)=>{res.writeHead(code,Object.assign({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},extra||{}));res.end(JSON.stringify(obj||{}));};
const bad=(res,code,msg)=>{res.writeHead(code,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});res.end(String(msg||code));};
const cors=()=>({"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"x-key,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Max-Age":"600"});
const serveFile=(res,fp)=>{
fs.stat(fp,(e,s)=>{
if(e||!s.isFile())return bad(res,404,"404");
const ext=path.extname(fp).toLowerCase();
res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Cache-Control":"no-store"});
fs.createReadStream(fp).pipe(res);
});
};
const cleanHist=d=>{
ensureDir(hist);
const mid=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
fs.readdir(hist,(e,list)=>{
if(e||!Array.isArray(list)||!list.length)return;
for(const name of list){
if(!name||!/\.html$/i.test(name))continue;
const fp=path.join(hist,name);
fs.stat(fp,(e2,s)=>{
if(e2||!s||!s.isFile())return;
const mt=Number(s.mtimeMs||0);
if(mt&&mt<mid)fs.unlink(fp,()=>{});
});
}
});
};
const scheduleIn=ms=>{
if(st.tm)clearTimeout(st.tm);
if(ms<1000)ms=1000;
st.next_run=Date.now()+ms;
st.tm=setTimeout(()=>{gerar("auto").then(()=>scheduleIn(MS15));},ms);
};
const initSchedule=()=>{
let ms=MS15;
if(fs.existsSync(atual)){
const m=fs.statSync(atual).mtimeMs;
const next=m+MS15;
const now=Date.now();
if(next>now+1000)ms=next-now;
}
scheduleIn(ms);
};
const gerar=(motivo)=>{
if(st.running)return Promise.resolve({ok:false,estado:"running"});
if(!fdb||!script)return Promise.resolve({ok:false,estado:"sem_cfg"});
st.running=true;
st.last_start=Date.now();
st.last_err="";
const d=new Date();
const dataISO=isoDate(d);
const env=Object.assign({},process.env,{FDB_SRV_KEY:key,FDB_SRV_BASE_LOCAL:`http://127.0.0.1:${port}`,FDB_SRV_BASE_REDE:`http://${webip}:${port}`});
return new Promise(res=>{
ensureDir(hist);
const args=[script,"--fdb",fdb,"--data",dataISO,"--saida",tmp,"--user",dbuser,"--pass",dbpass];
const p=cp.spawn(process.execPath,args,{env,windowsHide:true});
let out="";
p.stdout.on("data",b=>{out+=String(b||"");});
p.stderr.on("data",b=>{out+=String(b||"");});
p.on("close",code=>{
st.running=false;
st.last_end=Date.now();
if(code===0&&fs.existsSync(tmp)){
const dp=deskPath(d);
const dd=String(d.getDate()).padStart(2,"0");
const mm=String(d.getMonth()+1).padStart(2,"0");
const yy=String(d.getFullYear());
const hh=String(d.getHours()).padStart(2,"0");
const mi=String(d.getMinutes()).padStart(2,"0");
const histFile=path.join(hist,`(FDB-DIA)_relatorio_${dd}-${mm}-${yy}_${hh}-${mi}.html`);
fs.copyFileSync(tmp,atual);
if(dp)fs.copyFileSync(tmp,dp);
fs.copyFileSync(tmp,histFile);
fs.unlinkSync(tmp);
st.last_ok=Date.now();
cleanHist(d);
scheduleIn(MS15);
res({ok:true,estado:"ok",motivo,saida_atual:atual,next_run:st.next_run});
return;
}
st.last_err=out.slice(-2000)||("erro "+code);
scheduleIn(MS15);
res({ok:false,estado:"erro",code,erro:st.last_err,next_run:st.next_run});
});
});
};
ensureDir(hist);
cleanHist(new Date());
initSchedule();
const srv=http.createServer((req,res)=>{
const u=url.parse(req.url||"",true);
const p=String(u.pathname||"/");
if(req.method==="OPTIONS"){res.writeHead(204,cors());res.end();return;}
if(p==="/__status"&&req.method==="GET"){okJson(res,{running:st.running,last_start:st.last_start,last_end:st.last_end,last_ok:st.last_ok,last_err:st.last_err,next_run:st.next_run,port},200,cors());return;}
if(p==="/__gerar"&&req.method==="POST"){
const k=String(req.headers["x-key"]||"").trim();
if(!key||k!==key){okJson(res,{ok:false,estado:"unauth"},401,cors());return;}
if(st.running){okJson(res,{ok:false,estado:"running",running:true,last_start:st.last_start,last_ok:st.last_ok,next_run:st.next_run},409,cors());return;}
gerar("manual").then(r=>okJson(res,r,200,cors()));
return;
}
if(p==="/__proibidos"&&req.method==="GET"){lerProib(lista=>okJson(res,{ok:true,lista},200,cors()));return;}
if(p==="/__proibidos"&&req.method==="POST"){
const k=String(req.headers["x-key"]||"").trim();
if(key&&k!==key){okJson(res,{ok:false,estado:"unauth"},401,cors());return;}
let body="";
req.on("data",b=>{body+=String(b||"");if(body.length>200000)body=body.slice(0,200000);});
req.on("end",()=>{const inc=parseLista(body);lerProib(lista0=>{const merged=uniq([...lista0,...inc].map(normP).filter(Boolean));salvarProib(merged,()=>okJson(res,{ok:true,lista:merged},200,cors()));});});
return;
}

let rel=p;
if(rel==="/"||rel==="")rel="/relatorio_atual.html";
rel=rel.replace(/^\/+/,"");
const fp=path.resolve(path.join(root,rel));
if(fp.indexOf(root)!==0)return bad(res,403,"403");
serveFile(res,fp);
});
srv.listen(port,"0.0.0.0",()=>{console.log("SERVIDOR_OK",port,root);});
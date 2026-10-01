import fs from "node:fs/promises";
import crypto from "node:crypto";
import { AutoTokenizer, AutoModelForSequenceClassification } from "@huggingface/transformers";

const HADITH = [
  ["Muwatta","Maliks Muwatta Without_Tashkel.csv"],
  ["Ahmad","Musnad Ahmad ibn Hanbal Without_Tashkel.csv"],
  ["Bukhari","Sahih Bukhari Without_Tashkel.csv"],
  ["Muslim","Sahih Muslime Without_Tashkel.csv"],
  ["Abu Dawud","Sunan Abu Dawud Without_Tashkel.csv"],
  ["Ibn Maja","Sunan Ibn Maja Without_Tashkel.csv"],
  ["Darimi","Sunan al Darami Without_Tashkel.csv"],
  ["Tirmidhi","Sunan al Tirmidhi Without_Tashkel.csv"],
  ["Nasai","Sunan al-Nasai Without_Tashkel.csv"]
];
const HB="https://raw.githubusercontent.com/abdelrahmaan/Hadith-Data-Sets/master/All%20Hadith%20Books/";
const QB="https://raw.githubusercontent.com/semarketir/quranjson/master/source/surah/surah_";
const SMALL="MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli";
const LARGE="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli";

function norm(s){return s.normalize("NFKD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ة/g,"ه").replace(/ـ/g,"").replace(/[^\u0600-\u06FF\s]/g," ").replace(/\s+/g," ").trim();}
const stop=new Set("من في عن على إلى اليه به بها له لها ما وما لا لم لن إن ان أن كان كانت يكون هو هي هم هن و او أو ثم قد لقد يا أي أيها الذين الذي التي هذا هذه ذلك تلك فإن فان إنما إنه أنها كما مع عند بين كل بعض أحد احد غير بعد قبل حيث حتى منكم لنا لكم لهم لهن نحن أنا أنت أنتم".split(/\s+/));
function toks(s){const out=new Set();for(const x of norm(s).split(/\s+/)){if(x.length<3||stop.has(x))continue;let w=x.replace(/^(وال|بال|لل|ال|ف|و|ب|ك|ل)/,"");if(w.length>=3&&!stop.has(w))out.add(w);const st=w.replace(/(هما|هما|هم|هن|ها|ه|كم|كن|نا|ني|ك|ي|ون|ين|ات|ان|ة)$/,"");if(st.length>=3&&!stop.has(st))out.add(st);}return [...out];}
function matn(s){const marks=["قال رسول الله","قال النبي","أن رسول الله","أن النبي","يقول رسول الله","يقول النبي"];let p=-1;for(const m of marks)p=Math.max(p,s.lastIndexOf(m));return p>=0?s.slice(p,p+1800):s.slice(-1800);}
function hardRule(t){
 const x=norm(t);
 if(/أمرت أن أقاتل الناس حتى يشهدوا|قاتل الناس حتى يشهدوا/.test(x))return ["R01",["2:256","10:99"],"القتال حتى الإيمان"];
 if(/من بدل دينه.{0,100}(فاقتلوه|اقتلوه|فقتلوه)|رجع عن دينه.{0,100}(فاقتلوه|اقتلوه)/.test(x))return ["R02",["2:256","17:33"],"قتل مغير الدين"];
 if(/(زنا|زنيت|الزانية|الزاني).{0,180}(رجم|يرجم|فارجمو|ارجمو|رجمها|رجمه)/.test(x)&&!/(يهودي|اليهود|التوراة|أهل الكتاب)/.test(x))return ["R03",["24:2"],"الرجم في زنا المسلم"];
 if(/لا وصية لوارث/.test(x))return ["R04",["2:180"],"نفي الوصية للوارث"];
 if(/لا يقتل مسلم بكافر|المسلم لا يقتل بالكافر/.test(x))return ["R05",["2:178","5:45"],"استثناء النفس من القصاص على أساس الدين"];
 if(/(أكل كل ذي ناب من السباع حرام|حرم كل ذي ناب من السباع|حرم.*لحوم الحمر الأهلية|حرم.*الحمر الإنسية|نهى.*لحوم الحمر الأهلية)/.test(x))return ["R06",["6:145","10:59","16:116"],"إضافة تحريم غذائي عام"];
 return null;
}
const extra={
 "موتى":["27:80","35:22","30:52"],"قبور":["27:80","35:22","30:52"],
 "نورث":["19:6","27:16","4:7"],"ميراث":["19:6","27:16","4:7","4:11","4:12"],"ورث":["19:6","27:16","4:7","4:11","4:12"],
 "غيب":["6:50","7:188","72:26","72:27"],"دين":["2:256","10:99","109:6"],"إكراه":["2:256","10:99","88:21"],
 "خمر":["5:90","2:219"],"ربا":["2:275","2:278"],"ساحر":["10:77","20:69","28:48"],
 "قتل":["5:32","17:33","4:93"],"عدل":["4:58","4:135","5:8","16:90"],"شهادة":["4:135","2:282","5:8"],
 "طلاق":["2:229","2:231","65:1"],"عدة":["2:228","65:4"],"رضاع":["2:233"],"نكاح":["4:3","4:19","24:32"]
};
async function loadQuran(){
 const v=[];
 for(let i=1;i<=114;i++){const r=await fetch(QB+i+".json");if(!r.ok)throw new Error("Quran "+i);const j=await r.json();for(const [k,t] of Object.entries(j.verse))v.push({ref:i+":"+k.replace("verse_",""),text:String(t).replace(/^\uFEFF/,"")});}
 return v;
}
async function loadCorpus(){
 const u=new Map(), rawCounts={};let raw=0;
 for(const [book,file] of HADITH){const r=await fetch(HB+encodeURIComponent(file));if(!r.ok)throw new Error(book+" "+r.status);const txt=await r.text();const rows=txt.split(/\r?\n/).filter(Boolean).slice(1);rawCounts[book]=rows.length;raw+=rows.length;rows.forEach((t,i)=>{t=t.trim();if(t&&!u.has(t))u.set(t,{text:t,book,row:i+1});});}
 if(raw!==62169||u.size!==62046)throw new Error("Corpus mismatch raw="+raw+" unique="+u.size);
 return {entries:[...u.values()],rawCounts,raw};
}
function buildIndex(q){
 const df=new Map(),inv=new Map();const wt=[];
 for(let i=0;i<q.length;i++){const ws=toks(q[i].text);wt[i]=ws;for(const w of new Set(ws))df.set(w,(df.get(w)||0)+1);}
 for(let i=0;i<q.length;i++)for(const w of wt[i]){let a=inv.get(w);if(!a){a=[];inv.set(w,a);}a.push(i);}
 return {df,inv};
}
function candidates(t,q,ix,byRef){
 const c=new Map(), ws=toks(matn(t)), N=q.length;
 for(const w of ws){const idf=Math.log((N+1)/((ix.df.get(w)||0)+1));for(const i of ix.inv.get(w)||[])c.set(i,(c.get(i)||0)+idf);}
 const n=norm(matn(t));
 for(const [k,refs] of Object.entries(extra))if(n.includes(norm(k)))for(const ref of refs){const i=byRef.get(ref);if(i!=null)c.set(i,(c.get(i)||0)+3);}
 return [...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([i,s])=>({i,score:s}));
}
function prob(data,i){const l=[data[i*3],data[i*3+1],data[i*3+2]],mx=Math.max(...l),z=l.map(x=>Math.exp(x-mx)),s=z[0]+z[1]+z[2];return {e:z[0]/s,n:z[1]/s,c:z[2]/s};}
async function infer(tok,model,pairs){
 const out=[];for(let s=0;s<pairs.length;s+=32){const part=pairs.slice(s,s+32);const e=await tok(part.map(x=>x.a),{text_pair:part.map(x=>x.b),padding:true,truncation:true,max_length:192});const o=await model(e);const d=o.logits?.ort_tensor?.cpuData;for(let i=0;i<part.length;i++)out.push(prob(d,i));}
 return out;
}
async function main(){
 const {entries,rawCounts,raw}=await loadCorpus();const q=await loadQuran();const ix=buildIndex(q);const byRef=new Map(q.map((x,i)=>[x.ref,i]));
 const st=await AutoTokenizer.from_pretrained(SMALL), sm=await AutoModelForSequenceClassification.from_pretrained(SMALL,{quantized:true});
 const lt=await AutoTokenizer.from_pretrained(LARGE), lm=await AutoModelForSequenceClassification.from_pretrained(LARGE,{quantized:true});
 const results=[];
 for(let s=0;s<entries.length;s+=128){
  const chunk=entries.slice(s,s+128), dec=chunk.map(x=>{const h=hardRule(x.text);return {x,h,c:h?[]:candidates(x.text,q,ix,byRef)}});
  const pairs=[];const map=new Map();
  for(let i=0;i<dec.length;i++)if(!dec[i].h)for(const cc of dec[i].c){const pi=pairs.length;pairs.push({a:matn(dec[i].x.text),b:q[cc.i].text,di:i,qi:cc.i});}
  const sp=await infer(st,sm,pairs);for(let i=0;i<pairs.length;i++){const p=pairs[i],pr=sp[i];const old=map.get(p.di);if(!old||pr.c>old.pr.c)map.set(p.di,{p,pr});}
  const verify=[];for(const v of map.values())if(v.pr.c>=0.62&&v.pr.c>v.pr.e+0.08&&v.pr.c>v.pr.n+0.08)verify.push(v);
  const lp=await infer(lt,lm,verify.map(v=>({a:matn(dec[v.p.di].x.text),b:q[v.p.qi].text})));
  const lmap=new Map();verify.forEach((v,i)=>lmap.set(v.p.di,lp[i]));
  for(let i=0;i<dec.length;i++){
   const d=dec[i];let verdict="M",ref="",pc=0,rule="";
   if(d.h){verdict="C";ref=d.h[1].join("|");rule=d.h[2];pc=1;}
   else {const v=map.get(i), lv=lmap.get(i);if(lv&&lv.c>=0.65&&lv.c>lv.e+0.08&&lv.c>lv.n+0.08){verdict="C";ref=q[v.p.qi].ref;pc=lv.c;rule="NLI-verified";}else if(v&&v.pr.c>=0.90&&v.pr.c>v.pr.e+0.20&&v.pr.c>v.pr.n+0.20){verdict="C";ref=q[v.p.qi].ref;pc=v.pr.c;rule="NLI-high-confidence";}}
   results.push({hash:crypto.createHash("sha1").update(d.x.text).digest("hex"),book:d.x.book,row:d.x.row,text:d.x.text,verdict,quran_ref:ref,contradiction_probability:+pc.toFixed(6),rule});
  }
  console.log("processed",Math.min(s+chunk.length,entries.length),"/",entries.length);
 }
 const contradictions=results.filter(x=>x.verdict==="C"),matches=results.length-contradictions.length;
 const rule_counts={};for(const r of contradictions)rule_counts[r.rule]=(rule_counts[r.rule]||0)+1;
 const summary={corpus_raw:raw,duplicates_removed:raw-results.length,corpus_unique:results.length,contradictory:contradictions.length,matching:matches,total:results.length,rule_counts,source_files:rawCounts,method:"Binary Quran-only audit. C requires explicit Quran conflict or high-confidence two-stage multilingual NLI against Quran verse candidates; all other unique texts are M. No third category."};
 await fs.mkdir("audit_out",{recursive:true});await fs.writeFile("audit_out/summary.json",JSON.stringify(summary,null,2));await fs.writeFile("audit_out/results.jsonl",results.map(x=>JSON.stringify(x)).join("\\n"));await fs.writeFile("audit_out/contradictions.csv",["hash,book,row,verdict,quran_ref,contradiction_probability,rule,text"].concat(contradictions.map(x=>[x.hash,x.book,x.row,x.verdict,x.quran_ref,x.contradiction_probability,x.rule,x.text].map(v=>"\""+String(v).replace(/\"/g,"\"\"")+"\"").join(","))).join("\\n"));console.log(JSON.stringify(summary));
}
main().catch(e=>{console.error(e);process.exit(1);});
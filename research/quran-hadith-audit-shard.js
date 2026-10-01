import fs from "node:fs/promises";
import crypto from "node:crypto";
import { AutoTokenizer, AutoModelForSequenceClassification } from "@huggingface/transformers";

const HADITH = [
["Muwatta","Maliks Muwatta Without_Tashkel.csv"],["Ahmad","Musnad Ahmad ibn Hanbal Without_Tashkel.csv"],
["Bukhari","Sahih Bukhari Without_Tashkel.csv"],["Muslim","Sahih Muslime Without_Tashkel.csv"],
["Abu Dawud","Sunan Abu Dawud Without_Tashkel.csv"],["Ibn Maja","Sunan Ibn Maja Without_Tashkel.csv"],
["Darimi","Sunan al Darami Without_Tashkel.csv"],["Tirmidhi","Sunan al Tirmidhi Without_Tashkel.csv"],
["Nasai","Sunan al-Nasai Without_Tashkel.csv"]];
const HB="https://raw.githubusercontent.com/abdelrahmaan/Hadith-Data-Sets/master/All%20Hadith%20Books/";
const QB="https://raw.githubusercontent.com/semarketir/quranjson/master/source/surah/surah_";
const SMALL="MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli", LARGE="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli";
const STOP=new Set("من في عن على إلى اليه به بها له لها ما وما لا لم لن إن ان أن كان كانت يكون هو هي هم هن و او أو ثم قد لقد يا أي أيها الذين الذي التي هذا هذه ذلك تلك فإن فان إنما إنه أنها كما مع عند بين كل بعض أحد غير بعد قبل حيث حتى منكم لنا لكم لهم لهن نحن أنا أنت أنتم".split(" "));
function norm(s){return s.normalize("NFKD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ة/g,"ه").replace(/ـ/g,"").replace(/[^\u0600-\u06FF\s]/g," ").replace(/\s+/g," ").trim();}
function toks(s){const out=new Set();for(const x of norm(s).split(/\s+/)){if(x.length<3||STOP.has(x))continue;let w=x.replace(/^(وال|بال|لل|ال|ف|و|ب|ك|ل)/,"");if(w.length>=3&&!STOP.has(w))out.add(w);const st=w.replace(/(هما|هم|هن|ها|ه|كم|كن|نا|ني|ك|ي|ون|ين|ات|ان|ة)$/,"");if(st.length>=3&&!STOP.has(st))out.add(st);}return [...out];}
function matn(s){const marks=["قال رسول الله","قال النبي","أن رسول الله","أن النبي","يقول رسول الله","يقول النبي"];let p=-1;for(const m of marks)p=Math.max(p,s.lastIndexOf(m));return p>=0?s.slice(p,p+1800):s.slice(-1800);}
function hardRule(t){const x=norm(t);
 if(/أمرت أن أقاتل الناس حتى يشهدوا|قاتل الناس حتى يشهدوا/.test(x))return ["R01",["2:256","10:99"],"القتال حتى الإيمان"];
 if(/من بدل دينه.{0,100}(فاقتلوه|اقتلوه|فقتلوه)|رجع عن دينه.{0,100}(فاقتلوه|اقتلوه)/.test(x))return ["R02",["2:256","17:33"],"قتل مغير الدين"];
 if(/(زنا|زنيت|الزانية|الزاني).{0,180}(رجم|يرجم|فارجمو|ارجمو|رجمها|رجمه)/.test(x)&&!/(يهودي|اليهود|التوراة|أهل الكتاب)/.test(x))return ["R03",["24:2"],"الرجم في زنا المسلم"];
 if(/لا وصية لوارث/.test(x))return ["R04",["2:180"],"نفي الوصية للوارث"];
 if(/لا يقتل مسلم بكافر|المسلم لا يقتل بالكافر/.test(x))return ["R05",["2:178","5:45"],"استثناء النفس من القصاص على أساس الدين"];
 if(/(أكل كل ذي ناب من السباع حرام|حرم كل ذي ناب من السباع|حرم.*لحوم الحمر الأهلية|حرم.*الحمر الإنسية|نهى.*لحوم الحمر الأهلية)/.test(x))return ["R06",["6:145","10:59","16:116"],"إضافة تحريم غذائي عام"];
 return null;
}
const extra={"موتى":["27:80","35:22","30:52"],"قبور":["27:80","35:22","30:52"],"نورث":["19:6","27:16","4:7"],"ميراث":["19:6","27:16","4:7","4:11","4:12"],"ورث":["19:6","27:16","4:7","4:11","4:12"],"غيب":["6:50","7:188","72:26","72:27"],"دين":["2:256","10:99","109:6"],"إكراه":["2:256","10:99","88:21"],"خمر":["5:90","2:219"],"ربا":["2:275","2:278"],"ساحر":["10:77","20:69","28:48"],"قتل":["5:32","17:33","4:93"],"عدل":["4:58","4:135","5:8","16:90"],"شهادة":["4:135","2:282","5:8"],"طلاق":["2:229","2:231","65:1"],"عدة":["2:228","65:4"],"رضاع":["2:233"],"نكاح":["4:3","4:19","24:32"]};
async function ft(u){const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);return await r.text();}
async function corpus(){const u=new Map();let raw=0;const counts={};for(const [book,file] of HADITH){const rows=(await ft(HB+encodeURIComponent(file))).split(/\r?\n/).filter(Boolean).slice(1);counts[book]=rows.length;raw+=rows.length;rows.forEach((x,i)=>{x=x.trim();if(x&&!u.has(x))u.set(x,{text:x,book,row:i+1})});}if(raw!==62169||u.size!==62046)throw new Error("corpus "+raw+" "+u.size);return {entries:[...u.values()],raw,counts};}
async function quran(){const q=[];for(let i=1;i<=114;i++){const j=JSON.parse(await ft(QB+i+".json"));for(const[k,v]of Object.entries(j.verse))q.push({ref:i+":"+k.replace("verse_",""),text:String(v).replace(/^\uFEFF/,"")})}return q;}
function idx(q){const df=new Map(),inv=new Map(),ws=[];for(let i=0;i<q.length;i++){ws[i]=toks(q[i].text);for(const w of new Set(ws[i]))df.set(w,(df.get(w)||0)+1)}for(let i=0;i<q.length;i++)for(const w of ws[i]){let a=inv.get(w);if(!a){a=[];inv.set(w,a)}a.push(i)}return {df,inv};}
function cands(text,q,ix,byRef){const c=new Map(),ws=toks(matn(text)),N=q.length;for(const w of ws){const idf=Math.log((N+1)/((ix.df.get(w)||0)+1));for(const i of ix.inv.get(w)||[])c.set(i,(c.get(i)||0)+idf)}const n=norm(matn(text));for(const[k,refs]of Object.entries(extra))if(n.includes(norm(k)))for(const r of refs){const i=byRef.get(r);if(i!=null)c.set(i,(c.get(i)||0)+3)}return [...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([i,score])=>({i,score}));}
function probs(d,i){const l=[d[i*3],d[i*3+1],d[i*3+2]],mx=Math.max(...l),z=l.map(x=>Math.exp(x-mx)),s=z[0]+z[1]+z[2];return {e:z[0]/s,n:z[1]/s,c:z[2]/s};}
async function infer(tok,model,pairs){const out=[];for(let s=0;s<pairs.length;s+=32){const p=pairs.slice(s,s+32),e=await tok(p.map(x=>x.a),{text_pair:p.map(x=>x.b),padding:true,truncation:true,max_length:192}),o=await model(e),d=o.logits?.ort_tensor?.cpuData;for(let i=0;i<p.length;i++)out.push(probs(d,i));}return out;}
async function main(){
 const shard=Number(process.env.SHARD_INDEX||0), shards=Number(process.env.SHARD_COUNT||8);
 const {entries,raw,counts}=await corpus(); const q=await quran(), ix=idx(q), byRef=new Map(q.map((v,i)=>[v.ref,i]));
 const a=Math.floor(entries.length*shard/shards), b=Math.floor(entries.length*(shard+1)/shards), selected=entries.slice(a,b);
 const st=await AutoTokenizer.from_pretrained(SMALL), sm=await AutoModelForSequenceClassification.from_pretrained(SMALL,{quantized:true});
 const lt=await AutoTokenizer.from_pretrained(LARGE), lm=await AutoModelForSequenceClassification.from_pretrained(LARGE,{quantized:true});
 const results=[];
 for(let s=0;s<selected.length;s+=128){
  const chunk=selected.slice(s,s+128), D=chunk.map(x=>({x,h:hardRule(x.text),c:hardRule(x.text)?[]:cands(x.text,q,ix,byRef)}));
  const pairs=[];for(let i=0;i<D.length;i++)if(!D[i].h)for(const cc of D[i].c)pairs.push({di:i,qi:cc.i});
  const sp=await infer(st,sm,pairs.map(p=>({a:matn(D[p.di].x.text),b:q[p.qi].text}))), best=new Map();
  for(let i=0;i<pairs.length;i++){const p=pairs[i],pr=sp[i],old=best.get(p.di);if(!old||pr.c>old.pr.c)best.set(p.di,{p,pr});}
  const verify=[...best.values()].filter(v=>v.pr.c>=0.62&&v.pr.c>v.pr.e+0.08&&v.pr.c>v.pr.n+0.08);
  const lp=await infer(lt,lm,verify.map(v=>({a:matn(D[v.p.di].x.text),b:q[v.p.qi].text}))), lmap=new Map();
  verify.forEach((v,i)=>lmap.set(v.p.di,lp[i]));
  for(let i=0;i<D.length;i++){const d=D[i],h=d.h;let verdict="M",ref="",pc=0,rule="";if(h){verdict="C";ref=h[1].join("|");pc=1;rule=h[2]}else{const v=best.get(i),lv=lmap.get(i);if(lv&&lv.c>=0.65&&lv.c>lv.e+0.08&&lv.c>lv.n+0.08){verdict="C";ref=q[v.p.qi].ref;pc=lv.c;rule="NLI-verified"}else if(v&&v.pr.c>=0.90&&v.pr.c>v.pr.e+0.20&&v.pr.c>v.pr.n+0.20){verdict="C";ref=q[v.p.qi].ref;pc=v.pr.c;rule="NLI-high-confidence"}}
  results.push({hash:crypto.createHash("sha1").update(d.x.text).digest("hex"),book:d.x.book,row:d.x.row,text:d.x.text,verdict,quran_ref:ref,contradiction_probability:+pc.toFixed(6),rule});}
 }
 await fs.mkdir("audit_out/parts",{recursive:true});const c=results.filter(x=>x.verdict==="C").length;
 const sum={shard,shards,start:a,end:b,processed:results.length,contradictory:c,matching:results.length-c,raw_corpus:raw,unique_corpus:62046,source_files:counts};
 await fs.writeFile("audit_out/parts/part-"+shard+".jsonl",results.map(x=>JSON.stringify(x)).join("\\n"));
 await fs.writeFile("audit_out/parts/part-"+shard+".summary.json",JSON.stringify(sum,null,2));console.log(JSON.stringify(sum));
}
main().catch(e=>{console.error(e);process.exit(1)});
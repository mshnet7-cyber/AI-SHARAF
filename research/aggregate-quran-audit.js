import fs from "node:fs/promises";
const dir="audit_parts";
const files=(await fs.readdir(dir)).filter(x=>x.endsWith(".jsonl")).sort();
const rows=[];
for(const f of files){const t=await fs.readFile(dir+"/"+f,"utf8");for(const line of t.split(/\r?\n/).filter(Boolean))rows.push(JSON.parse(line));}
const uniq=new Map();for(const r of rows)if(!uniq.has(r.hash))uniq.set(r.hash,r);
const all=[...uniq.values()];
const contradictory=all.filter(x=>x.verdict==="C"), matching=all.length-contradictory.length;
const rule_counts={};for(const r of contradictory)rule_counts[r.rule]=(rule_counts[r.rule]||0)+1;
const summary={corpus_raw:62169,duplicates_removed:123,corpus_unique:all.length,contradictory:contradictory.length,matching,total:all.length,rule_counts,parts:files.length,method:"Binary Quran-only audit. C requires an explicit Quran conflict or high-confidence two-stage multilingual NLI against Quran verse candidates; all other unique texts are M. No third category."};
await fs.mkdir("audit_final",{recursive:true});
await fs.writeFile("audit_final/summary.json",JSON.stringify(summary,null,2));
await fs.writeFile("audit_final/results.jsonl",all.map(x=>JSON.stringify(x)).join("\n"));
await fs.writeFile("audit_final/contradictions.csv",["hash,book,row,verdict,quran_ref,contradiction_probability,rule,text"].concat(contradictory.map(x=>[x.hash,x.book,x.row,x.verdict,x.quran_ref,x.contradiction_probability,x.rule,x.text].map(v=>"\""+String(v).replace(/"/g,"\"\"")+"\"").join(","))).join("\n"));
console.log(JSON.stringify(summary));
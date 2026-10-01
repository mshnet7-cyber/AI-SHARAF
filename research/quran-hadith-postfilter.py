import json,re,hashlib,urllib.request
from pathlib import Path
from collections import Counter,defaultdict

RAW=62169
UNIQUE=62046
BASE="https://raw.githubusercontent.com/semarketir/quranjson/master/source/surah/surah_{}.json"

STOP=set("""من في عن على إلى اليه به بها له لها ما وما لا لم لن إن ان أن كان كانت يكون هو هي هم هن و او أو ثم قد لقد يا أي أيها الذين الذي التي هذا هذه ذلك تلك فإن فان إنما إنه أنها كما مع عند بين كل بعض أحد احد غير بعد قبل حيث حتى منكم لنا لكم لهم لهن نحن أنا أنت أنتم الله رسول نبي محمد الناس الحق كتاب المؤمن المؤمنين""".split())

def norm(s):
    s=s.replace("\\ufeff","")
    s=re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED]","",s)
    s=re.sub(r"[إأآٱ]","ا",s).replace("ى","ي").replace("ؤ","و").replace("ئ","ي").replace("ة","ه").replace("ـ","")
    s=re.sub(r"[^\u0600-\u06FF\s]"," ",s)
    return re.sub(r"\s+"," ",s).strip()

def stems(s):
    out=set()
    for w in norm(s).split():
        if len(w)<3 or w in STOP: continue
        w=re.sub(r"^(وال|بال|لل|ال|ف|و|ب|ك|ل)","",w)
        w=re.sub(r"(هما|هم|هن|ها|ه|كم|كن|نا|ني|ك|ي|ون|ين|ات|ان|ة)$","",w)
        if len(w)>=3 and w not in STOP: out.add(w)
    return out

def matn(s):
    marks=["قال رسول الله","قال النبي","أن رسول الله","أن النبي","يقول رسول الله","يقول النبي"]
    p=-1
    for m in marks: p=max(p,s.rfind(m))
    return s[p:p+1800] if p>=0 else s[-1800:]

def load_quran():
    q={}
    for i in range(1,115):
        with urllib.request.urlopen(BASE.format(i),timeout=30) as r: data=json.load(r)
        for k,v in data["verse"].items():
            if k=="verse_0": continue
            ref=f"{i}:{k[6:]}"
            q[ref]=str(v)
    return q

def parse_results():
    rows=[]
    for p in sorted(Path("audit_parts").glob("part-*.jsonl")):
        txt=p.read_text(encoding="utf8")
        for line in txt.split("\\n"):
            if line.strip(): rows.append(json.loads(line))
    by={}
    for r in rows: by[r["hash"]]=r
    assert len(by)==UNIQUE, len(by)
    return list(by.values())

def hard_rule(t):
    x=t
    if re.search(r"أمرت أن أقاتل الناس حتى يشهدوا|قاتل الناس حتى يشهدوا",x):
        return ("R01","2:256|10:99","القتال حتى الإيمان")
    if re.search(r"(من بدل دينه|بدل دينه).{0,100}(فاقتلوه|اقتلوه|فقتلوه)|رجع عن دينه.{0,100}(فاقتلوه|اقتلوه)",x):
        return ("R02","2:256|17:33","قتل مغير الدين")
    if re.search(r"(زنا|زنيت|الزانية|الزاني).{0,180}(رجم|يرجم|فارجمو|ارجمو|رجمها|رجمه)",x) and not re.search(r"يهودي|اليهود|التوراة|أهل الكتاب",x):
        return ("R03","24:2","الرجم في زنا المسلم")
    if re.search(r"لا وصية لوارث",x):
        return ("R04","2:180","نفي الوصية للوارث")
    if re.search(r"لا يقتل مسلم بكافر|المسلم لا يقتل بالكافر",x):
        return ("R05","2:178|5:45","استثناء النفس من القصاص على أساس الدين")
    if re.search(r"(أكل كل ذي ناب من السباع حرام|حرم كل ذي ناب من السباع|حرم.{0,80}لحوم الحمر الأهلية|حرم.{0,80}الحمر الإنسية|نهى.{0,80}لحوم الحمر الأهلية)",x):
        return ("R06","6:145|10:59|16:116","إضافة تحريم غذائي عام")
    # direct Quran-only families discovered after the first pass
    if re.search(r"لا نورث ما تركنا صدقة|لا نورث|النبي لا يورث|الأنبياء لا يورثون",x):
        return ("R07","19:6|27:16","نفي إرث الأنبياء")
    if re.search(r"الميت ليسمع خفق نعالهم|إنهم الآن يسمعون ما أقول|ما أنتم بأسمع لما قلت منهم",x):
        return ("R08","27:80|35:22|30:52","إسماع الموتى")
    # reject only explicit claims of autonomous all-encompassing unseen knowledge;
    # explicit denials in hadith are not contradictions.
    if re.search(r"النبي يعلم الغيب|رسول الله يعلم الغيب|يعلم ما في غد",x) and not re.search(r"لا يعلم|ما يعلم ما في غد",x):
        return ("R09","6:50|7:188|72:26|72:27","إسناد علم الغيب المطلق للنبي")
    return None

def thematic_related(ht,qt):
    h=stems(ht); q=stems(qt)
    shared=h&q
    if len(shared)>=2: return True,shared
    rare={w for w in shared if len(w)>=4}
    return bool(rare),shared

def main():
    q=load_quran()
    results=parse_results()
    # Re-evaluate all NLI-derived C results with a conservative relevance guard.
    refined=[]
    for r in results:
        hr=hard_rule(r["text"])
        if hr:
            verdict="C"; ref=hr[1]; rule=hr[2]; keep_reason="explicit Quran-rule match"
        elif r["verdict"]!="C":
            verdict="M"; ref=""; rule=""; keep_reason=""
        else:
            refs=[x for x in r.get("quran_ref","").split("|") if x in q]
            related=False; shared=set()
            for ref0 in refs[:2]:
                ok,sh=thematic_related(matn(r["text"]),q[ref0])
                if ok: related=True; shared|=sh
            # Stronger threshold for ML-only decisions.
            p=float(r.get("contradiction_probability") or 0)
            verdict="C" if related and p>=0.86 else "M"
            ref=r.get("quran_ref","") if verdict=="C" else ""
            rule=("NLI+topic-guard" if verdict=="C" else "")
            keep_reason=("relevant shared content: "+",".join(sorted(shared))) if verdict=="C" else "NLI candidate rejected by topic relevance guard"
        refined.append({**r,"verdict":verdict,"quran_ref":ref,"rule":rule})

    c=sum(x["verdict"]=="C" for x in refined)
    m=UNIQUE-c
    summary={
        "raw_corpus":RAW,
        "duplicates_removed":RAW-UNIQUE,
        "unique_corpus":UNIQUE,
        "contradictory":c,
        "matching":m,
        "total":UNIQUE,
        "percentage_contradictory":round(c*100/UNIQUE,6),
        "percentage_matching":round(m*100/UNIQUE,6),
        "rule_counts":dict(Counter(x["rule"] for x in refined if x["verdict"]=="C")),
        "validation":{
            "unique_hashes":len({x["hash"] for x in refined}),
            "partition_ok":len(refined)==UNIQUE and c+m==UNIQUE,
            "binary_only":True
        },
        "method":"Quran-only binary audit. Deterministic explicit contradiction rules are retained; model-only contradictions are retained only when Quran-verse relevance is supported by shared non-generic content terms and a high contradiction score. No third category."
    }
    out=Path("audit_refined");out.mkdir(exist_ok=True)
    (out/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf8")
    (out/"results.jsonl").write_text("\\n".join(json.dumps(x,ensure_ascii=False) for x in refined),encoding="utf8")
    cs=[x for x in refined if x["verdict"]=="C"]
    (out/"contradictions.csv").write_text(
        "hash,book,row,verdict,quran_ref,contradiction_probability,rule,text\\n"+
        "\\n".join(",".join('"'+str(v).replace('"','""')+'"' for v in [x["hash"],x["book"],x["row"],x["verdict"],x["quran_ref"],x["contradiction_probability"],x["rule"],x["text"]]) for x in cs),
        encoding="utf8")
    print(json.dumps(summary,ensure_ascii=False))
main()

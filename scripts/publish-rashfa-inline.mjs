#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
const target=path.resolve(process.argv[2]||".");
const root=path.join(target,"rashfa-wa-khubza-live");
const indexPath=path.join(root,"index.html");
const manifestPath=path.join(root,"data","rashfa-menu-reconciliation.json");
const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
async function dataUri(file){const ext=path.extname(file).toLowerCase();const mime=ext===".webp"?"image/webp":ext===".png"?"image/png":"image/jpeg";return "data:"+mime+";base64:"+(await fs.readFile(file)).toString("base64");}
const html=await fs.readFile(indexPath,"utf8");
const manifest=JSON.parse(await fs.readFile(manifestPath,"utf8"));
const menuDir=path.join(root,"assets","menu");
const menuFiles=(await fs.readdir(menuDir)).filter(f=>/\.(jpe?g|png|webp|avif)$/i.test(f)).sort().slice(0,18);
const pies=[
["فطيرة دجاج طازج","Fresh Chicken Pie","فطيرة دجاج طازج",0.800],["فطيرة بطاطس عمان تشيبس","Oman Chips with Cheese Pie","فطيرة بطاطس عمان تشيبس",0.500],["فطيرة شكشوكة وجبن","Shakshuka with Cheese Pie","فطيرة شكشوكة مع جبن",0.500],["فطيرة بيض مسلوق وجبن","Boiled Egg with Cheese Pie","فطيرة بيض مسلوق مع جبن",0.400],["فطيرة بيض سادة","Plain Egg Pie","فطيرة بيض سادة",0.400],["فطيرة كبدة وجبن","Liver with Cheese Pie","فطيرة كبدة مع جبن",0.800],["فطيرة كبدة","Liver Pie","فطيرة كبدة",0.700],["فطيرة تونة","Tuna Pie","فطيرة تونة",0.600],["فطيرة عسل وجبن","Honey & Cheese Pie","فطيرة عسل وجبن",0.500],["فطيرة حلوم","Halloumi Pie","فطيرة حلوم",0.800],["فطيرة لحم رشفة","Meat Rashfa Pie","فطيرة لحم رشفة",1.000],["فطيرة جبن كريمة","Cream Cheese Pie","فطيرة جبن كريمة",0.400],["فطيرة فلافل","Falafel Pie","فطيرة فلافل",0.700],["فطيرة نوتيلا وفول سوداني","Nutella & Peanut Butter Pie","فطيرة نوتيلا وفول سوداني",0.600],["فطيرة زيتون وجبن","Olive Cheese Pie","فطيرة زيتون وجبن",0.400]];
const drinks=[["شاي بيري","Berry Tea",0.400],["شاي رمان","Pomegranate Tea",0.400],["شاي كرك","Karak Tea",0.300],["شاي أحمر","Red Tea",0.200],["عصير الربيع","Al Rabie Juice",0.100],["ماء","Water",0.100],["كينزا حمضيات","Kinza Citrus",0.300],["ديو","Dew",0.300],["بيبسي","Pepsi",0.300],["عصير برتقال طازج","Fresh Orange Juice",0.900]];
const diet=[["كينزا كولا دايت","Kinza Cola Diet",0.300],["كينزا حمضيات","Kinza Citrus",0.300],["بيبسي دايت","Pepsi Diet",0.300]];
const boxes=[["بوكس شاي كرك","Karak Tea Box",1.500],["بوكس شاي رمان","Pomegranate Tea Box",2.000]];
const uris=[];for(const file of menuFiles)uris.push(await dataUri(path.join(menuDir,file)));
let out=html;
const heroUri=uris[0]||"";
const hero='<div class="rf-heroVisual" data-hero>'+(heroUri?'<img src="'+heroUri+'" alt="رشفة وخبزة — صورة من المنيو الرسمية" fetchpriority="high">':"")+'<div class="rf-badge"><div><strong>رشفة وخبزة</strong><br><span>صور محلية من مواد المصدر</span></div><a class="rf-btn rf-primary" href="#photos">شاهد الصور</a></div></div>';
out=out.replace(/<div class="rf-heroVisual" data-hero>[\s\S]*?<\/div>\s*<\/section>/,hero+"</section>");
const galleryCards=menuFiles.slice(0,6).map((file,i)=>'<figure class="rf-photo"><img src="'+uris[i]+'" alt="رشفة وخبزة — صورة من المصدر" loading="lazy"><figcaption>صورة أصلية من مواد القائمة</figcaption></figure>').join("");
out=out.replace('<div class="rf-gallery" id="aboutGallery"></div>',galleryCards).replace('<div class="rf-gallery" id="gallery"></div>',galleryCards);
const pieCards=pies.map((item,i)=>'<article class="rf-menuCard">'+(uris[i]?'<img src="'+uris[i]+'" alt="'+esc(item[0])+'" loading="lazy">':"")+'<div class="rf-menuBody"><div class="rf-menuName">'+esc(item[0])+'</div><div class="rf-menuEn">'+esc(item[1])+'</div><div class="rf-menuDesc">'+esc(item[2])+'</div><div class="rf-price">'+item[3].toFixed(3)+' <small>ر.ع.</small></div></div></article>').join("");
const compact=arr=>arr.map(x=>'<article class="rf-compact"><strong>'+esc(x[0])+'</strong><span>'+esc(x[1])+'</span><strong>'+x[2].toFixed(3)+' ر.ع.</strong></article>').join("");
const menuHtml='<div class="rf-tabs"><span class="rf-tab active">الفطائر</span><span class="rf-tab">المشروبات</span><span class="rf-tab">المشروبات الدايت</span><span class="rf-tab">البوكسات</span></div><div class="rf-menuGrid">'+pieCards+'</div><div class="rf-group"><h3 class="rf-groupTitle">المشروبات</h3><div class="rf-compactGrid">'+compact(drinks)+'</div></div><div class="rf-group"><h3 class="rf-groupTitle">المشروبات الدايت</h3><div class="rf-compactGrid">'+compact(diet)+'</div></div><div class="rf-group"><h3 class="rf-groupTitle">البوكسات</h3><div class="rf-compactGrid">'+compact(boxes)+'</div></div><div class="rf-source">المصدر البصري للمنيو: المواد التي تم توفيرها للمشروع، مع رابط التشغيل المباشر إلى <a href="https://www.talabat.com/oman/restaurants/2601/sohar-sanaiyah?page=22" target="_blank" rel="noopener noreferrer">طلبات ↗</a>. الأسعار المعروضة هنا هي الأسعار الظاهرة في صورة المنيو التي تم توفيرها.</div>';
out=out.replace('<div class="rf-menuShell" id="menuContent"></div>','<div class="rf-menuShell" id="menuContent">'+menuHtml+'</div>');

const logoMarkup = '<span class="rf-logo" aria-hidden="true"><svg viewBox="0 0 64 64" role="img"><circle cx="32" cy="32" r="30" fill="#fffaf1" stroke="#a62f2a" stroke-width="2.5"/><path d="M15 29c2-13 11-19 17-19s15 6 17 19" fill="none" stroke="#a62f2a" stroke-width="2.8" stroke-linecap="round"/><circle cx="32" cy="21" r="7.5" fill="#fff" stroke="#d98b32" stroke-width="2"/><circle cx="29" cy="19" r="1.2" fill="#a62f2a"/><circle cx="34" cy="18" r="1.2" fill="#a62f2a"/><circle cx="36" cy="22" r="1.2" fill="#a62f2a"/><path d="M23 43h18M26 39c0-5 12-5 12 0v4H26z" fill="none" stroke="#a62f2a" stroke-width="2.5" stroke-linejoin="round"/></svg></span>';
out = out.replace(/<span class="rf-mark">ر<\/span>/g, logoMarkup);
out = out.replace('</style>', '.rf-logo{display:inline-flex;width:52px;height:52px;flex:none}.rf-logo svg{width:100%;height:100%;display:block}' + '</style>');

await fs.writeFile(indexPath,out,"utf8");
console.log(JSON.stringify({local_menu_images:menuFiles.length,pies:pies.length,drinks:drinks.length,diet:diet.length,boxes:boxes.length},null,2));
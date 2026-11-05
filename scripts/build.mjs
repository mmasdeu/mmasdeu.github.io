// Scans mmasdeu's repos with Pages enabled, updates projects.json (keeping existing titles/descs), screenshots each page.
import {chromium} from 'playwright';
import fs from 'fs';
const owner='mmasdeu', H={headers:{'User-Agent':'pages-landing',...(process.env.GITHUB_TOKEN&&{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`})}};
const repos=await (await fetch(`https://api.github.com/users/${owner}/repos?per_page=100`,H)).json();
if(!Array.isArray(repos)) throw new Error('GitHub API error: '+JSON.stringify(repos)); // don't wipe the list on API failure
const old=Object.fromEntries(JSON.parse(fs.readFileSync('projects.json')).map(p=>[p.slug,p]));
const out=[];
for(const r of repos){
  if(!r.has_pages||r.archived||r.name===`${owner}.github.io`) continue;
  const url=old[r.name]?.url||`https://${owner}.github.io/${r.name}/`;
  const res=await fetch(url,{method:'HEAD'}); if(!res.ok) continue;
  out.push({slug:r.name,title:old[r.name]?.title||r.name,desc:old[r.name]?.desc||r.description||'',url});
}
// keep manual entries (not repos with Pages), but drop them once their URL is gone (deleted repo -> 404/410)
for(const p of Object.values(old)) if(!out.find(o=>o.slug===p.slug)){
  try{const r=await fetch(p.url,{method:'HEAD'}); if(r.status===404||r.status===410){console.log('removed',p.slug);continue}}catch{}
  out.push(p);
}
fs.writeFileSync('projects.json',JSON.stringify(out,null,2));
const b=await chromium.launch(),pg=await b.newPage({viewport:{width:1280,height:800}});
fs.mkdirSync('shots',{recursive:true});
for(const f of fs.readdirSync('shots')) if(!out.find(p=>`${p.slug}.jpg`===f)){fs.unlinkSync(`shots/${f}`);console.log('deleted shot',f)}
for(const p of out){try{await pg.goto(p.url,{waitUntil:'networkidle',timeout:30000});await pg.waitForTimeout(1500);
 await pg.screenshot({path:`shots/${p.slug}.jpg`,type:'jpeg',quality:82});console.log('ok',p.slug)}catch(e){console.log('fail',p.slug,e.message)}}
await b.close();

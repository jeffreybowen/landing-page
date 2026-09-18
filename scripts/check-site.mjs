import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const config=JSON.parse(await readFile(new URL('site-config.json',root),'utf8'));
for(const name of ['index.html','sell-chelsea.html','privacy.html']){
  const html=await readFile(new URL(name,root),'utf8');
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${name}: one H1`);
  assert(!/REPLACE-ME\.com|thienduc666|lead_form_submit/.test(html),`${name}: no stale configuration`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]); assert.equal(new Set(ids).size,ids.length,`${name}: unique IDs`);
  const canonical=html.match(/rel="canonical" href="([^"]+)"/); assert(canonical?.[1].startsWith(config.siteUrl+'/'));
  for(const [,attrs,code] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(attrs.includes('application/ld+json')){const schema=JSON.parse(code);assert(schema['@graph'].some(n=>n['@type']==='Person')); assert(!code.includes('GeoCoordinates'));}
    else if(!attrs.includes('src=')) new vm.Script(code,{filename:name});
  }
  for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    if(/^(https?:|mailto:|tel:|data:)/.test(url))continue;
    const [file,anchor]=url.split('#');
    if(!file){if(anchor)assert(ids.includes(anchor),`${name}: missing #${anchor}`);continue;}
    await access(new URL(file==='./'?'index.html':file,root));
  }
}
for(const file of ['site.js','site-config.js','analytics.js'])new vm.Script(await readFile(new URL(file,root),'utf8'),{filename:file});
const robots=await readFile(new URL('robots.txt',root),'utf8');assert(!robots.includes('Disallow: /listings.json'));
const sitemap=await readFile(new URL('sitemap.xml',root),'utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,3);
console.log('PASS: metadata, structured data, local links, anchors, scripts, sitemap and crawl rules.');

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('site-config.json', root), 'utf8'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function httpsUrl(value, field) {
  if (!value) return '';
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error(`${field} must be a public HTTPS URL`);
  return u.href;
}
for (const key of ['siteUrl','googleBusinessProfileUrl','googleReviewUrl','bookingUrl','formspreeEndpoint']) config[key] = httpsUrl(config[key], key);
if (config.siteUrl) {
  const u = new URL(config.siteUrl);
  if (u.pathname !== '/' || u.search || u.hash) throw new Error('siteUrl must be the origin, without a path, query or fragment');
  config.siteUrl = u.origin;
}
if (config.bookingUrl && new URL(config.bookingUrl).hostname !== 'calendly.com') throw new Error('The booking widget currently supports calendly.com URLs only');
if (config.formspreeEndpoint && !/^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i.test(config.formspreeEndpoint)) throw new Error('Use a Formspree /f/ endpoint; other providers need a matching integration');
if (config.gaMeasurementId && !/^G-[A-Z0-9]+$/.test(config.gaMeasurementId)) throw new Error('Invalid GA4 measurement ID');
const pages = [
  ['index.html','', 'Jeffrey Bowen | Chelsea & East Boston Real Estate Broker', 'Buy or sell a condo, house or multifamily with Jeffrey Bowen at eRealty Advisors. Explore Chelsea and East Boston real estate and request a consultation.'],
  ['sell-chelsea.html','sell-chelsea.html','Sell Your Chelsea MA Home or Condo | Jeffrey Bowen','Planning to sell in Chelsea, MA? Explore preparation, pricing questions and the selling process with Jeffrey Bowen, Broker Associate at eRealty Advisors.'],
  ['privacy.html','privacy.html','Privacy & Contact Information | Jeffrey Bowen','How inquiries, website measurement and external services work on Jeffrey Bowen’s real estate website.']
];
for (const [file,path,title,description] of pages) {
  const url = config.siteUrl ? `${config.siteUrl}/${path}` : '';
  const nodes = [
    {'@type':'RealEstateAgent','@id':`${config.siteUrl}/#business`,name:'The Bowen Realty Group',telephone:'+1-781-201-9488',email:config.contactEmail,areaServed:['Chelsea, MA','East Boston, Boston, MA','Everett, MA','Malden, MA','Revere, MA'],parentOrganization:{'@type':'Organization',name:'eRealty Advisors, Inc.'},sameAs:['https://www.zillow.com/profile/JeffreyBowen',...(config.googleBusinessProfileUrl ? [config.googleBusinessProfileUrl] : [])]},
    {'@type':'Person','@id':`${config.siteUrl}/#jeffrey`,name:'Jeffrey Bowen',jobTitle:'Real Estate Broker Associate',worksFor:{'@id':`${config.siteUrl}/#business`}},
    {'@type':'WebSite','@id':`${config.siteUrl}/#website`,url:config.siteUrl+'/',name:'The Bowen Realty Group',publisher:{'@id':`${config.siteUrl}/#business`}},
    {'@type':'WebPage','@id':url+'#webpage',url,name:title,description,isPartOf:{'@id':`${config.siteUrl}/#website`},about:{'@id':`${config.siteUrl}/#jeffrey`},inLanguage:'en-US'}
  ];
  if (config.publicOfficeAddress) nodes[0].address = {'@type':'PostalAddress',streetAddress:config.publicOfficeAddress,addressCountry:'US'};
  nodes[0].url = config.siteUrl+'/'; nodes[0].image = config.siteUrl+'/heatshot.jpeg';
  if (path) nodes.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:config.siteUrl+'/'},{'@type':'ListItem',position:2,name:path.startsWith('sell')?'Sell in Chelsea':'Privacy',item:url}]});
  const tags = [
    `<title>${esc(title)}</title>`, `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="${config.siteUrl ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">`,
    '<meta name="theme-color" content="#0C0C0C">',
    '<meta property="og:type" content="website">', '<meta property="og:site_name" content="The Bowen Realty Group">',
    `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`,
    '<meta name="twitter:card" content="summary">', `<meta name="twitter:title" content="${esc(title)}">`, `<meta name="twitter:description" content="${esc(description)}">`
  ];
  if (url) tags.push(`<link rel="canonical" href="${esc(url)}">`,`<meta property="og:url" content="${esc(url)}">`,`<meta property="og:image" content="${config.siteUrl}/heatshot.jpeg">`,`<meta name="twitter:image" content="${config.siteUrl}/heatshot.jpeg">`);
  if (config.searchConsoleVerification) tags.push(`<meta name="google-site-verification" content="${esc(config.searchConsoleVerification)}">`);
  if (config.siteUrl) tags.push(`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':nodes}).replace(/</g,'\\u003c')}</script>`);
  let html = await readFile(new URL(file,root),'utf8');
  html = html.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, `<!-- SEO:START -->\n${tags.join('\n')}\n<!-- SEO:END -->`);
  html = html.replace(/<!-- OFFICE:START -->[\s\S]*?<!-- OFFICE:END -->/g,`<!-- OFFICE:START -->${config.publicOfficeAddress ? esc(config.publicOfficeAddress) : 'Appointments by arrangement; confirm the meeting location with Jeffrey.'}<!-- OFFICE:END -->`);
  await writeFile(new URL(file,root),html);
}
await writeFile(new URL('site-config.js',root),`// Generated by npm run build; no secrets belong in this file.\nwindow.SITE_CONFIG = ${JSON.stringify(config,null,2).replace(/</g,'\\u003c')};\n`);
await writeFile(new URL('robots.txt',root),config.siteUrl ? `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
await writeFile(new URL('sitemap.xml',root),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${config.siteUrl ? pages.map(([,path])=>`  <url><loc>${config.siteUrl}/${path}</loc></url>`).join('\n') : ''}\n</urlset>\n`);
console.log(`Built ${pages.length} pages for ${config.siteUrl || 'unconfigured preview (noindex)'}`);
if (!config.googleBusinessProfileUrl) console.log('Pending: Google Business Profile URL. Google links stay hidden.');
if (!config.bookingUrl) console.log('Pending: Jeffrey-owned Calendly URL. Booking stays hidden.');
if (!config.formspreeEndpoint) console.log('Contact form uses an explicitly labeled email-draft fallback.');

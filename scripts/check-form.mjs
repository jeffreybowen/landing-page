import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../site.js',import.meta.url),'utf8');
function setup(endpoint,reply,valid=true){
  let submit;const events=[];const values=new Map([['name','Test Visitor'],['email','test@example.com'],['phone',''],['interest','Selling a home'],['message','Test only']]);
  const form={elements:{namedItem:key=>({value:values.get(key)})},reportValidity:()=>valid,addEventListener:(_,fn)=>submit=fn,reset:()=>values.clear()};
  const nodes={lead:form,'lead-submit':{},fm:{},'delivery-note':{}};
  const window={SITE_CONFIG:{formspreeEndpoint:endpoint,contactEmail:'test@example.com'},gtag:(...args)=>events.push(args)};
  const context={window,document:{querySelectorAll:()=>[],getElementById:id=>nodes[id]},location:{search:'?utm_source=google',pathname:'/',href:''},URLSearchParams,FormData:class extends Map{constructor(){super(values)}},fetch:async()=>reply,AbortController,setTimeout,clearTimeout};
  window.location=context.location;
  vm.runInNewContext(source,context);return{run:()=>submit({preventDefault(){}}),events,nodes,values,context};
}
let test=setup('',null,false);await test.run();assert.equal(test.events.length,0);
test=setup('',null);await test.run();assert(test.nodes.fm.textContent.includes('has not been sent'));assert.equal(test.events[0][1],'email_draft_open');
test=setup('https://formspree.io/f/test',{ok:true,json:async()=>({ok:true})});await test.run();assert.equal(test.events[0][1],'generate_lead');assert.equal(test.values.size,0);
test=setup('https://formspree.io/f/test',{ok:false,json:async()=>({error:'test'})});await test.run();assert.equal(test.events.length,0);assert.equal(test.values.get('email'),'test@example.com');assert(test.nodes.fm.textContent.includes('could not confirm'));assert.equal(test.nodes['lead-submit'].disabled,false);
console.log('PASS: invalid submission, email-only fallback, mocked provider success/failure and lead event gating. No external inquiries sent.');

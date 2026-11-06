/** Public fixture UI tests; never publish fabricated jobs, teachers or contact data. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const modules=process.env.PROGRESS_UI_MODULES||'/tmp/listing-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(modules+'/jsdom/lib/api.js'))
const {build}=await import(pathToFileURL(modules+'/esbuild/lib/main.js'))
const {fireEvent,getByRole,queryByRole}=await import(pathToFileURL(modules+'/@testing-library/dom/dist/index.js'))
const dom=new JSDOM('<html><body><button id="opener">Outside opener</button><div id="root"></div></body></html>',{url:'https://vibeschool.co.ke/teacher'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
// The unit DOM has no top-layer API; real native modality is separately checked in the browser.
dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');this.querySelector('button')?.focus()}
dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
const React=await import('react'),{createRoot}=await import('react-dom/client'),{act}=React,require=createRequire(import.meta.url)
const job={id:'10000000-0000-4000-8000-000000000001',title:'Music Teacher',school_name:'Example School',county:'Meru',location:null,employment_type:null,application_url:'https://school.example/apply',closing_date:null,description:'TSC registration required. Email jobs@school.example. Office: 0723 826181. <script>unsafe()</script>',created_at:'2026-11-06T06:00:00Z',status:'published'}
const swap={id:'20000000-0000-4000-8000-000000000001',current_county:'Mombasa',current_subcounty:'Nyali',preferred_county:'Nakuru',preferred_subcounty:null,school_level:'Junior School',subject:'',created_at:'2026-11-06T06:00:00Z',status:'published',teacher_id:'PRIVATE-TEACHER',contact_phone:'0711111111',message:'PRIVATE INTEREST'}
globalThis.__rows={teacher_vacancies:[job],teacher_swap_listings:[swap]};globalThis.__readError=false
globalThis.__client={from(table){let filters=[],max=Infinity;const q={select(columns){if(columns.includes('contact_phone'))throw Error('Public contact overfetch');return q},eq(k,v){filters.push([k,v]);return q},or(){return q},order(){return q},limit(n){max=n;return q},maybeSingle(){return Promise.resolve(result(true))},then(resolve,reject){return Promise.resolve(result(false)).then(resolve,reject)}};function result(single){const data=(globalThis.__rows[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v)).slice(0,max);return globalThis.__readError?{data:null,error:new Error('Unavailable')}:{data:single?(data[0]??null):data,error:null}}return q}}
async function load(entry,{pdfStub=false}={}){
 const outfile=path.resolve('.next/listing-detail-tests/'+path.basename(entry)+'.'+(pdfStub?'ui':'real')+'.cjs')
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','jspdf'],define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify('https://fixture.supabase.co'),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify('fixture')},plugins:[{name:'fixtures',setup(b){
  b.onResolve({filter:/\.module\.css$/},()=>({path:'styles',namespace:'css'}));b.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default new Proxy({}, {get:(_,k)=>String(k)})',loader:'js'}));
  b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>globalThis.__client',loader:'js'}));
  if(pdfStub){b.onResolve({filter:/^@\/lib\/public\/listingPdf$/},()=>({path:'pdf',namespace:'pdf'}));b.onLoad({filter:/.*/,namespace:'pdf'},()=>({contents:'export const createListingPdf=async()=>({save:name=>{globalThis.__savedPdf=name}})',loader:'js'}))}
  b.onResolve({filter:/^@\//},a=>{const file=path.resolve(a.path.slice(2));return {path:file+(fs.existsSync(file+'.ts')?'.ts':'.tsx')}})
 }}]});return require(outfile)
}
const model=await load('lib/public/teacherListings.ts');const listing=model.jobListing(job);const swapModel=model.swapListing(swap)
assert.equal(model.provided(''), 'Not provided');assert.equal(model.provided('Not specified'),'Not provided')
assert.equal(listing.fields.find(f=>f.label==='Subjects').value,'Music');assert.equal(listing.actions.length,3)
assert(listing.actions.some(a=>a.href==='tel:+254723826181'))
assert.equal(model.jobListing({...job,application_url:'tel:+254723826181'}).actions.filter(a=>a.href.startsWith('tel:')).length,1,'Equivalent local/international contacts deduplicate')
assert.equal(model.jobListing({...job,application_url:'javascript:alert(1)',description:''}).actions.length,0)
assert(model.jobListing({...job,title:'Class Teacher — August 2027'}).fields.some(f=>f.label==='Start date'&&f.value==='August 2027'))
for(const field of [...listing.fields,...swapModel.fields])assert(field.value.trim().length,'Every canonical field retains a value or placeholder')
assert(!JSON.stringify(swapModel).includes('PRIVATE'));assert(!model.listingText(swapModel).includes(swap.contact_phone));assert.equal(swapModel.actions.length,0)
assert.equal(model.listingUrl('swap',swap.id,'https://vibeschool.co.ke'),'https://vibeschool.co.ke/teacher?swap='+swap.id)
const pdf=await load('lib/public/listingPdf.ts');const documentPdf=await pdf.createListingPdf({...listing,details:'A long complete advert. '.repeat(1000)},model.listingUrl('job',job.id,'https://vibeschool.co.ke'))
assert(documentPdf.output().startsWith('%PDF-'));assert(documentPdf.getNumberOfPages()>1);assert(documentPdf.output().includes('Not provided'));assert(documentPdf.output().includes('School name'))
let root
async function render(Component,props={}){if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>{root.render(React.createElement(Component,props));await new Promise(r=>setTimeout(r,0))})}
const button=name=>getByRole(document.body,'button',{name}),role=(r,name)=>getByRole(document.body,r,{name})
const Dialog=(await load('components/teacher/marketplace/ListingDetailDialog.tsx',{pdfStub:true})).default
let dismissals=0,interests=0,copied='',shared=null
Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{copied=text}},configurable:true})
Object.defineProperty(navigator,'share',{value:undefined,writable:true,configurable:true})
function Host({record=listing}){const [open,setOpen]=React.useState(true);return open?React.createElement(Dialog,{listing:record,onClose:()=>{dismissals++;setOpen(false)},interest:record.kind==='swap'?{onClick:()=>interests++}:undefined}):React.createElement('p',null,'Closed')}
document.getElementById('opener').focus();document.body.style.overflow='scroll'
await render(Host);assert.equal(role('dialog',job.title).getAttribute('aria-modal'),'true');assert.equal(document.body.style.overflow,'hidden')
for(const label of ['School name','County','Location','Subjects','Teaching level','Employment type','Start date','Application deadline','Published'])assert([...document.querySelectorAll('dt')].some(dt=>dt.textContent===label))
assert(document.body.textContent.includes('<script>unsafe()</script>'));assert.equal(document.querySelectorAll('script').length,0,'Advert content cannot execute markup')
await act(async()=>fireEvent.click(button('Share')));assert(copied.includes('Not provided')&&copied.includes('?job='+job.id))
await act(async()=>fireEvent.click(button('Download PDF')));assert(globalThis.__savedPdf.endsWith('.pdf'));assert(document.body.textContent.includes('PDF downloaded'))
await act(async()=>fireEvent(document.querySelector('dialog'),new dom.window.Event('cancel',{cancelable:true})))
assert(!queryByRole(document.body,'dialog'));assert.equal(dismissals,1);assert.equal(document.body.style.overflow,'scroll');assert.equal(document.activeElement.id,'opener')
await render(Host,{record:swapModel});assert(!document.body.textContent.includes(swap.contact_phone));await act(async()=>fireEvent.click(button('Express interest')));assert.equal(interests,1)
await act(async()=>fireEvent.click(document.querySelector('h2')));assert(queryByRole(document.body,'dialog'),'Clicking within the sheet does not close it')
await act(async()=>fireEvent.click(document.querySelector('dialog')));assert(!queryByRole(document.body,'dialog'),'Backdrop dismissal reaches the caller')
navigator.share=async data=>{shared=data};await render(Host);await act(async()=>fireEvent.click(button('Share')));assert.equal(shared.url,model.listingUrl('job',job.id,'https://vibeschool.co.ke'))
navigator.share=undefined;Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Denied')}},configurable:true});await render(Host);await act(async()=>fireEvent.click(button('Share')));assert.equal(document.querySelector('input[readonly]').value,model.listingUrl('job',job.id,'https://vibeschool.co.ke'))
const Jobs=(await load('app/teacher/TeachingJobs.tsx',{pdfStub:true})).default
window.history.replaceState(null,'','/teacher');await render(Jobs);await act(async()=>fireEvent.click(button(/View job:/)));assert(queryByRole(document.body,'dialog'));assert.equal(new URLSearchParams(window.location.search).get('job'),job.id)
await act(async()=>fireEvent.click(button('Close listing')));assert(!queryByRole(document.body,'dialog'));assert(!window.location.search.includes('job='))
window.history.replaceState(null,'','/teacher?job='+job.id);await render(Jobs);assert(queryByRole(document.body,'dialog'),'Shared job links open the same popup')
window.history.replaceState(null,'','/teacher?job=10000000-0000-4000-8000-000000009999');await render(Jobs);assert(document.body.textContent.includes('This job is no longer available'));assert(!queryByRole(document.body,'dialog'))
window.history.replaceState(null,'','/teacher');globalThis.__readError=true;await render(Jobs);assert(queryByRole(document.body,'alert'));globalThis.__readError=false;await act(async()=>fireEvent.click(button('Try again')));assert(button(/View job:/))
const FeaturedSwaps=(await load('components/teacher/marketplace/FeaturedSwapStrip.tsx',{pdfStub:true})).default
const SwapMatcher=await load('components/teacher/marketplace/FeaturedSwapStrip.tsx',{pdfStub:true})
assert.equal(SwapMatcher.swapMatchScore(swap,{current_county:'Nakuru',preferred_county:'Mombasa',current_subcounty:'Nakuru Town',preferred_subcounty:'Nyali',school_level:'Junior School',subject:'Mathematics'}),5,'Reciprocal county, level and subcounty are explainable');
assert.equal(SwapMatcher.swapMatchScore(swap,{current_county:'Nairobi',preferred_county:'Mombasa',current_subcounty:'',preferred_subcounty:'',school_level:'Junior School',subject:''}),0,'One-way county is not a reciprocal match');
const Opportunities=(await load('components/teacher/marketplace/TeacherOpportunities.tsx',{pdfStub:true})).default
window.history.replaceState(null,'','/teacher');await render(Opportunities);assert.equal(role('tab','Jobs').getAttribute('aria-selected'),'true')
await act(async()=>fireEvent.keyDown(role('tab','Jobs'),{key:'ArrowRight'}));assert.equal(role('tab','Swaps').getAttribute('aria-selected'),'true');assert.equal(document.activeElement.textContent,'Swaps');assert.equal(document.querySelectorAll('article').length,2,'Featured and normal swap cards are present')
await act(async()=>fireEvent.click(button(/View swap:/)));assert(queryByRole(document.body,'dialog'));assert(!document.body.textContent.includes(swap.contact_phone));assert(role('link','Express interest').getAttribute('href').includes(encodeURIComponent(swap.id)))
await act(async()=>fireEvent.click(button('Close listing')));await act(async()=>fireEvent.change(role('textbox','Search teacher swaps'),{target:{value:'No such county'}}));assert(document.body.textContent.includes('No published swaps match yet'))
window.history.replaceState(null,'','/teacher?swap='+swap.id);await render(Opportunities);assert(queryByRole(document.body,'dialog'),'Shared swap links select the swap tab and open details')
await act(async()=>root.unmount())
const page=fs.readFileSync('app/teacher/page.tsx','utf8');assert(!page.includes('See how your work connects'));assert(!page.includes('Already using VibeSchool?'));assert(page.includes('TeacherExperiencePreview')&&page.includes('/teacher/pulse')&&page.includes('TeacherOpportunities'))
const managed=fs.readFileSync('app/teacher/marketplace/page.tsx','utf8');assert(managed.includes('ListingDetailDialog')&&managed.includes('swapListing(detail)'));assert(managed.includes('contact_phone:null')&&managed.includes('listing_id:selected,sender_id:userId'));assert(managed.includes('teacher_swap_messages')&&managed.includes('Private swap conversation'));
const subcountyPicker=fs.readFileSync('components/teacher/marketplace/SwapSubcountyField.tsx','utf8');
assert(subcountyPicker.includes('list_kenya_subcounties')&&subcountyPicker.includes('p_county_code')&&subcountyPicker.includes('Verified subcounty choices are unavailable.'),'Swap form must use official registry and explain registry failure');
assert(subcountyPicker.includes('No verified subcounty choices for this county yet.')&&subcountyPicker.includes('Your existing subcounty is not yet in the verified directory.'),'Incomplete official geography must not erase legacy data');
assert(managed.includes('SwapSubcountyField')&&managed.includes('current_county:v,current_subcounty:""')&&managed.includes('preferred_county:v,preferred_subcounty:""'),'County switches must reset stale subcounty choices');
assert(managed.includes('teacher_swap_reports')&&managed.includes('Block teacher')&&managed.includes('Unblock')&&managed.includes('End conversation')&&managed.includes('Report swap listing'),'Private safety and reporting actions must remain in the authenticated marketplace');
const safety=fs.readFileSync('supabase/migrations/20261106220000_teacher_swap_safety.sql','utf8');assert(safety.includes('enable row level security')&&safety.includes('reporter_id=(select auth.uid())')&&safety.includes("'blocked'"),'Reports RLS and block status remain enforced');assert(managed.includes('Interest sent privately'))
const css=fs.readFileSync('components/teacher/marketplace/listingDetails.module.css','utf8');assert(css.includes('@media(max-width:600px)')&&css.includes('height:100dvh')&&css.includes('safe-area-inset-bottom')&&css.includes('overflow-y:auto'))
console.log('Teacher listing interactions: PASS (literal metadata, complete placeholders, safe contacts, private swap projection, multi-page PDF, modal dismissal/focus, sharing fallbacks, deep links, retries, tabs, source preservation and mobile sheet rules)')

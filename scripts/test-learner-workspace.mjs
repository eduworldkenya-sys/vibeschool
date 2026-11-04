/** Actual learner components, synthetic Supabase boundary; never writes live data. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const modules=process.env.LEARNER_UI_MODULES || '/tmp/learner-ui/node_modules';
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`));
const {chromium}=await import(pathToFileURL(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || modules}/playwright/index.mjs`));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'learner-workspace-'));
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import Page from './app/teacher/classhub/[id]/student/[studentId]/page';import './components/teacher/studio.css';createRoot(document.getElementById('root')).render(<Page/>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'jsx'},outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',external:['/fonts/*'],plugins:[{name:'synthetic-network-only',setup(b){b.onLoad({filter:/\.module\.css$/},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'local-css'}));b.onResolve({filter:/^(next\/navigation|next\/link|@\/lib\/supabase|@\/lib\/assessment\/interventions)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',resolveDir:process.cwd(),contents:a.path==='next/navigation'?`const router={push:url=>window.routes.push(url),replace:url=>window.routes.push(url)};const search=new URLSearchParams(location.search);export const useParams=()=>({id:'class',studentId:'mary'});export const useRouter=()=>router;export const useSearchParams=()=>search;`:a.path==='next/link'?`import React from 'react';export default function Link(props){return React.createElement('a',props)}`:a.path.endsWith('/interventions')?`export const listInterventionQueue=async()=>location.search.includes('support=1')?[{studentId:'mary',interventionId:'support1',subjectName:'Mathematics',status:'active',priority:'support',masteryScore:30,recommendation:'Practise number patterns.',remedialAssessmentId:null}]:[];`:`export const supabase=window.client;`}))}}]});
const fixture=String.raw`
window.routes=[];window.calls=[];window.state={activities:[],memberships:[],students:[{id:'mary',name:'Mary Wakire'},{id:'other',name:'Other Learner'}],groups:[{id:'g1',name:'Readers',mode:'static',subject_id:'math',class_id:'class',purpose:'Reading together'}],groupMembers:[{group_id:'g1',student_id:'other'}],events:[],identity:{id:'mary',name:'Mary Wakire',admission_number:'098',profile_id:null,gender:null,date_of_birth:null,deleted_at:null},loans:[{id:'l1',student_id:'mary',book_id:'b1',book_title:'Science Book',due_date:'2026-12-01',issued_at:'2026-10-01',returned_at:null},{id:'l2',student_id:'other',book_title:'PRIVATE OTHER BOOK',due_date:'2026-12-01',returned_at:null}],failMembers:0,failGroups:false};
try {
  const saved = sessionStorage.getItem('learner-profile-test-records');
  if (saved) {
    const restored = JSON.parse(saved);
    window.state.events = restored.events;
    window.state.identity = restored.identity;
  }
} catch {}
const ok=data=>({data,error:null});
window.client={auth:{getUser:async()=>ok({user:{id:'teacher'}})},rpc:async(name,args)=>{calls.push({name,args});const s=state;
if(name==='teacher_manage_class_learner'){if(JSON.stringify(args.p_payload.expected)!==JSON.stringify({name:s.identity.name,admission_number:s.identity.admission_number,gender:s.identity.gender,date_of_birth:s.identity.date_of_birth}))return {data:null,error:{message:'learner_edit_conflict'}};for(const key of ['name','admission_number','gender','date_of_birth'])s.identity[key]=args.p_payload[key];return ok('mary')}
if(name==='teacher_get_operating_context')return ok({teacher_id:'teacher',school_id:'school',classes:[{class_id:'class',class_name:'Grade 1',stream:'East',subject_id:'math',subject_name:'Mathematics',is_class_teacher:true}]});
if(name==='teacher_school_life_snapshot')return ok({activities:s.activities,memberships:s.memberships,students:s.students});
if(name==='teacher_save_school_life_activity'){let id=args.p_activity_id;if(!id){id='activity-'+(s.activities.length+1);s.activities.push({id,title:args.p_title,category:args.p_category,details:args.p_details,scope:'class'})}return ok(id)}
if(name==='teacher_set_school_life_members'){if(s.failMembers-- >0)return {data:null,error:{message:'simulated lost connection'}};if(args.p_action==='end'){s.memberships=s.memberships.filter(m=>m.activity_id!==args.p_activity_id||!args.p_student_ids.includes(m.student_id))}else for(const id of args.p_student_ids){let m=s.memberships.find(m=>m.activity_id===args.p_activity_id&&m.student_id===id);if(!m){m={id:'m'+s.memberships.length,activity_id:args.p_activity_id,student_id:id};s.memberships.push(m)}Object.assign(m,{involvement:args.p_involvement,position:args.p_position,note:args.p_note})}return ok(1)}
if(name==='teacher_resolve_class_group_members'){if(s.failGroups)return {error:{message:'Unavailable'},data:null};return ok(s.groupMembers.filter(m=>m.group_id===args.p_group_id).map(m=>({student_id:m.student_id,reason:'saved member'})))}
if(name==='teacher_get_class_operations')return ok({duties:[{id:'d1',title:'Board monitor',starts_on:'2026-10-01',ends_on:'2026-12-01',members:[{student_id:'mary',active:true}]}],borrowings:s.loans,books:[{id:'b1',title:'Science Book',available_copies:3}]});
if(name==='teacher_return_class_library_book'){s.loans.find(l=>l.id===args.p_borrowing_id).returned_at='2026-10-15';return ok(true)}
if(name==='teacher_issue_class_library_book')return ok('new-loan');
throw Error('Unexpected RPC '+name)},from(table){let filters=[],action='read',values=null;const q=new Proxy({}, {get(_,key){if(key==='then')return(resolve)=>{calls.push({table,action,filters,values});let rows=[];
if(table==='student_classes')rows=[{student_id:'mary',school_id:'school',class_id:'class',is_current:true}];if(table==='students')rows=[{...state.identity}];if(table==='subjects')rows=[{id:'math',name:'Mathematics'}];if(table==='homework')rows=[{id:'hw1',school_id:'school',class_id:'class',teacher_id:'teacher',title:'Read chapter one',subject:'Mathematics',due_date:'2026-12-01',type:'homework'}];if(table==='class_groups'){if(state.failGroups)return Promise.resolve({data:null,error:{message:'Unavailable'}}).then(resolve);rows=state.groups};if(table==='library_books')rows=[{id:'b1',title:'Science Book'}];if(table==='library_borrowings')rows=state.loans.filter(l=>l.student_id==='mary');if(table==='class_group_members'){if(action==='upsert'&&!state.groupMembers.some(m=>m.group_id===values.group_id&&m.student_id===values.student_id))state.groupMembers.push(values);if(action==='delete')state.groupMembers=state.groupMembers.filter(m=>!filters.every(([k,v])=>m[k]===v));rows=state.groupMembers}if(table==='teacher_learner_events'){if(action==='insert'){if(state.events.some(e=>e.metadata?.request_id===values.metadata?.request_id&&e.created_by===values.created_by&&e.student_id===values.student_id))return Promise.resolve({data:null,error:{code:'23505',message:'duplicate receipt'}}).then(resolve);const event={id:'ev'+state.events.length,created_at:'2026-10-15',...values};state.events.unshift(event);if(state.failEventAck){state.failEventAck=false;return Promise.resolve({data:null,error:{message:'simulated lost acknowledgement'}}).then(resolve)}}rows=state.events}
if(action==='read')for(const [k,v]of filters)rows=rows.filter(r=>k==='__contains'?Object.entries(v).every(([mk,mv])=>r.metadata?.[mk]===mv):r[k]===v);return Promise.resolve(ok(q.singleRow?rows[0]??null:rows)).then(resolve)};
if(key==='singleRow')return q._single;
return(...args)=>{if(['insert','upsert','delete'].includes(key)){action=key;values=args[0]}if(key==='eq')filters.push(args);if(key==='contains')filters.push(['__contains',args[1]]);if(key==='maybeSingle'||key==='single')q._single=true;return q};},set(target,key,v){target[key]=v;return true}});return q;}};
`;
// Proxy's single-row flag is explicit, avoiding any false success response from writes.
const fixedFixture=fixture.replace("if(key==='singleRow')return q._single;", "if(key==='singleRow')return _._single;");
fs.writeFileSync(path.join(dir,'fixture.js'),fixedFixture);
fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;font-family:Arial;background:#f7f9f7}*{box-sizing:border-box}button{font-family:inherit}</style><body><div id="root"></div><script src="/fixture.js"></script><script src="/app.js"></script></body></html>`);
const server=createServer((req,res)=>{const name=req.url.split('?')[0];const file=name.startsWith('/fonts/')?path.join(process.cwd(),'public',name):path.join(dir,name==='/'?'index.html':path.basename(name));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');if(!fs.existsSync(file)){res.statusCode=404;res.end();return}res.end(fs.readFileSync(file))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox','--disable-gpu']});
const url=`http://127.0.0.1:${server.address().port}`;
let assertions=0;
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:850}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.getByRole('heading',{name:'Mary Wakire',exact:true}).waitFor();
  await page.getByText('Adm. no. 098',{exact:false}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'School life',exact:true}).count(),1);
  assert.equal(await page.getByText('No released subject scores',{exact:false}).count(),1);assertions+=2;
  await page.getByRole('button',{name:'Groups',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Groups · Mary Wakire',exact:true});await dialog.getByText('Readers',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Add learner',exact:true}).click();await dialog.getByRole('button',{name:'Remove learner',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>state.groupMembers.filter(m=>m.student_id==='mary').length),1);assert.deepEqual(await page.evaluate(()=>routes),[]);assertions+=2;
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Resources',exact:true}).click();dialog=page.getByRole('dialog',{name:'Resources · Mary Wakire',exact:true});await dialog.getByRole('article').getByText('Science Book',{exact:true}).waitFor();assert.equal(await dialog.getByText('PRIVATE OTHER BOOK').count(),0);assertions++;
  await dialog.getByRole('button',{name:'Record return',exact:true}).click();await dialog.getByRole('button',{name:'Confirm return',exact:true}).click();await dialog.getByText('Returned 2026-10-15').waitFor();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Roles',exact:true}).click();await page.getByRole('dialog').getByText('Board monitor',{exact:true}).waitFor();assertions++;await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Notes',exact:true}).click();await page.getByRole('dialog').getByLabel('Factual note').fill('PRIVATE unsaved observation');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Recognition',exact:true}).click();dialog=page.getByRole('dialog',{name:'Recognition · Mary Wakire',exact:true});assert.equal(await dialog.getByLabel('Recognition details').inputValue(),'');assertions++;await dialog.getByLabel('Recognition details').fill('Helped the reading group.');await dialog.getByRole('button',{name:'Save recognition',exact:true}).click();await dialog.getByText('Saved to this learner\'s story.').waitFor();assert.equal(await page.evaluate(()=>state.events[0].event_kind),'recognition');assertions++;
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Notes',exact:true}).click();dialog=page.getByRole('dialog',{name:'Notes · Mary Wakire',exact:true});assert.equal(await dialog.getByText('Helped the reading group.').count(),0);assert.equal(await dialog.getByLabel('Factual note').inputValue(),'PRIVATE unsaved observation');assertions++;await page.keyboard.press('Escape');assertions++;
  await page.getByRole('button',{name:'View all',exact:true}).click();dialog=page.getByRole('dialog',{name:'School life · Mary Wakire',exact:true});await dialog.getByRole('button',{name:'Activities',exact:true}).click();dialog=page.getByRole('dialog',{name:'Activities · Mary Wakire',exact:true});await dialog.getByRole('button',{name:'New',exact:true}).click();const creation=page.getByRole('dialog',{name:'New activity · Mary Wakire',exact:true});await creation.getByLabel('Name',{exact:true}).fill('Football');await page.evaluate(()=>state.failMembers=1);await creation.getByRole('button',{name:'Create & add learner',exact:true}).click();await creation.getByRole('button',{name:'Retry Save',exact:true}).waitFor();await creation.getByRole('button',{name:'Retry Save',exact:true}).click();await dialog.getByText('Activity created and learner added as a participant.').waitFor();assert.equal(await page.evaluate(()=>state.activities.length),1);assert.equal(await page.evaluate(()=>state.memberships.filter(m=>m.student_id==='mary').length),1);assertions+=2;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assertions+=2;
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'assessment',exact:true}).click();await page.getByText('RELEASED ASSESSMENTS',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>routes),[]);assertions++;await page.getByRole('button',{name:/^work$/i}).click();await page.getByRole('button',{name:/Read chapter one/}).click();await page.getByRole('dialog',{name:'Read chapter one · Mary Wakire',exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>routes),[]);assertions++;await page.keyboard.press('Escape');
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(dir,`learner-${width}.png`),fullPage:true});await page.close();
 }
 const subject=await browser.newPage();await subject.goto(url+'?subjectId=math');await subject.getByRole('heading',{name:'Mary Wakire'}).waitFor();assert.equal(await subject.getByRole('button',{name:'Roles',exact:true}).count(),0);assert.equal(await subject.getByRole('button',{name:'Resources',exact:true}).count(),0);await subject.getByRole('button',{name:'Groups',exact:true}).click();await subject.getByRole('dialog').getByText('Readers').waitFor();assert.ok((await subject.evaluate(()=>calls)).some(c=>c.table==='class_groups'&&c.filters.some(([k,v])=>k==='subject_id'&&v==='math')));assertions+=3;await subject.close();
 const profile=await browser.newPage({viewport:{width:390,height:850}});
 profile.setDefaultTimeout(10000);
 await profile.goto(url+'?tab=about');
 await profile.getByRole('heading',{name:'Mary Wakire',exact:true}).waitFor();
 await profile.getByRole('heading',{name:'About Mary',exact:true}).waitFor();
 assert.equal(await profile.getByRole('heading',{name:'No learner notes recorded yet'}).count(),1);
 assert.equal(await profile.locator('textarea').count(),0);
 assertions+=2;

 await profile.getByRole('button',{name:'Edit school details'}).click();
 let details=profile.getByRole('dialog',{name:'Edit school details · Mary Wakire'});
 await details.getByLabel('Date of birth (optional)').fill('2018-04-12');
 await details.getByRole('button',{name:'Save details',exact:true}).click();
 await profile.getByText('School details saved.',{exact:true}).waitFor();
 assert.equal(await profile.evaluate(()=>state.identity.date_of_birth),'2018-04-12');
 assertions++;
 await profile.evaluate(()=>state.identity.admission_number='EXTERNAL');
 await profile.getByRole('button',{name:'Edit school details'}).click();
 details=profile.getByRole('dialog',{name:'Edit school details · Mary Wakire'});
 await details.getByLabel('Admission number (optional)').fill('LOCAL');
 await details.getByRole('button',{name:'Save details',exact:true}).click();
 await details.getByRole('alert').getByText(/changed elsewhere/).waitFor();
 assert.equal(await profile.evaluate(()=>state.identity.admission_number),'EXTERNAL');
 await details.getByRole('button',{name:'Close Edit school details'}).click();
 assertions++;

 await profile.getByRole('button',{name:'Add detail',exact:true}).click();
 const picker=profile.getByRole('dialog',{name:'Add learner detail · Mary Wakire'});
 await picker.getByRole('button',{name:/^Interests/}).click();
 let editor=profile.getByRole('dialog',{name:'Add Interests · Mary Wakire'});
 await editor.getByRole('textbox',{name:'Interests',exact:true}).fill('Football and drawing');
 assert.equal(await profile.locator('dd').filter({hasText:'Football and drawing'}).count(),0);
 await editor.getByRole('button',{name:'Save details',exact:true}).click();
 await profile.locator('dd').filter({hasText:'Football and drawing'}).waitFor();
 await profile.getByRole('heading',{name:'Learning and interests'}).waitFor();
 assert.equal(await profile.locator('textarea').count(),0);
 assertions+=2;
 await profile.getByRole('button',{name:'Edit Interests',exact:true}).click();
 editor=profile.getByRole('dialog',{name:'Edit Interests · Mary Wakire'});
 await editor.getByRole('textbox',{name:'Interests',exact:true}).fill('Unsaved change');
 assert.equal(await profile.locator('dd').filter({hasText:'Football and drawing'}).count(),1);
 await editor.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await profile.locator('dd').filter({hasText:'Football and drawing'}).count(),1);
 assertions+=2;

 // Persist mock records between reloads to imitate the server-side database.
 await profile.evaluate(()=>sessionStorage.setItem('learner-profile-test-records',JSON.stringify({
   events:state.events, identity:state.identity,
 })));
 await profile.reload();
 await profile.getByRole('heading',{name:'About Mary'}).waitFor();
 await profile.locator('dd').filter({hasText:'Football and drawing'}).waitFor();
 assert.equal(await profile.locator('textarea').count(),0);
 assert.equal(await profile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await profile.getByRole('button',{name:'Overview',exact:true}).click();
 const savedPreview=profile.getByRole('region',{name:'Saved learner details'});
 await savedPreview.getByText('Football and drawing',{exact:true}).waitFor();
 await savedPreview.getByRole('button',{name:'View details'}).click();
 await profile.getByRole('heading',{name:'Learning and interests'}).waitFor();
 assertions+=3;
 await profile.screenshot({path:path.join(dir,'learner-about-390.png'),fullPage:true});
 await profile.setViewportSize({width:1440,height:900});
 assert.equal(await profile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assertions++;
 await profile.screenshot({path:path.join(dir,'learner-about-1440.png'),fullPage:true});
 await profile.close();

 const failure=await browser.newPage();failure.setDefaultTimeout(10000);await failure.goto(url);await failure.getByRole('heading',{name:'Mary Wakire'}).waitFor();await failure.evaluate(()=>state.failGroups=true);await failure.getByRole('button',{name:'Groups',exact:true}).click();await failure.getByRole('alert').waitFor();assert.equal(await failure.getByRole('dialog').getByText('No current group memberships for this learner.').count(),0);await failure.evaluate(()=>state.failGroups=false);await failure.getByRole('button',{name:'Retry',exact:true}).click();await failure.getByRole('dialog').getByText('Readers',{exact:true}).waitFor();await failure.keyboard.press('Escape');assert.equal(await failure.evaluate(()=>document.activeElement.textContent),'Groups');assertions+=2;await failure.close();
 const support=await browser.newPage();support.setDefaultTimeout(10000);await support.goto(url+'?support=1');await support.getByRole('button',{name:'Open support',exact:true}).click();await support.getByRole('dialog',{name:'Support · Mary Wakire',exact:true}).getByText('Practise number patterns.',{exact:true}).waitFor();assert.deepEqual(await support.evaluate(()=>routes),[]);assertions++;await support.close();
 const ack=await browser.newPage();ack.setDefaultTimeout(10000);await ack.goto(url);await ack.getByRole('heading',{name:'Mary Wakire'}).waitFor();await ack.getByRole('button',{name:'Notes',exact:true}).click();await ack.getByLabel('Factual note').fill('Private retry case');await ack.evaluate(()=>state.failEventAck=true);await ack.getByRole('button',{name:'Save private note',exact:true}).click();await ack.getByRole('alert').getByText('simulated lost acknowledgement',{exact:true}).waitFor();await ack.keyboard.press('Escape');await ack.getByRole('button',{name:'Recognition',exact:true}).click();await ack.getByLabel('Recognition details').fill('Recognition between retries');await ack.getByRole('button',{name:'Save recognition',exact:true}).click();await ack.getByText("Saved to this learner's story.",{exact:true}).waitFor();await ack.keyboard.press('Escape');await ack.getByRole('button',{name:'Notes',exact:true}).click();await ack.getByRole('button',{name:'Save private note',exact:true}).click();await ack.getByText("Saved to this learner's story.",{exact:true}).waitFor();assert.equal(await ack.evaluate(()=>state.events.filter(e=>e.note==='Private retry case').length),1);assertions++;await ack.close();
 console.log(`PASS: ${assertions} learner workspace assertions across 320/390/768/1440px; scoped groups/resources, in-place navigation, recognition separation, partial activity failure/retry, subject boundary, no page errors.`);
}finally{await browser.close();server.close();}

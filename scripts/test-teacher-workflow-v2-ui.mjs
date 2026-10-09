import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url), modules=process.env.WORKBOOK_UI_MODULES;
const dep=n=>modules?require(path.join(modules,n)):require(n);
const {JSDOM}=dep('jsdom'),{build}=dep('esbuild');
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://fixture.invalid/?class_id=c&school_id=s'});
for(const key of ['window','document','HTMLElement','Node','MutationObserver'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {fireEvent,screen,waitFor}=dep('@testing-library/dom');
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const directory=fs.mkdtempSync('/tmp/vibeschool-workflows-');
fs.symlinkSync(path.resolve('node_modules'),path.join(directory,'node_modules'),'dir');
const routes=[];let failure='',calls=[],activeSchool='s';
globalThis.__workflow={from:()=>{const q={select(){return q},eq(){return q},in(){return q},order(){return Promise.resolve(failure==='read'?{data:null,error:{message:'unavailable'}}:{data:[{id:'hw',title:'Fractions practice',subject:'Mathematics',due_date:null,class_id:'c',type:'assignment',homework_submissions:[{id:'1',student_id:'a',status:'submitted'},{id:'2',student_id:'a',status:'received'},{id:'3',student_id:'b',status:'draft'}]}],error:null})}};return q;},router:{push:p=>routes.push(p),replace:p=>routes.push(p),refresh(){},back(){}},rpc:async(name,args)=>{
 calls.push({name,args});
 if(name==='get_my_teacher_school_context')return {data:{active_school_id:activeSchool,schools:[{id:'s',name:'School A'},{id:'other',name:'School B'}]},error:null};
 if(name==='set_my_active_teacher_school'){if(failure!=='stale-school')activeSchool=args.p_school_id;return {data:args.p_school_id,error:null}}
 if(name==='get_allowed_teaching_levels')return failure==='levels'?{data:null,error:{message:'unavailable'}}:{data:{state:'ready',levels:['Grade 4']},error:null};
 if(name==='get_allowed_teaching_subjects')return {data:{state:'ready',subjects:['Mathematics']},error:null};
 if(name==='teacher_get_operating_context')return {data:{teacher_id:'t',school_id:'s',state:'ready',schools:[],classes:[{class_id:'c',class_name:'Grade 4',subject_name:'Mathematics',subject_id:'math',is_class_teacher:true}]},error:null};
 if(name==='create_teacher_class_assignment'&&failure==='network')throw Error('network');
 if(name==='teacher_add_student_v2')return (failure==='null'||failure==='partial'&&args.p_name==='Second Learner')?{data:null,error:null}:{data:'learner',error:null};
 return {data:'c',error:null};
}};
async function component(file){
 const output=path.join(directory,path.basename(path.dirname(file))+'-'+path.basename(file)+'.cjs');
 await build({entryPoints:[file],outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'isolated-boundaries',setup(b){
 b.onResolve({filter:/^next\/navigation$|^@\/lib\/supabase$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='next/navigation'?'export const useRouter=()=>globalThis.__workflow.router;':'export const supabase={auth:{getUser:async()=>({data:{user:{id:"t"}},error:null})},rpc:(...args)=>globalThis.__workflow.rpc(...args),from:(...args)=>globalThis.__workflow.from(...args)};'}));
 b.onResolve({filter:/^@\//},a=>{const p=path.resolve(a.path.slice(2));return {path:fs.existsSync(p+'.tsx')?p+'.tsx':p+'.ts'}});
 }}]});
 const imported=await import(pathToFileURL(output));return imported.default.default??imported.default;
}
let root;
async function mount(Component,props={}){root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Component,props)));}
async function unmount(){await act(async()=>root.unmount());}
try {
 const Form=await component('components/teacher/TeacherClassForm.tsx');
 failure='levels';await mount(Form,{schoolId:'s',mode:'add'});await waitFor(()=>assert.match(screen.getByRole('alert').textContent,/levels could not/));
 failure='';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Retry class setup'})));await waitFor(()=>assert.equal(screen.queryByRole('alert'),null));
 await act(async()=>fireEvent.change(screen.getByRole('combobox',{name:'Grade / Form'}),{target:{value:'Grade 4'}}));
 await waitFor(()=>assert.match(document.body.textContent,/Mathematics/));await act(async()=>fireEvent.change(screen.getByRole('combobox',{name:'Subject'}),{target:{value:'Mathematics'}}));
 failure='network';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Add or join class'})));assert.match(screen.getByRole('alert').textContent,/choices are still here/);assert.equal(screen.getByRole('button',{name:'Add or join class'}).disabled,false);assert.equal(routes.length,0);
 failure='';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Add or join class'})));assert.equal(routes.at(-1),'/teacher/classhub?added=1');await unmount();
 routes.length=0;const Students=await component('app/teacher/onboarding/students/page.tsx');await mount(Students);
 await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:'Learner 1 name'}),{target:{value:'Test Learner'}}));failure='null';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Add learners →'})));assert.match(screen.getByRole('alert').textContent,/could not be confirmed/);assert.equal(routes.length,0);assert.equal(screen.getByRole('button',{name:'Add learners →'}).disabled,false);
 const first=calls.find(c=>c.name==='teacher_add_student_v2');failure='';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Add learners →'})));assert.equal(calls.filter(c=>c.name==='teacher_add_student_v2').at(-1).args.p_request_id,first.args.p_request_id);assert.match(routes.at(-1),/student\/learner/);await unmount();
 const Add=await component('app/teacher/classhub/add/page.tsx');await mount(Add);await waitFor(()=>assert.equal(screen.getByRole('combobox',{name:'School'}).value,'s'));
 failure='stale-school';await act(async()=>fireEvent.change(screen.getByRole('combobox',{name:'School'}),{target:{value:'other'}}));assert.match(screen.getByRole('alert').textContent,/could not be confirmed/);assert.equal(screen.queryByRole('button',{name:'Add or join class'}),null);
 failure='';await act(async()=>fireEvent.change(screen.getByRole('combobox',{name:'School'}),{target:{value:'other'}}));await waitFor(()=>assert.equal(screen.getByRole('combobox',{name:'School'}).value,'other'));assert.equal(calls.filter(c=>c.name==='get_allowed_teaching_levels').at(-1).args.p_school_id,'other');await unmount();
 calls=[];await mount(Students);await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:'Learner 1 name'}),{target:{value:'First Learner'}}));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'+ Add Another Student'})));await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:'Learner 2 name'}),{target:{value:'Second Learner'}}));failure='partial';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Add learners →'})));assert.match(screen.getByRole('alert').textContent,/1 learner confirmed/);assert.equal(screen.getByRole('textbox',{name:'Learner 1 name'}).disabled,true);failure='';await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Add learners →'})));assert.equal(calls.filter(c=>c.name==='teacher_add_student_v2'&&c.args.p_name==='First Learner').length,1);await unmount();
 const Homework=await component('app/teacher/homework/page.tsx');await mount(Homework);await waitFor(()=>assert.match(document.body.textContent,/1 learner submitted/));assert.match(document.body.textContent,/No due date/);assert.equal(screen.queryByText('Expected'),null);await unmount();
 failure='read';await mount(Homework);await waitFor(()=>assert.match(screen.getByRole('alert').textContent,/could not be loaded/));assert.equal(screen.queryByText('No assignments match this view.',{exact:false}),null,'failed reads must not look empty');await unmount();
 console.log('Teacher workflow DOM: authority retry, rejected-save recovery, subject-teacher destination, null learner rejection and idempotent retry passed.');
} finally {fs.rmSync(directory,{recursive:true,force:true});}

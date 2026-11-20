// Deterministic Content-as-Code compiler for the existing editorial textbook schema.
// NO production writes, authentication, automated approvals or publication.
// Generated payloads are server-side only; do not bundle into a learner client.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const insist=(ok,msg)=>{if(!ok)throw new Error(msg)};
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const roles=['learner','practice','assessment','marking','revision','teacher'];
const unique=(items,key,name)=>{
 insist(Array.isArray(items)&&items.length>0,name+' missing');
 const ids=items.map(x=>x?.[key]);
 insist(ids.every(nonempty)&&new Set(ids).size===ids.length,name+' invalid or duplicate IDs');
 return new Set(ids);
};
const same=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));
const digest=(x)=>createHash('sha256').update(x).digest('hex');
export function compileContent(manifest,doc,bytes){
 const s=manifest.scope;
 insist(manifest.schema==='vibeschool.content-as-code-manifest.v1','manifest schema invalid');
 insist(doc.schema==='vibeschool.originals.editorial-textbook-unit.v1','manuscript schema invalid');
 insist(doc.status==='EDITORIAL_CANDIDATE_ONLY_NOT_IMPORTED_NOT_PUBLISHED','non-editorial source not accepted');
 insist(Number.isSafeInteger(manifest.version)&&manifest.version>0,'version invalid');
 insist(doc.editorialRevision?.version===manifest.version,'editorial version mismatch');
 insist(uuid(s?.subStrandId)&&doc.target?.subStrandId===s.subStrandId,'sub-strand mismatch');
 insist(/^vs:g[1-9][0-9]*:[a-z0-9-]+:[a-z0-9-]+:$/.test(s.resourcePrefix),'scope prefix invalid');
 insist(doc.grade===s.grade&&doc.subject===s.subject&&doc.unit===s.unit,'grade/subject/unit mismatch');
 insist(doc.source?.url===s.sourceUrl&&new URL(s.sourceUrl).protocol==='https:','source mismatch');
 insist(nonempty(doc.title)&&nonempty(doc.manuscript)&&nonempty(doc.teacherGuide)&&nonempty(doc.revision),'empty instructional content');
 insist(Buffer.isBuffer(bytes),'original source bytes required');
 const parsed=JSON.parse(bytes.toString('utf8'));
 insist(JSON.stringify(parsed)===JSON.stringify(doc),'source bytes differ from parsed document');
 const sourceBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 insist(sourceBlob===manifest.editorialBlob,'editorial git blob mismatch');
 insist(Object.keys(manifest.components??{}).length===roles.length&&roles.every(k=>uuid(manifest.components[k]))&&new Set(Object.values(manifest.components)).size===roles.length,'component identity mismatch');
 insist(Array.isArray(s.outcomeCodes)&&s.outcomeCodes.every(nonempty)&&new Set(s.outcomeCodes).size===s.outcomeCodes.length,'invalid outcome list');
 const outcomes=new Set(s.outcomeCodes);
 unique(doc.reader,'id','reader');
 const readerCodes=new Set(doc.reader.flatMap(x=>{
  insist(nonempty(x.title)&&nonempty(x.markdown)&&Array.isArray(x.sourceOutcomeCodes)&&x.sourceOutcomeCodes.length>0,'reader section incomplete');
  return x.sourceOutcomeCodes;
 }));
 insist(same(readerCodes,outcomes),'reader outcome coverage mismatch');
 const practice=unique(doc.practice,'id','practice'), assessment=unique(doc.assessment,'id','assessment');
 insist(same(unique(doc.practiceFeedback,'itemId','feedback'),practice),'feedback coverage mismatch');
 insist(same(unique(doc.assessmentMarkingGuide,'itemId','marking'),assessment),'marking coverage mismatch');
 for(const item of [...doc.practice,...doc.assessment]){
  insist(outcomes.has(item.outcomeCode)&&nonempty(item.prompt),'item outside outcome scope');
  insist(!('answer' in item)&&!('rubric' in item)&&!('explanation' in item)&&!('correctAnswer' in item),'answer material in prompt');
 }
 for(const f of doc.practiceFeedback)insist(nonempty(f.answer)&&nonempty(f.explanation),'feedback incomplete');
 for(const f of doc.assessmentMarkingGuide)insist(nonempty(f.answer)&&nonempty(f.rubric),'marking incomplete');
 insist(doc.assessment.every(x=>Number.isSafeInteger(x.marks)&&x.marks>0),'invalid marks');
 unique(doc.visualCandidates,'id','visuals');
 insist(doc.visualCandidates.every(x=>nonempty(x.alt)&&nonempty(x.title)),'visual alt text missing');
 const observed={reader:doc.reader.length,practice:doc.practice.length,assessment:doc.assessment.length,marks:doc.assessment.reduce((n,x)=>n+x.marks,0),visuals:doc.visualCandidates.length};
 for(const k of Object.keys(observed))insist(observed[k]===manifest.expected[k],'count mismatch: '+k);
 const base={grade:doc.grade,subject:doc.subject,strand:doc.strand,unit:doc.unit,title:doc.title,source:doc.source,manuscript:doc.manuscript,schema:doc.schema,status:'EDITORIAL_CANDIDATE_ONLY'};
 const bodies={learner:{reader:doc.reader,visualCandidates:doc.visualCandidates,editorialIssues:doc.editorialIssues},practice:{items:doc.practice,feedback:doc.practiceFeedback},assessment:{items:doc.assessment},marking:{markingGuide:doc.assessmentMarkingGuide},revision:{revision:doc.revision},teacher:{teacherGuide:doc.teacherGuide}};
 return {manifest,sourceBlob,sourceSha256:digest(bytes),observed,components:roles.map(role=>({role,key:s.resourcePrefix+role+':unit:01',id:manifest.components[role],version:manifest.version,payload:{...base,...bodies[role]}}))};
}
// SQL literals are encoded as UTF-8 hex. This produces a read-only audit, not a mutation.
const lit=x=>"convert_from(decode('"+Buffer.from(String(x),'utf8').toString('hex')+"','hex'),'UTF8')";
export function readbackSql(compiled){
 const {manifest:m,components}=compiled;
 const vals=components.map(c=>'('+lit(c.key)+','+lit(c.id)+'::uuid,'+c.version+','+lit(JSON.stringify(c.payload))+'::jsonb)').join(',\n');
 const prefix=lit(m.scope.resourcePrefix),sub=lit(m.scope.subStrandId)+'::uuid';
 return `with expected(k,version_id,version,payload) as (values ${vals}),
 rows as (
 select e.k,e.version_id, v.id as stored_id,r.status,r.visibility,v.lifecycle_status,v.rights_status,
 coalesce(v.id=e.version_id and v.version=e.version and v.payload=e.payload and v.content_sha256=encode(extensions.digest(convert_to(e.payload::text,'UTF8'),'sha256'),'hex'),false) as exact_match
 from expected e left join public.learning_resources r on r.canonical_key=e.k and r.sub_strand_id=${sub} and r.owner_type='platform' and r.source_type='platform_authored'
 left join public.learning_resource_versions v on v.resource_id=r.id and v.version=e.version
 ), scopes as (select package_id from public.vs_curriculum_package_scopes where sub_strand_id=${sub} and resource_key_prefix=${prefix})
 select jsonb_build_object(
  'code_readback_pass',(select count(*)=6 and bool_and(exact_match) from rows),
  'components',(select jsonb_agg(to_jsonb(rows) order by k) from rows),
  'registered_package_gates',(select coalesce(jsonb_agg(public.vs_curriculum_package_gate(package_id)),'[]'::jsonb) from scopes),
  'authenticated_actor_present',auth.uid() is not null,
  'public_certified_count',(select count(*) from rows where exact_match and status='active' and visibility='public' and lifecycle_status='certified' and rights_status in ('cleared','not_applicable')),
  'publication_verified',false,
  'note','Read-only source/version audit; no approval, source acceptance, certification, release or learner journey is implied.'
 ) as result;\n`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const manifest=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const bytes=readFileSync(manifest.manuscript);
 const c=compileContent(manifest,JSON.parse(bytes),bytes);
 if(process.argv[3]==='--sql')process.stdout.write(readbackSql(c));
 else console.log(JSON.stringify({sourceBlob:c.sourceBlob,sourceSha256:c.sourceSha256,observed:c.observed,componentIds:c.components.map(({key,id,version})=>({key,id,version})),compiled:true,publicationVerified:false},null,2));
}

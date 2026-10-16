import assert from 'node:assert/strict';
import { readCurrentRoster } from '../lib/classroom/currentRoster.ts';
const students = Array.from({length:1201}, (_, i) => ({ id: String(i).padStart(5,'0'), name: `Learner ${i}`, admission_number: null, profile_id: null, created_at:'2026-10-16', deleted_at:null }));
const enrollments = students.map(student => ({school_id:'school-a',class_id:'class-a',student_id:student.id,is_current:true}));
enrollments.push({school_id:'school-b',class_id:'class-b',student_id:'other-school',is_current:true});
// Contradictory legacy scope and a separate same-school class are negative controls.
enrollments.push({school_id:'school-b',class_id:'class-a',student_id:'wrong-school',is_current:true});
enrollments.push({school_id:'school-a',class_id:'another-class',student_id:students[0].id,is_current:true});
enrollments.push({school_id:'school-a',class_id:'class-a',student_id:'departed',is_current:false});
let calls = [];
function client(identities=students, failTable=null) {
  return { from(table) {
    let rows = table === 'students' ? [...identities] : [...enrollments];
    let range = null;
    const query = {
      select(){ return query; },
      eq(key,value){ rows=rows.filter(row=>row[key]===value); return query; },
      is(key,value){ rows=rows.filter(row=>row[key]===value); return query; },
      in(key,values){ rows=rows.filter(row=>values.includes(row[key])); return query; },
      order(){ return query; },
      range(from,to){ range=[from,to]; rows=rows.slice(from,to+1); return query; },
      then(resolve,reject){ calls.push({table,range,count:rows.length}); return Promise.resolve({data:rows,error:failTable===table?new Error('denied'):null}).then(resolve,reject); },
    }; return query;
  }};
}
const roster=await readCurrentRoster(client(),'school-a',['class-a','class-a']);
assert.equal(roster.length,1201,'Roster must not silently stop at the Data API row limit');
assert.equal(new Set(roster.map(row=>row.learner.id)).size,1201);
assert.ok(roster.every(row=>row.classId==='class-a'));
assert.equal(calls.filter(call=>call.table==='student_classes').length,3);
assert.ok(calls.filter(call=>call.table==='students').every(call=>call.count<=500),'Identity fetches must be bounded');
await assert.rejects(()=>readCurrentRoster(client(students.slice(1)),'school-a',['class-a']),/identities could not be confirmed/,'Never silently hide an enrolled learner');
await assert.rejects(()=>readCurrentRoster(client(students,'students'),'school-a',['class-a']),/denied/);
assert.deepEqual(await readCurrentRoster(client(),'school-a',[]),[]);
assert.deepEqual(await readCurrentRoster(client(),'school-a',['unassigned']),[]);
console.log('Shared current roster: pagination, isolation filters, missing identities and failures PASS');

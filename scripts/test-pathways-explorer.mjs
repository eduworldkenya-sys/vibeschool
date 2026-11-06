import assert from 'node:assert/strict'
import { exploreTrack, schoolFilters } from '../lib/pathways/explorer.ts'
const p={id:'p',slug:'stem',name:'STEM'},t={id:'t',pathway_id:'p',slug:'pure-sciences',name:'Pure Sciences'}
const combination={id:'c',pathway_id:'p',track_id:'t',slug:'bio-chem',display_name:'Biology · Chemistry'}
const data={pathways:[p],tracks:[t],combinations:[combination,{...combination,id:'wrong',track_id:'other'}],subjects:[{combination_id:'c',subject_name:'Chemistry',subject_order:2},{combination_id:'c',subject_name:'Biology',subject_order:1},{combination_id:'wrong',subject_name:'Electricity',subject_order:1}],careers:[{id:'doctor',slug:'doctor',name:'Doctor',summary:'Health'},{id:'engineer',slug:'engineer',name:'Engineer',summary:'Technical'},{id:'general',slug:'general',name:'General',summary:'Guidance'}],links:[{career_id:'doctor',pathway_id:'p',track_id:'t',explanation:'Science'},{career_id:'engineer',pathway_id:'p',track_id:'other',explanation:'Tech'},{career_id:'general',pathway_id:'p',track_id:null,explanation:'Pathway guidance'}]}
const view=exploreTrack(data,p,t)
assert.deepEqual(view.combinations,[combination])
assert.deepEqual(view.subjects,['Biology','Chemistry'])
assert.deepEqual(view.careers.map(c=>c.id),['doctor','general'])
assert.equal(view.careers[1].pathwayOnly,true)
assert.deepEqual(exploreTrack(data,{...p,id:'other'},t),{combinations:[],subjects:[],careers:[]})
assert.equal(schoolFilters(p,combination).p_combination_slug,'bio-chem')
assert.equal(schoolFilters(p).p_combination_slug,null)
console.log('PASS: track/pathway isolation, ordered subjects, career scope and school filters')

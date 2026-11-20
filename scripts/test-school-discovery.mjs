import assert from 'node:assert/strict'
import {test} from 'node:test'
import {locationSuggestions,locationSearchCandidate,mergeSchoolMatches} from '../lib/school-discovery.ts'
const options=[
 {option_kind:'county',option_value:'Kericho'},
 {option_kind:'county',option_value:'Nakuru'},
 {option_kind:'county',option_value:'Nairobi'},
 {option_kind:'sub_county',option_value:'Gilgil'},
]
test('partial Kerich recognizes county; exact school is not displaced',()=>{
 const matches=locationSuggestions('Kerich',options,'')
 assert.equal(locationSearchCandidate(matches,'Kerich').option_value,'Kericho')
 assert.deepEqual(mergeSchoolMatches([{slug:'school-in-tharaka'}],[{slug:'school-in-kericho'},{slug:'school-in-tharaka'}],100).map(s=>s.slug),['school-in-tharaka','school-in-kericho'])
})
test('county typos are suggestions, not silently applied; ambiguity stays explicit',()=>{
 const matches=locationSuggestions('Kericjo',options,'')
 assert.equal(matches[0].option_value,'Kericho')
 assert.equal(locationSearchCandidate(matches,'Kericjo'),null)
 assert.equal(locationSearchCandidate(locationSuggestions('Na',options,''),'Na'),null)
})
test('sub-county suggestions honor selected county and cap deduplicated results',()=>{
 assert.equal(locationSuggestions('Gilg',options,'').length,0)
 assert.equal(locationSearchCandidate(locationSuggestions('Gilg',options,'Nakuru'),'Gilg').option_value,'Gilgil')
 assert.equal(mergeSchoolMatches([{slug:'a'}],[{slug:'a'},{slug:'b'}],1).length,1)
})

'use client'

import type {SlideDemo} from '@/components/live-classroom/LiveSlideProtocol'
import {TeachingModelPicker} from '@/components/live-classroom/TeachingModelPicker'
import TeachingToolShelf from './TeachingToolShelf'
import {resolveTeachingTools, type TeachingToolSpec} from '@/lib/learn/teachingToolCatalog'

// These self-contained examples run outside the authorized textbook reader.
// They make no curriculum admission, record no attempts, and require no account.
const examples: readonly {subject:string; display?:string; label:string; spec:TeachingToolSpec}[] = [
  {subject:'Mathematics',label:'Place-value explorer',spec:{id:'place-value',number:20458}},
  {subject:'Mathematics',label:'Fraction comparator',spec:{id:'fraction-bars'}},
  {subject:'Mathematics',label:'Unit converter',spec:{id:'unit-converter'}},
  {subject:'English',display:'English and Kiswahili',label:'Letter tiles',spec:{id:'word-builder',word:'school',prompt:'Build the word school using the letters.'}},
  {subject:'Kiswahili',display:'English and Kiswahili',label:'Kiswahili sentence builder',spec:{id:'sentence-order',sentence:'Watoto wanasoma vitabu.',prompt:'Panga maneno kuwa sentensi.'}},
  {subject:'English',display:'English and Kiswahili',label:'Vocabulary match',spec:{id:'vocabulary-match',pairs:[
    {term:'Enormous',definition:'Very large'},{term:'Scarce',definition:'Hard to find'},{term:'Swift',definition:'Moving quickly'},
  ]}},
  {subject:'English',display:'English and Kiswahili',label:'Read and reflect',spec:{id:'reading-comprehension',
    passage:'Amina noticed that rainwater ran off the school roof and pooled beside the path. Her class put a covered container beneath the gutter. They used the collected water for their garden.',
    question:'How did the class make use of the rainwater?',sampleAnswer:'They collected it in a covered container and used it to water their garden.'}},
  {subject:'English',display:'English and Kiswahili',label:'Story planner',spec:{id:'writing-planner',prompt:'Plan a story about finding something unexpected on the way to school.'}},
  {subject:'Science and Technology',label:'Animal classification',spec:{id:'classification',groups:['Mammal','Bird','Fish'],
    items:[{label:'Cow',group:'Mammal'},{label:'Eagle',group:'Bird'},{label:'Tilapia',group:'Fish'},{label:'Goat',group:'Mammal'}]}},
  {subject:'Science and Technology',label:'Food-chain builder',spec:{id:'food-chain',sequence:['Grass','Grasshopper','Frog','Snake']}},
  {subject:'Science and Technology',label:'Fair-test planner',spec:{id:'experiment-variables',prompt:'Compare how the amount of water affects seedling height.',
    items:[{label:'Amount of water',group:'Changed (independent)'},{label:'Seedling height',group:'Measured (dependent)'},{label:'Type of seed',group:'Kept the same (controlled)'}]}},
  {subject:'Creative Arts',label:'Drawing pad',spec:{id:'drawing-pad',prompt:'Sketch a design using repeating lines and shapes.'}},
]

const activities = examples.flatMap(({subject,display,label,spec}) =>
  resolveTeachingTools(subject, '', [spec]).length ? [{
    kind:`activity-${spec.id}`, subject:display??subject, label,
    render:()=> <TeachingToolShelf subject={subject} tools={[spec]} standalone/>,
  }] : [])

export function TeachingToolsLibrary({onPrepare,disabled=false}:{onPrepare?:(demo:SlideDemo)=>void;disabled?:boolean}={}) {
  return <TeachingModelPicker activities={activities} onPresent={onPrepare} disabled={disabled} actionLabel="Add to lesson" layout="grid"/>
}

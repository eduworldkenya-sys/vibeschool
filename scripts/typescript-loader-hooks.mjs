// Shared loader hooks for synchronous modern Node and asynchronous Node 20.
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
function normalize(specifier) {
  return specifier.startsWith('@/') ? new URL(specifier.slice(2),root).href : specifier;
}
function missing(specifier,context,error) {
  if(error.code!=='ERR_MODULE_NOT_FOUND') throw error;
  if(!specifier.startsWith('.') && !specifier.startsWith('file:')) throw error;
  const url=new URL(specifier,context.parentURL);
  for(const suffix of ['.ts','.tsx']) {
    const candidate=new URL(url.href+suffix);
    if(existsSync(fileURLToPath(candidate))) return {url:candidate.href,shortCircuit:true};
  }
  throw error;
}
export function resolveSync(specifier,context,nextResolve) {
  specifier=normalize(specifier);
  try {return nextResolve(specifier,context)} catch(error) {return missing(specifier,context,error);}
}
export async function resolve(specifier,context,nextResolve) {
  specifier=normalize(specifier);
  try {return await nextResolve(specifier,context)} catch(error) {return missing(specifier,context,error);}
}
export function load(url,context,nextLoad) {
  if(url.startsWith('file:') && /\.tsx?$/.test(url)) {
    const source=ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    return {format:'module',source,shortCircuit:true};
  }
  return nextLoad(url,context);
}

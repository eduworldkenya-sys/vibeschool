// Local regression runner: preserve the application's TypeScript and alias
// resolution without changing emitted application code or requiring a bundler.
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
registerHooks({
  resolve(specifier,context,nextResolve) {
    if(specifier.startsWith('@/')) specifier=new URL(specifier.slice(2),root).href;
    try {return nextResolve(specifier,context)} catch(error) {
      if(error.code!=='ERR_MODULE_NOT_FOUND') throw error;
      if(!specifier.startsWith('.') && !specifier.startsWith('file:')) throw error;
      const url=new URL(specifier,context.parentURL);
      for(const suffix of ['.ts','.tsx']) {
        const candidate=new URL(url.href+suffix);
        if(existsSync(fileURLToPath(candidate))) return {url:candidate.href,shortCircuit:true};
      }
      throw error;
    }
  },
  load(url,context,nextLoad) {
    if(url.startsWith('file:') && /\.tsx?$/.test(url)) {
      const source=ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
      return {format:'module',source,shortCircuit:true};
    }
    return nextLoad(url,context);
  }
});

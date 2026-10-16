import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const reverse=/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"][^'"]*(?:integrations\/|astro-integration)/;
export function reverseCoreImports(directory) {
  const findings=[];
  function visit(current) {
    for(const item of readdirSync(current,{withFileTypes:true})) {
      const file=path.join(current,item.name);
      if(item.isDirectory()) {
        if(!['test','tests','__tests__'].includes(item.name)) visit(file);
      } else if(/(?:\.mjs|\.d\.ts)$/.test(item.name) && !/\.(?:test|spec)(?:\.mjs|\.d\.ts)$/.test(item.name)) {
        if(reverse.test(readFileSync(file,'utf8'))) findings.push(path.relative(directory,file));
      }
    }
  }
  visit(directory);
  return findings.sort();
}
export function assertCorePin(integration,core) {
  assert.equal(typeof core.version,'string','Core version must be explicit');
  assert.equal(integration.dependencies?.['@zeroemployeeorg/publication-core'],core.version,'Integration dependency must equal actual core package version');
}

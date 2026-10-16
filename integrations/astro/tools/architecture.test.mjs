import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const forbidden=/\b(?:provider|credential\w*|renderer|scheduler)\b|(?:node:)?(?:fs|net|child_process)(?:['"/]|\b)|\b(?:fetch|process|Date\.now)\b/i;
const reverse=/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"][^'"]*(?:integrations\/|astro-integration)/;
test('runtime source contains no effects, house vocabulary or reverse core dependency',()=>{
 const manifest=JSON.parse(readFileSync(new URL('package.json',root)));
 assert.equal(manifest.private,true);assert.equal(manifest.engines.node,'>=24 <25');
 assert.equal(readFileSync(new URL('.node-version',root),'utf8').trim(),'24');assert.equal(process.versions.node.split('.')[0],'24');
 assert.deepEqual(manifest.dependencies,{'@zeroemployeeorg/publication-core':'0.1.0-alpha.4'});assert.equal(manifest.devDependencies,undefined);
 assert.equal(manifest.type,'module');assert.deepEqual(manifest.exports,{'.':{types:'./index.d.ts',import:'./index.mjs'}});
 assert.deepEqual(manifest.files,['index.mjs','index.d.ts','quality','README.md','CHANGELOG.md','.node-version']);
 const files=['index.mjs',...readdirSync(new URL('quality/',root)).map(name=>'quality/'+name)];
 for(const name of files)assert.ok(!forbidden.test(readFileSync(new URL(name,root),'utf8')),name);
 const core=readFileSync(new URL('../../packages/publication-core/index.mjs',root),'utf8');assert.ok(!reverse.test(core));
 assert.match(readFileSync(new URL('index.mjs',root),'utf8'),/from '@zeroemployeeorg\/publication-core'/);
});
test('guard refuses forbidden capabilities and reverse imports',()=>{
 for(const text of ["import x from 'node:fs'","import x from 'node:net'","import x from 'node:child_process'",'const credential = 1','const provider = 1','const renderer = 1','const scheduler = 1','Date.now()'])assert.ok(forbidden.test(text));
 for(const text of ["import x from '../../integrations/astro/index.mjs'","export {x} from '@zeroemployeeorg/astro-integration'","import('@zeroemployeeorg/astro-integration')"])assert.ok(reverse.test(text));
});

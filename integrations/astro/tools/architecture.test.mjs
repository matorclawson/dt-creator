import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reverseCoreImports,assertCorePin} from './core-boundary.mjs';
const root=new URL('../',import.meta.url);
const forbidden=/\b(?:provider|credential\w*|renderer|scheduler)\b|(?:node:)?(?:fs|net|child_process)(?:['"/]|\b)|\b(?:fetch|process|Date\.now)\b/i;
const reverse=/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"][^'"]*(?:integrations\/|astro-integration)/;
test('runtime source contains no effects, house vocabulary or reverse core dependency',()=>{
 const manifest=JSON.parse(readFileSync(new URL('package.json',root)));
 assert.equal(manifest.private,true);assert.equal(manifest.engines.node,'>=24 <25');
 assert.equal(readFileSync(new URL('.node-version',root),'utf8').trim(),'24');assert.equal(process.versions.node.split('.')[0],'24');
 const coreManifest=JSON.parse(readFileSync(new URL('../../packages/publication-core/package.json',root)));
 assert.deepEqual(Object.keys(manifest.dependencies),['@zeroemployeeorg/publication-core']);assertCorePin(manifest,coreManifest);assert.equal(manifest.devDependencies,undefined);
 assert.equal(manifest.type,'module');assert.deepEqual(manifest.exports,{'.':{types:'./index.d.ts',import:'./index.mjs'}});
 assert.deepEqual(manifest.files,['index.mjs','index.d.ts','quality','README.md','CHANGELOG.md','.node-version']);
 const files=['index.mjs',...readdirSync(new URL('quality/',root)).map(name=>'quality/'+name)];
 for(const name of files)assert.ok(!forbidden.test(readFileSync(new URL(name,root),'utf8')),name);
 assert.deepEqual(reverseCoreImports(fileURLToPath(new URL('../../packages/publication-core/',root))),[]);
 assert.match(readFileSync(new URL('index.mjs',root),'utf8'),/from '@zeroemployeeorg\/publication-core'/);
});
test('guard refuses forbidden capabilities and reverse imports',()=>{
 for(const text of ["import x from 'node:fs'","import x from 'node:net'","import x from 'node:child_process'",'const credential = 1','const provider = 1','const renderer = 1','const scheduler = 1','Date.now()'])assert.ok(forbidden.test(text));
 for(const text of ["import x from '../../integrations/astro/index.mjs'","export {x} from '@zeroemployeeorg/astro-integration'","import('@zeroemployeeorg/astro-integration')"])assert.ok(reverse.test(text));
});

test('recursive core guard finds nested runtime and declaration imports while excluding tests',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'astro-core-boundary-'));
 try {
   mkdirSync(path.join(directory,'deep/nested'),{recursive:true});mkdirSync(path.join(directory,'test'),{recursive:true});
   writeFileSync(path.join(directory,'index.mjs'),'export const neutral = true;');
   assert.deepEqual(reverseCoreImports(directory),[]);
   writeFileSync(path.join(directory,'deep/nested/hidden.mjs'),"export {x} from '@zeroemployeeorg/astro-integration';");
   writeFileSync(path.join(directory,'deep/nested/hidden.d.ts'),"import type {PageExpectation} from '../../../integrations/astro/index.mjs';");
   writeFileSync(path.join(directory,'test/probe.mjs'),"import '@zeroemployeeorg/astro-integration';");
   writeFileSync(path.join(directory,'deep/ignored.test.mjs'),"import '@zeroemployeeorg/astro-integration';");
   assert.deepEqual(reverseCoreImports(directory),['deep/nested/hidden.d.ts','deep/nested/hidden.mjs']);
 } finally {rmSync(directory,{recursive:true,force:true});}
});
test('stale integration dependency fails when core version changes',()=>{
 const integration={dependencies:{'@zeroemployeeorg/publication-core':'0.1.0-alpha.4'}};
 assert.doesNotThrow(()=>assertCorePin(integration,{version:'0.1.0-alpha.4'}));
 assert.throws(()=>assertCorePin(integration,{version:'0.1.0-alpha.5'}),/must equal/);
 assert.throws(()=>assertCorePin({}, {version:'0.1.0-alpha.4'}),/must equal/);
});

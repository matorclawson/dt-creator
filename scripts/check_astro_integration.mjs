// Candidate-only offline pack/install proof; no publishing, aliases or workspace links.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,realpathSync,lstatSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../',import.meta.url));
assert.equal(process.versions.node.split('.')[0],'24','admitted Node24 required');
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const sourceStatus=execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'});
console.log('head: '+sourceHead);console.log('worktree_clean: '+(sourceStatus.length===0));
const scratch=mkdtempSync(path.join(tmpdir(),'zeocreator-astro-'));
const env={...process.env,npm_config_cache:path.join(scratch,'npm-cache'),npm_config_offline:'true',npm_config_audit:'false',npm_config_fund:'false',npm_config_ignore_scripts:'true'};
const npmExecutable=process.env.NPM || 'npm';
const npm=(args,cwd)=>execFileSync(npmExecutable,args,{cwd,env,encoding:'utf8',maxBuffer:8*1024*1024});
const run=(args,cwd)=>execFileSync(process.execPath,args,{cwd,env,encoding:'utf8',maxBuffer:8*1024*1024});
try {
 let npmVersion;
 try {npmVersion=npm(['--version'],repo).trim();}
 catch {throw new Error('Astro candidate gate requires an available NPM executable; set NPM to an installed npm executable');}
 assert.match(npmVersion,/^\d+\.\d+\.\d+(?:[-+].+)?$/,'NPM must report a semantic version');
 const npmMajor=Number(npmVersion.split('.')[0]);assert.ok(Number.isSafeInteger(npmMajor) && npmMajor>0,'NPM major must be recorded');
 const packs=path.join(scratch,'packs');mkdirSync(packs);
 const packed=[];
 for(const directory of ['packages/publication-core','integrations/astro']){
   const [meta]=JSON.parse(npm(['pack','--json','--ignore-scripts','--pack-destination',packs],path.join(repo,directory)));
   const bytes=readFileSync(path.join(packs,meta.filename));
   assert.ok(!meta.files.some(row=>row.path.startsWith('test/') || row.path.startsWith('tools/')),'only runtime allowlist is packed');
   packed.push({directory,filename:meta.filename,version:meta.version,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),integrity:meta.integrity,files:meta.files.map(x=>x.path)});
 }
 const consumer=path.join(scratch,'consumer');mkdirSync(consumer);
 writeFileSync(path.join(consumer,'package.json'),JSON.stringify({private:true,type:'module'}));
 npm(['install','--offline','--ignore-scripts','--no-audit','--no-fund',...packed.map(x=>path.join(packs,x.filename))],consumer);
 cpSync(path.join(repo,'integrations/astro/test'),path.join(consumer,'test'),{recursive:true});
 const witness=JSON.parse(run(['--input-type=module','--eval',`
 import {realpathSync,readFileSync,lstatSync} from 'node:fs';
 import {fileURLToPath} from 'node:url';
 import path from 'node:path';
 import assert from 'node:assert/strict';
 import * as integration from '@zeroemployeeorg/astro-integration';
 const result={};
 for(const name of ['@zeroemployeeorg/astro-integration','@zeroemployeeorg/publication-core']) {
   const entry=fileURLToPath(import.meta.resolve(name));
   const physical=realpathSync(entry);
   assert.equal(entry,physical);assert.ok(physical.startsWith(path.join(process.cwd(),'node_modules')+path.sep));
   const root=path.dirname(entry);assert.equal(lstatSync(root).isSymbolicLink(),false);
   const manifest=JSON.parse(readFileSync(path.join(root,'package.json')));
   result[name]={entry,physical,version:manifest.version};
 }
 const declaration=readFileSync(path.join(path.dirname(fileURLToPath(import.meta.resolve('@zeroemployeeorg/astro-integration'))),'index.d.ts'),'utf8');
 const declared=[...declaration.matchAll(/^export declare (?:function|class|const) ([A-Za-z_$][\\w$]*)/gm)].map(x=>x[1]);
 assert.deepEqual(Object.keys(integration).sort(),declared.sort());
 console.log(JSON.stringify(result));`],consumer));
 const testFiles=readdirSync(path.join(consumer,'test')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'test/'+name);
 assert.ok(testFiles.length>0,'installed behavior tests required');
 const testLog=run(['--test',...testFiles],consumer);
 process.stdout.write(testLog);
 process.stdout.write(run(['--test','integrations/astro/tools/architecture.test.mjs'],repo));
 const missing=path.join(scratch,'missing-core');mkdirSync(path.join(missing,'node_modules/@zeroemployeeorg'),{recursive:true});
 cpSync(path.join(consumer,'node_modules/@zeroemployeeorg/astro-integration'),path.join(missing,'node_modules/@zeroemployeeorg/astro-integration'),{recursive:true});
 const absent=spawnSync(process.execPath,['--input-type=module','--eval',"await import('@zeroemployeeorg/astro-integration')"],{cwd:missing,env,encoding:'utf8'});
 assert.notEqual(absent.status,0);assert.match(absent.stderr,/ERR_MODULE_NOT_FOUND/);
 const missingCoreEvidence={control:'missing-core-import',exit:absent.status,errorCode:'ERR_MODULE_NOT_FOUND',stderr:absent.stderr,refused:true};
 console.log(JSON.stringify({schema:'zeocreator.astro-refusal/v1',...missingCoreEvidence}));
 const bad=path.join(scratch,'incompatible-core');mkdirSync(bad);writeFileSync(path.join(bad,'package.json'),JSON.stringify({name:'@zeroemployeeorg/publication-core',version:'0.0.0',type:'module',exports:'./index.mjs'}));
 writeFileSync(path.join(bad,'index.mjs'),'throw new Error("incompatible fixture must not execute");\n');
 const [badMeta]=JSON.parse(npm(['pack','--json','--ignore-scripts','--pack-destination',packs],bad));
 const incompatible=path.join(scratch,'incompatible-consumer');mkdirSync(incompatible);writeFileSync(path.join(incompatible,'package.json'),JSON.stringify({private:true,type:'module'}));
 const refused=spawnSync(npmExecutable,['install','--offline','--ignore-scripts','--no-audit','--no-fund',path.join(packs,badMeta.filename),path.join(packs,packed[1].filename)],{cwd:incompatible,env,encoding:'utf8'});
 assert.notEqual(refused.status,0,'incompatible core must refuse offline installation');
 assert.match(refused.stderr,/ENOTCACHED|ERESOLVE|ETARGET/,'refusal must come from dependency resolution');
 const incompatibleCoreEvidence={control:'incompatible-core-install',exit:refused.status,errorCode:refused.stderr.match(/ENOTCACHED|ERESOLVE|ETARGET/)[0],stderr:refused.stderr,refused:true};
 console.log(JSON.stringify({schema:'zeocreator.astro-refusal/v1',...incompatibleCoreEvidence}));
 const report={schema:'zeocreator.astro-candidate/v1',ok:true,scope:'local private candidate; not release/adoption',npm:{executable:npmExecutable,version:npmVersion,major:npmMajor},head:sourceHead,worktreeClean:sourceStatus.length===0,packed,witness,negativeEvidence:[missingCoreEvidence,incompatibleCoreEvidence],negativeControls:['missing core named import refused','incompatible core offline install refused'],declarationCheck:'export names only; no compiler/type soundness claim'};
 if(process.env.ZEO_ASTRO_GATE_OUTPUT)writeFileSync(process.env.ZEO_ASTRO_GATE_OUTPUT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
} finally {rmSync(scratch,{recursive:true,force:true});}

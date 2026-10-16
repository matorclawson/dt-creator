import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStaticPublicationObserver,createAstroPublicationIntegration,PublicationBuildError} from '@zeroemployeeorg/astro-integration';
const image='https://example.org/og.webp',hash='a'.repeat(64),reference='opaque-private-reference';
function setup(){
 const expected={canonical:'https://example.org/guide/',title:'Title',description:'Description',image,indexable:true};
 const elements=[{tag:'title',attrs:{},text:expected.title},{tag:'link',attrs:{rel:'canonical',href:expected.canonical}},...Object.entries({description:expected.description,'og:title':expected.title,'og:description':expected.description,'og:url':expected.canonical,'og:image':image,'twitter:title':expected.title,'twitter:description':expected.description,'twitter:image':image,'twitter:card':'summary_large_image'}).map(([key,value])=>({tag:'meta',attrs:{[key.startsWith('og:')?'property':'name']:key,content:value}}))];
 const context=Object.freeze({});const calls=[];
 const artifact={sha256:hash,decoded:true,width:1200,height:640,bytes:100,format:'webp',pixelSha256:'b'.repeat(64)};
 const options={manifest:{inventory:{evaluatedAt:1},pages:[{path:'/guide/',expected}]},headPlan:[{path:'/guide/',reference}],artifactGroups:[{id:'custom',policy:{origins:['https://example.org'],formats:['webp'],width:1200,height:640,maxBytes:100,uniquePixels:false},expected:[{url:image,sha256:hash,reference:reference+'-image'}]}],limits:{maxPages:1,maxArtifacts:1},
 attestCoverage:async(ctx,paths)=>{assert.equal(ctx,context);assert.ok(Object.isFrozen(paths));calls.push('coverage');return {complete:true,paths:[...paths]};},
 readHead:async(ctx,ref)=>{assert.equal(ctx,context);assert.equal(ref,reference);calls.push('head');return {elements};},
 readArtifact:async(ctx,ref)=>{assert.equal(ctx,context);assert.equal(ref,reference+'-image');calls.push('artifact');return artifact;}};
 return {options,context,calls,elements,artifact};
}
const typed=code=>error=>error instanceof PublicationBuildError && error.code===code && !String(error).includes(reference) && !('cause' in error);
test('complete source plan uses unchanged context, sequential ports and immutable observations',async()=>{
 const s=setup(),observer=createStaticPublicationObserver(s.options);
 const output=await observer(s.context);assert.deepEqual(s.calls,['coverage','head','artifact']);
 assert.equal(output.complete,true);assert.equal(output.heads[0].path,'/guide/');assert.equal(output.artifactGroups[0].observed[0].url,image);
 assert.ok(Object.isFrozen(output.heads[0].elements[0].attrs));assert.ok(Object.isFrozen(output.artifactGroups[0].policy.origins));
 assert.ok(!JSON.stringify(output).includes(reference));await observer(s.context);assert.deepEqual(s.calls,['coverage','head','artifact','coverage','head','artifact']);
});
test('construction snapshots plans, policies and selected ports before caller mutation',async()=>{
 const s=setup(),observer=createStaticPublicationObserver(s.options);
 s.options.headPlan[0].path='/changed/';s.options.headPlan[0].reference='changed';s.options.manifest.pages.length=0;
 s.options.artifactGroups[0].policy.height=1;s.options.artifactGroups[0].policy.origins.length=0;s.options.artifactGroups[0].expected[0].url='changed';
 s.options.readHead=()=>{throw Error('changed');};
 const out=await observer(s.context);assert.equal(out.heads[0].path,'/guide/');assert.equal(out.artifactGroups[0].policy.height,640);assert.equal(out.artifactGroups[0].expected[0].url,image);
});
for(const key of ['limits','attestCoverage','readHead','readArtifact'])test('mandatory '+key,()=>{
 const s=setup();delete s.options[key];assert.throws(()=>createStaticPublicationObserver(s.options),typed('invalid-observer-config'));assert.deepEqual(s.calls,[]);
});
for(const [label,mutate,code] of [
 ['page budget',s=>s.options.headPlan.push(s.options.headPlan[0]),'observer-limit'],
 ['artifact budget',s=>s.options.artifactGroups[0].expected.push(s.options.artifactGroups[0].expected[0]),'observer-limit'],
 ['zero limit',s=>s.options.limits.maxPages=0,'invalid-observer-config'],
 ['object reference',s=>s.options.headPlan[0].reference={},'invalid-observer-config'],
 ['missing head',s=>s.options.headPlan=[],'invalid-observer-config'],
 ['unsafe source path',s=>{s.options.manifest.pages[0].path='/../escape';s.options.headPlan[0].path='/../escape';},'invalid-observer-config'],
 ['duplicate manifest paths',s=>{s.options.limits.maxPages=2;s.options.manifest.pages.push(s.options.manifest.pages[0]);},'invalid-observer-config'],
 ['duplicate head path',s=>{s.options.limits.maxPages=2;s.options.headPlan.push(s.options.headPlan[0]);},'invalid-observer-config'],
 ['duplicate group',s=>{s.options.limits.maxArtifacts=2;s.options.artifactGroups.push(s.options.artifactGroups[0]);},'invalid-observer-config'],
 ['duplicate cross-group URL',s=>{s.options.limits.maxArtifacts=2;s.options.artifactGroups.push({...s.options.artifactGroups[0],id:'another'});},'invalid-observer-config'],
 ['sparse artifact plan',s=>s.options.artifactGroups[0].expected=new Array(1),'invalid-observer-config'],
])test('configuration refuses '+label+' before ports',()=>{
 const s=setup();mutate(s);assert.throws(()=>createStaticPublicationObserver(s.options),typed(code));assert.deepEqual(s.calls,[]);
});
for(const coverage of [{complete:false,paths:['/guide/']},{complete:true,paths:[]},{complete:true,paths:['/extra/']},{complete:true,paths:['/guide/','/guide/']},{complete:true,paths:['/guide/'],incomplete:true}])test('incomplete or inexact coverage refuses '+JSON.stringify(coverage),async()=>{
 const s=setup();s.options.attestCoverage=()=>coverage;
 await assert.rejects(createStaticPublicationObserver(s.options)(s.context),typed('observer-coverage'));assert.deepEqual(s.calls,[]);
});
for(const port of ['attestCoverage','readHead','readArtifact'])for(const asyncFailure of [false,true])test(port+' wraps '+(asyncFailure?'rejection':'throw')+' without content',async()=>{
 const s=setup();s.options[port]=asyncFailure?async()=>{throw Error(reference);}:()=>{throw Error(reference);};
 await assert.rejects(createStaticPublicationObserver(s.options)(s.context),typed('observer-port-failed'));
});
for(const [label,mutate] of [
 ['head identity',s=>s.options.readHead=()=>({path:'/guide/',elements:s.elements})],
 ['extra head field',s=>s.options.readHead=()=>({elements:s.elements,private:reference})],
 ['malformed head',s=>s.elements[0].attrs={title:42}],
 ['sparse head elements',s=>s.options.readHead=()=>({elements:new Array(1)})],
 ['matching asset identity',s=>s.artifact.url=image],
 ['mismatching asset identity',s=>s.artifact.url='https://elsewhere.org/'],
 ['asset path field',s=>s.artifact.path=reference],
 ['malformed decoded field',s=>s.artifact.decoded='true'],
])test('output refuses '+label,async()=>{
 const s=setup();mutate(s);await assert.rejects(createStaticPublicationObserver(s.options)(s.context),typed('invalid-observer-output'));
});
test('real hook accepts configured 640px profile and refuses title/hash faults through observer',async()=>{
 for(const fault of ['none','title','hash']){
  const s=setup();if(fault==='title')s.elements[0].text=reference;if(fault==='hash')s.artifact.sha256='c'.repeat(64);
  const reports=[];const hook=createAstroPublicationIntegration({manifest:s.options.manifest,observeBuild:createStaticPublicationObserver(s.options),headPolicy:{pageOrigin:'https://example.org',twitterCard:'summary_large_image'},onReport:report=>reports.push(report)}).hooks['astro:build:done'];
  if(fault==='none')await hook(s.context);else await assert.rejects(hook(s.context),typed('quality-refused'));
  assert.equal(reports[0].ok,fault==='none');assert.ok(!JSON.stringify(reports).includes(reference));
 }
});

test('artifact accessors refuse without executing changing values',async()=>{
 const s=setup();let reads=0;
 Object.defineProperty(s.artifact,'bytes',{enumerable:true,get(){return ++reads===1?100:'changed';}});
 await assert.rejects(createStaticPublicationObserver(s.options)(s.context),typed('invalid-observer-output'));
 assert.equal(reads,0);
});
test('descriptor snapshot cannot be replaced through a value get trap',async()=>{
 const s=setup();let reads=0;const source=s.artifact;
 s.options.readArtifact=()=>new Proxy(source,{get(target,key){if(key==='bytes'){reads++;return 'changed';}return Reflect.get(target,key);}});
 const out=await createStaticPublicationObserver(s.options)(s.context);
 assert.equal(out.artifactGroups[0].observed[0].bytes,100);assert.equal(reads,0);
});
test('unexpected artifact-group keys refuse before any port',()=>{
 const s=setup();s.options.artifactGroups[0].extra='ignored';
 assert.throws(()=>createStaticPublicationObserver(s.options),typed('invalid-observer-config'));assert.deepEqual(s.calls,[]);
});
test('head and coverage accessors refuse without exposing getter content',async()=>{
 for(const target of ['head','coverage']){
  const s=setup();let reads=0;const value={};
  Object.defineProperty(value,target==='head'?'elements':'complete',{enumerable:true,get(){reads++;throw Error(reference);}});
  if(target==='head')s.options.readHead=()=>value;else s.options.attestCoverage=()=>value;
  await assert.rejects(createStaticPublicationObserver(s.options)(s.context),typed(target==='head'?'invalid-observer-output':'observer-coverage'));assert.equal(reads,0);
 }
});

test('array accessors in source plans and policies refuse without invocation',()=>{
 for(const target of ['pages','headPlan','groups','expected','origins','formats']){
  const s=setup();let reads=0;const array=[];
  Object.defineProperty(array,'0',{enumerable:true,get(){reads++;throw Error(reference);}});
  if(target==='pages')s.options.manifest.pages=array;
  if(target==='headPlan')s.options.headPlan=array;
  if(target==='groups')s.options.artifactGroups=array;
  if(target==='expected')s.options.artifactGroups[0].expected=array;
  if(target==='origins')s.options.artifactGroups[0].policy.origins=array;
  if(target==='formats')s.options.artifactGroups[0].policy.formats=array;
  assert.throws(()=>createStaticPublicationObserver(s.options),typed('invalid-observer-config'));assert.equal(reads,0);assert.deepEqual(s.calls,[]);
 }
});
test('array accessors in coverage and head output refuse without invocation',async()=>{
 for(const target of ['coverage','elements']){
  const s=setup();let reads=0;const array=[];
  Object.defineProperty(array,'0',{enumerable:true,get(){reads++;throw Error(reference);}});
  if(target==='coverage')s.options.attestCoverage=()=>({complete:true,paths:array});else s.options.readHead=()=>({elements:array});
  await assert.rejects(createStaticPublicationObserver(s.options)(s.context),typed(target==='coverage'?'observer-coverage':'invalid-observer-output'));assert.equal(reads,0);
 }
});
test('array descriptor snapshots ignore live index and length get traps',async()=>{
 const s=setup();let reads=0;
 const wrap=array=>new Proxy(array,{get(target,key){if(key==='0' || key==='length'){reads++;throw Error(reference);}return Reflect.get(target,key);}});
 s.options.headPlan=wrap(s.options.headPlan);s.options.artifactGroups[0].policy.formats=wrap(['webp']);
 s.options.attestCoverage=()=>({complete:true,paths:wrap(['/guide/'])});s.options.readHead=()=>({elements:wrap(s.elements)});
 const output=await createStaticPublicationObserver(s.options)(s.context);assert.equal(output.heads[0].path,'/guide/');assert.equal(output.artifactGroups[0].policy.formats[0],'webp');assert.equal(reads,0);
});

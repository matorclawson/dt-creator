import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defineMetadataSchema} from '@zeroemployeeorg/publication-core';
import {createPublicationManifest,createAstroPublicationIntegration,PublicationBuildError} from '@zeroemployeeorg/astro-integration';
const hash='a'.repeat(64),pixel='b'.repeat(64),image='https://example.org/image.webp';
const manifest=()=>createPublicationManifest({site:{id:'example',origin:'https://example.org',trailingSlash:'always'},documents:[{id:'one',path:'/guide',kind:'lesson',status:'ready',access:'open',title:'Source title',summary:'Source description',availableAt:'2026-01-01T00:00:00Z'}],projection:{schema:defineMetadataSchema({kinds:['lesson'],statuses:['ready'],accessLevels:['open'],publishedStatus:'ready',publicAccess:'open',validateSource:()=>true}),now:Date.parse('2026-01-02T00:00:00Z'),selectPublication:()=>({})},describePage:entry=>({title:entry.title,description:entry.summary,image,indexable:true})});
function setup(){
 const source=manifest(),expected=source.pages[0].expected;
 const meta=(key,value)=>({tag:'meta',attrs:{[key.startsWith('og:')?'property':'name']:key,content:value}});
 const elements=[{tag:'title',attrs:{},text:expected.title},{tag:'link',attrs:{rel:'canonical',href:expected.canonical}},...Object.entries({'description':expected.description,'og:title':expected.title,'og:description':expected.description,'og:url':expected.canonical,'og:image':image,'twitter:title':expected.title,'twitter:description':expected.description,'twitter:image':image,'twitter:card':'summary_large_image'}).map(([key,value])=>meta(key,value))];
 const observed={complete:true,heads:[{path:'/guide/',elements}],artifactGroups:[{id:'explicit',expected:[{url:image,sha256:hash}],observed:[{url:image,sha256:hash,pixelSha256:pixel,decoded:true,format:'webp',width:1200,height:630,bytes:100}],policy:{origins:['https://example.org'],formats:['webp'],width:1200,height:630,maxBytes:100,uniquePixels:false}}]};
 const reports=[];const options={manifest:source,observeBuild:()=>observed,headPolicy:{pageOrigin:'https://example.org',twitterCard:'summary_large_image'},onReport:report=>reports.push(report)};
 return {observed,reports,options,hook:()=>createAstroPublicationIntegration(options).hooks['astro:build:done']};
}
const context=Object.freeze({dir:new URL('file:///unused/'),pages:[],assets:new Map(),logger:new Proxy({}, {get(){throw Error('logger must not be read');}})});
test('exact hook shape, unchanged context and deterministic report, no extra keys',async()=>{
 const s=setup();s.options.observeBuild=arg=>{assert.equal(arg,context);return s.observed;};const integration=createAstroPublicationIntegration(s.options);
 assert.deepEqual(Object.keys(integration),['name','hooks']);assert.deepEqual(Object.keys(integration.hooks),['astro:build:done']);
 await integration.hooks['astro:build:done'](context);await integration.hooks['astro:build:done'](context);
 assert.equal(s.reports[0].ok,true);assert.deepEqual(s.reports[0],s.reports[1]);assert.ok(Object.isFrozen(s.reports[0].findings));
});
test('caller configured dimensions are checked without a size default',async()=>{
 const s=setup();s.observed.artifactGroups[0].policy.height=640;s.observed.artifactGroups[0].observed[0].height=640;
 await s.hook()(context);assert.equal(s.reports[0].ok,true);
});
for(const [label,change,code] of [
 ['missing route',s=>s.observed.heads=[],'missing-route'],
 ['duplicate route',s=>s.observed.heads.push(s.observed.heads[0]),'duplicate-route'],
 ['extra route',s=>s.observed.heads.push({path:'/secret-observation/',elements:[]}),'unexpected-route'],
 ['changed artifact',s=>s.observed.artifactGroups[0].observed[0].sha256='c'.repeat(64),'artifact:hash-mismatch'],
 ['missing artifact',s=>s.observed.artifactGroups[0].observed=[],'artifact:missing-artifact'],
 ['failed decode',s=>s.observed.artifactGroups[0].observed[0].decoded=false,'artifact:decode-failed'],
 ['no audited image',s=>s.observed.artifactGroups=[],'unaudited-image'],
 ['wrong title',s=>s.observed.heads[0].elements[0].text='observed-private-body','head:mismatch'],
 ['wrong canonical',s=>s.observed.heads[0].elements[1].attrs.href='https://elsewhere.org/','head:mismatch'],
 ['wrong image',s=>s.observed.heads[0].elements.find(e=>e.attrs.property==='og:image').attrs.content='private-observed-image','head:mismatch'],
 ['unintended noindex',s=>s.observed.heads[0].elements.push({tag:'meta',attrs:{name:'robots',content:'noindex'}}),'head:indexability'],
])test(`build refuses ${label}`,async()=>{
 const s=setup();change(s);await assert.rejects(s.hook()(context),error=>error instanceof PublicationBuildError && error.code==='quality-refused');
 assert.equal(s.reports[0].ok,false);assert.ok(s.reports[0].findings.some(x=>x.code===code));
 assert.ok(!JSON.stringify(s.reports).includes('observed-private-body'));assert.ok(!JSON.stringify(s.reports).includes('/secret-observation/'));
});
test('incomplete SSR marker, absent complete marker and malformed observations fail closed',async()=>{
 for(const mutate of [s=>s.observed.incomplete=true,s=>delete s.observed.complete,s=>delete s.observed.heads]){
  const s=setup();mutate(s);await assert.rejects(s.hook()(context),PublicationBuildError);assert.equal(s.reports.length,0);
 }
});
test('duplicate group identifiers and cross-profile URLs refuse',async()=>{
 for(const id of ['explicit','another']){const s=setup();s.observed.artifactGroups.push({...s.observed.artifactGroups[0],id});await assert.rejects(s.hook()(context),error=>error instanceof PublicationBuildError && error.code==='invalid-observations');}
});
test('observer sync throws/async rejection and report rejection are wrapped without content',async()=>{
 for(const port of [()=>{throw Error('private observation');},async()=>{throw Error('private observation');}]){
  const s=setup();s.options.observeBuild=port;await assert.rejects(s.hook()(context),error=>error instanceof PublicationBuildError && error.code==='observation-failed' && !String(error).includes('private observation') && !('cause' in error));
 }
 const s=setup();s.options.onReport=async()=>{throw Error('private report');};await assert.rejects(s.hook()(context),error=>error instanceof PublicationBuildError && error.code==='report-failed' && !String(error).includes('private report'));
});
test('missing ports and incomplete source configuration refuse at construction',()=>{
 for(const key of ['observeBuild','onReport','manifest','headPolicy']){const s=setup();delete s.options[key];assert.throws(()=>createAstroPublicationIntegration(s.options),PublicationBuildError);}
});
test('an empty public manifest refuses before observation or reporting',()=>{
 const s=setup();let observed=false;
 s.options.manifest={...s.options.manifest,pages:[]};
 s.options.observeBuild=()=>{observed=true;return s.observed;};
 assert.throws(()=>createAstroPublicationIntegration(s.options),error=>error instanceof PublicationBuildError && error.code==='invalid-config');
 assert.equal(observed,false);assert.equal(s.reports.length,0);
});

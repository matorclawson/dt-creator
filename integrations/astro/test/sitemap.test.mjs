import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defineMetadataSchema} from '@zeroemployeeorg/publication-core';
import {createPublicationManifest,createPublicationSitemapEntries} from '@zeroemployeeorg/astro-integration';
const now=Date.parse('2026-01-10T00:00:00Z');
function manifest(){
 const doc=(id,status='ready',access='open',availableAt='2026-01-01T00:00:00Z')=>({id,path:'/'+id,kind:'lesson',status,access,title:'Title '+id,summary:'Summary '+id,availableAt});
 return createPublicationManifest({site:{id:'example',origin:'https://example.org',trailingSlash:'always'},documents:[doc('zeta'),doc('alpha'),doc('noindex'),doc('private','ready','members'),doc('draft','draft'),doc('unavailable','ready','open','2026-02-01T00:00:00Z'),doc('omitted')],projection:{schema:defineMetadataSchema({kinds:['lesson'],statuses:['ready','draft'],accessLevels:['open','members'],publishedStatus:'ready',publicAccess:'open',validateSource:()=>true}),now,selectPublication:entry=>entry.id==='omitted' || Date.parse(entry.availableAt)>now?null:{publishedAt:'2026-01-02T00:00:00Z',updatedAt:'2026-01-03T00:00:00Z'}},describePage:entry=>({title:entry.title,description:entry.summary,image:'https://example.org/og.webp',indexable:entry.id!=='noindex'})});
}
const policy=()=>({pageOrigin:'https://example.org',selectLastModified:()=>null});
const clone=()=>structuredClone(manifest());
test('real core projection excludes private/draft/unavailable/omitted, sitemap excludes noindex',()=>{
 const input=manifest(),calls=[];const rows=createPublicationSitemapEntries(input,{pageOrigin:'https://example.org',selectLastModified:(source,clock)=>{
  assert.equal(clock,now);assert.ok(Object.isFrozen(source) && Object.isFrozen(source.entry) && Object.isFrozen(source.page.expected));calls.push(source.entry.id);
  return source.entry.id==='alpha'?source.entry.updatedAt:null;
 }});
 assert.deepEqual(calls,['alpha','zeta']);assert.deepEqual(rows,[{url:'https://example.org/alpha/',lastModified:'2026-01-03T00:00:00Z'},{url:'https://example.org/zeta/'}]);
 assert.ok(Object.isFrozen(rows) && rows.every(Object.isFrozen));assert.ok(!JSON.stringify(rows).includes('Summary'));
});
test('timestamps never default even when source has publication and update instants',()=>{
 assert.ok(createPublicationSitemapEntries(manifest(),policy()).every(row=>!Object.hasOwn(row,'lastModified')));
});
test('ordering and result do not depend on source array order or mutations by callback',()=>{
 const input=clone();input.pages.reverse();input.inventory.entries.reverse();const seen=[];
 const rows=createPublicationSitemapEntries(input,{pageOrigin:'https://example.org',selectLastModified:source=>{
  seen.push(source.entry.id);input.pages.length=0;input.inventory.entries.length=0;return null;
 }});
 assert.deepEqual(seen,['alpha','zeta']);assert.deepEqual(rows.map(r=>r.url),['https://example.org/alpha/','https://example.org/zeta/']);
});
test('empty inventory and all-noindex inventory yield empty data without callbacks',()=>{
 const p={pageOrigin:'https://example.org',selectLastModified:()=>{throw Error('must not run');}};
 assert.deepEqual(createPublicationSitemapEntries({inventory:{evaluatedAt:now,entries:[]},pages:[]},p),[]);
 const input=clone();for(const page of input.pages)page.expected.indexable=false;assert.deepEqual(createPublicationSitemapEntries(input,p),[]);
});
for(const [label,mutate] of [
 ['missing join',m=>m.pages.pop()],
 ['wrong page ID',m=>m.pages[0].id='unknown'],
 ['duplicate page ID',m=>m.pages[1].id=m.pages[0].id],
 ['wrong path',m=>m.pages[0].path='/other/'],
 ['wrong canonical',m=>m.pages[0].expected.canonical='https://example.org/other/'],
 ['duplicate inventory ID',m=>m.inventory.entries[1].id=m.inventory.entries[0].id],
 ['duplicate canonical',m=>m.inventory.entries[1].canonicalUrl=m.inventory.entries[0].canonicalUrl],
 ['wrong origin',m=>m.inventory.entries[0].canonicalUrl='https://other.org/alpha/'],
 ['unsafe path',m=>m.inventory.entries[0].path='/../escape/'],
 ['nonboolean indexability',m=>m.pages[0].expected.indexable='true'],
 ['invalid clock',m=>m.inventory.evaluatedAt=NaN],
 ['future source availability',m=>m.inventory.entries[0].availableAt='2027-01-01T00:00:00Z'],
 ['sparse pages',m=>delete m.pages[0]],
 ['extra manifest key',m=>m.extra=true],
])test('refuses '+label+' before every callback',()=>{
 const input=clone();let calls=0;mutate(input);
 assert.throws(()=>createPublicationSitemapEntries(input,{pageOrigin:'https://example.org',selectLastModified:()=>{calls++;return null;}}),TypeError);assert.equal(calls,0);
});
for(const value of [undefined,'2026-01-01','2026-01-01T00:00:00+00:00','2026-01-32T00:00:00Z','2027-01-01T00:00:00Z',42,{then(){throw Error('then must not run');}}])test('refuses invalid explicit date '+String(value),()=>{
 assert.throws(()=>createPublicationSitemapEntries(manifest(),{pageOrigin:'https://example.org',selectLastModified:()=>value}),TypeError);
});
test('callback errors have content-free errors and async functions refuse before execution',()=>{
 let calls=0;assert.throws(()=>createPublicationSitemapEntries(manifest(),{pageOrigin:'https://example.org',selectLastModified:async()=>{calls++;throw Error('private callback');}}),TypeError);assert.equal(calls,0);
 assert.throws(()=>createPublicationSitemapEntries(manifest(),{pageOrigin:'https://example.org',selectLastModified:()=>{throw Error('private callback');}}),error=>error instanceof TypeError && !String(error).includes('private callback') && !('cause' in error));
});
test('mandatory explicit policy and own-data snapshots refuse getters without invoking them',()=>{
 assert.throws(()=>createPublicationSitemapEntries(manifest(),{pageOrigin:'https://example.org'}),TypeError);
 assert.throws(()=>createPublicationSitemapEntries(manifest(),{pageOrigin:'http://example.org',selectLastModified:()=>null}),TypeError);
 for(const target of ['record','array']){
  const input=clone();let calls=0;
  Object.defineProperty(target==='record'?input.pages[0]:input.pages,target==='record'?'id':'0',{enumerable:true,get(){calls++;throw Error('private getter');}});
  assert.throws(()=>createPublicationSitemapEntries(input,policy()),TypeError);assert.equal(calls,0);
 }
});

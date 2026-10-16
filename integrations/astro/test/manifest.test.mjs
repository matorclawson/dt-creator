import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defineMetadataSchema} from '@zeroemployeeorg/publication-core';
import {createPublicationManifest} from '@zeroemployeeorg/astro-integration';
const now=Date.parse('2026-01-02T00:00:00Z');
const site={id:'example',origin:'https://example.org',trailingSlash:'always'};
const source={id:'one',kind:'lesson',status:'ready',access:'open',path:'/guide',title:'Source title',summary:'Source summary',availableAt:'2026-01-01T00:00:00Z'};
const schema=()=>defineMetadataSchema({kinds:['lesson'],statuses:['ready','held'],accessLevels:['open','members'],publishedStatus:'ready',publicAccess:'open',validateSource:()=>true});
const input=(documents=[source],extra={})=>({site,documents,projection:{schema:schema(),now,selectPublication:(entry,time)=>Date.parse(entry.availableAt)<=time?{}:null},describePage:entry=>({title:entry.title+' · Example',description:entry.summary,image:'https://images.example.org/guide.webp',indexable:true}),...extra});
test('actual named core projection supplies canonical and immutable source head expectations',()=>{
 const result=createPublicationManifest(input());
 assert.equal(result.inventory.evaluatedAt,now);assert.equal(result.pages[0].expected.canonical,'https://example.org/guide/');
 assert.equal(result.pages[0].expected.title,'Source title · Example');assert.equal(result.pages[0].expected.description,'Source summary');
 assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.pages));assert.ok(Object.isFrozen(result.pages[0].expected));
});
test('slash convention is delegated to the installed core',()=>{
 assert.equal(createPublicationManifest(input([source],{site:{...site,trailingSlash:'never'}})).pages[0].expected.canonical,'https://example.org/guide');
});
test('held, private and future items never receive page callbacks',()=>{
 const docs=[source,{...source,id:'held',path:'/held',status:'held'},{...source,id:'private',path:'/private',access:'members'},{...source,id:'future',path:'/future',availableAt:'2027-01-01T00:00:00Z'}];
 let calls=0;const args=input(docs);const describe=args.describePage;args.describePage=entry=>{calls++;return describe(entry);};
 assert.equal(createPublicationManifest(args).pages.length,1);assert.equal(calls,1);
});
test('hidden duplicate routes fail before head expectations can be produced',()=>{
 const args=input([source,{...source,id:'hidden',status:'held'}]);let called=false;args.describePage=()=>{called=true;return {};};
 assert.throws(()=>createPublicationManifest(args),TypeError);assert.equal(called,false);
});
test('invalid hidden metadata and source validation cannot disappear',()=>{
 assert.throws(()=>createPublicationManifest(input([source,{...source,id:'hidden',path:'/hidden',status:'held',title:''}])),TypeError);
 const args=input();args.projection.schema=defineMetadataSchema({kinds:['lesson'],statuses:['ready'],accessLevels:['open'],publishedStatus:'ready',publicAccess:'open',validateSource:()=>false});
 assert.throws(()=>createPublicationManifest(args),TypeError);
});
test('no implicit evaluation clock, callback, image or indexability',()=>{
 const args=input();delete args.projection.now;assert.throws(()=>createPublicationManifest(args),TypeError);
 assert.throws(()=>createPublicationManifest({...input(),describePage:undefined}),TypeError);
 for(const changed of [{title:''},{description:' '},{image:'http://example.org/a.webp'},{indexable:undefined}]){
   const original=input().describePage;assert.throws(()=>createPublicationManifest({...input(),describePage:entry=>({...original(entry),...changed})}),TypeError);
 }
});
test('source expectations cannot override canonical identity through callback fields',()=>{
 const original=input().describePage;const result=createPublicationManifest({...input(),describePage:entry=>({...original(entry),canonical:'https://other.example/'})});
 assert.equal(result.pages[0].expected.canonical,'https://example.org/guide/');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditPageHead as audit} from '@zeroemployeeorg/astro-integration';
const expected = {canonical:'https://example.org/guide/',title:'A & B',description:'A technical guide.',image:'https://cdn.example.org/guide.webp',indexable:true};
const policy = {pageOrigin:'https://example.org',imageUrls:[expected.image],twitterCard:'summary_large_image'};
const meta = (key,content) => ({tag:'meta',attrs:{[key.startsWith('og:')?'property':'name']:key,content}});
const elements = [
 {tag:'title',attrs:{},text:expected.title},{tag:'link',attrs:{rel:'canonical',href:expected.canonical}},
 ...Object.entries({'description':expected.description,'og:title':expected.title,'og:description':expected.description,'og:url':expected.canonical,'og:image':expected.image,'twitter:title':expected.title,'twitter:description':expected.description,'twitter:image':expected.image,'twitter:card':policy.twitterCard}).map(([key,value])=>meta(key,value)),
];
test('accepts explicit source expectations and leaves inputs unchanged',()=>{
 const before=JSON.stringify({elements,expected,policy}); assert.deepEqual(audit(elements,expected,policy),[]);assert.equal(JSON.stringify({elements,expected,policy}),before);
});
for (const [i,e] of elements.entries()) {
 const field = e.tag === 'meta' ? e.attrs.name || e.attrs.property : e.tag;
 test(`requires exactly one ${field}`,()=>{
   assert.ok(audit(elements.filter((_,n)=>n!==i),expected,policy).some(x=>x.code==='missing'));
   assert.ok(audit([...elements,e],expected,policy).some(x=>x.code==='duplicate'));
 });
 test(`checks ${field} against independent expectation`,()=>{
   const changed=structuredClone(elements);
   if(e.tag==='title')changed[i].text='Different';
   else changed[i].attrs[e.tag==='link'?'href':'content']='Different';
   assert.ok(audit(changed,expected,policy).some(x=>x.code==='mismatch'));
 });
}
test('empty values fail and canonical rel tokens are recognized',()=>{
 assert.ok(audit([{tag:'title',attrs:{},text:' '},...elements.slice(1)],expected,policy).some(x=>x.code==='empty'));
 const changed=structuredClone(elements);changed[1].attrs.rel='alternate CANONICAL';assert.deepEqual(audit(changed,expected,policy),[]);
});
test('indexability follows explicit source intent including none directive',()=>{
 for(const value of ['NOINDEX,follow','none']){
   const head=[...elements,meta('robots',value)];
   assert.ok(audit(head,expected,policy).some(x=>x.code==='indexability'));
   assert.deepEqual(audit(head,{...expected,indexable:false},policy),[]);
 }
 assert.ok(audit(elements,{...expected,indexable:false},policy).some(x=>x.code==='indexability'));
 assert.ok(audit([...elements,meta('robots','index,noindex')],expected,policy).some(x=>x.code==='conflicting'));
 assert.ok(audit([...elements,meta('robots',''),meta('robots','all')],expected,policy).some(x=>x.code==='duplicate'));
});
test('configuration refuses missing source expectations and unknown images',()=>{
 assert.throws(()=>audit(elements,{},policy),TypeError);
 assert.throws(()=>audit(elements,expected,{...policy,imageUrls:[]}),TypeError);
 assert.throws(()=>audit(elements,{...expected,canonical:'https://wrong.org/'},policy),TypeError);
});
test('Open Graph properties cannot be substituted with name attributes',()=>{
 const changed=structuredClone(elements);const row=changed.find(e=>e.attrs.property==='og:title');row.attrs.name=row.attrs.property;delete row.attrs.property;
 assert.ok(audit(changed,expected,policy).some(x=>x.field==='og:title' && x.code==='missing'));
});

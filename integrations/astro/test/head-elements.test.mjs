import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPublicationHeadElements,auditPageHead} from '@zeroemployeeorg/astro-integration';
const title='  Café 漢字 &amp; </title><script data-test="x">x</script>  ';
const source=()=>({canonical:'https://example.org/guide/',title,description:'"quoted" <b>description</b> & entities &#38; 🧪',image:'https://example.org/og.webp',indexable:true});
const auditPolicy=expected=>({pageOrigin:'https://example.org',imageUrls:[expected.image],twitterCard:'summary_large_image'});
for(const [indexable,robots] of [[true,'index, follow'],[false,'noindex, follow'],[false,'NONE']])test('every produced head audits against independent expectation: '+robots,()=>{
 const expected={...source(),indexable};const elements=createPublicationHeadElements(expected,{twitterCard:'summary_large_image',robots});
 assert.deepEqual(auditPageHead(elements,expected,auditPolicy(expected)),[]);
 assert.ok(Object.isFrozen(elements));assert.ok(elements.every(e=>Object.isFrozen(e) && Object.isFrozen(e.attrs)));
 for(const [index,element] of elements.entries()) {
   if(element.attrs.name==='robots' && indexable)continue;
   assert.ok(auditPageHead(elements.filter((_,i)=>i!==index),expected,auditPolicy(expected)).length>0,'audit must require '+(element.attrs.name||element.attrs.property||element.tag));
 }
});
test('Unicode and markup-looking editorial text stays exact data, not escaped or trimmed',()=>{
 const expected=source();const elements=createPublicationHeadElements(expected,{twitterCard:'summary_large_image',robots:'index'});
 assert.equal(elements.find(e=>e.tag==='title').text,title);
 for(const key of ['og:title','twitter:title'])assert.equal(elements.find(e=>e.attrs.property===key || e.attrs.name===key).attrs.content,title);
 for(const key of ['description','og:description','twitter:description'])assert.equal(elements.find(e=>e.attrs.property===key || e.attrs.name===key).attrs.content,expected.description);
 expected.title='changed';assert.equal(elements.find(e=>e.tag==='title').text,title);
});
for(const [field,value] of [['title',''],['description',' '],['title','\ud800'],['title',['text']],['description',null],['indexable','true'],['canonical','http://example.org/'],['canonical','https://example.org/?'],['canonical','https://example.org/#'],['image','http://example.org/og.webp'],['image','https://user@example.org/og.webp']])test('rejects invalid source '+field+' '+JSON.stringify(value),()=>{
 assert.throws(()=>createPublicationHeadElements({...source(),[field]:value},{twitterCard:'summary_large_image',robots:'index'}),TypeError);
});
for(const policy of [{robots:'index'},{twitterCard:'summary_large_image'},{twitterCard:'',robots:'index'},{twitterCard:'\ud800',robots:'index'},{twitterCard:['summary'],robots:'index'},{twitterCard:'summary',robots:['index']},{twitterCard:'summary',robots:'noindex'},{twitterCard:'summary',robots:'index,noindex'},{twitterCard:'summary',robots:'none'}])test('requires explicit compatible card/robots '+JSON.stringify(policy),()=>{
 assert.throws(()=>createPublicationHeadElements(source(),policy),TypeError);
});
test('non-indexable source refuses indexable robots; actual wrong layout metadata still fails',()=>{
 const expected={...source(),indexable:false};
 assert.throws(()=>createPublicationHeadElements(expected,{twitterCard:'summary',robots:'index'}),TypeError);
 const elements=createPublicationHeadElements(expected,{twitterCard:'summary_large_image',robots:'noindex'});
 const changed=elements.map(e=>e.tag==='title'?{...e,text:'layout override'}:e);
 assert.ok(auditPageHead(changed,expected,auditPolicy(expected)).some(e=>e.code==='mismatch' && e.field==='title'));
 const withoutNoindex=elements.filter(e=>e.attrs.name!=='robots');assert.ok(auditPageHead(withoutNoindex,expected,auditPolicy(expected)).some(e=>e.code==='indexability'));
});
test('descriptor inputs reject accessors and extra keys without invoking getters',()=>{
 for(const target of ['source','policy']){
   let reads=0;const expected=source(),policy={twitterCard:'summary_large_image',robots:'index'};
   Object.defineProperty(target==='source'?expected:policy,target==='source'?'title':'robots',{enumerable:true,get(){reads++;throw Error('private getter');}});
   assert.throws(()=>createPublicationHeadElements(expected,policy),error=>error instanceof TypeError && !String(error).includes('private getter'));assert.equal(reads,0);
 }
 assert.throws(()=>createPublicationHeadElements({...source(),extra:true},{twitterCard:'summary',robots:'index'}),TypeError);
});

for(const field of ['canonical','image'])for(const value of [' https://example.org/a','https://example.org/a b','https://example.org/a\tb','https://example.org/a\nb','https://example.org/a\\b','https://example.org/a"b','https://example.org/a<b','https://example.org/a%ZZ','https://example.org/ab'])test('raw URL refuses '+field+' '+JSON.stringify(value),()=>{
 assert.throws(()=>createPublicationHeadElements({...source(),[field]:value},{twitterCard:'summary_large_image',robots:'index'}),TypeError);
});
test('already serialized encoded URLs and query values remain exact',()=>{
 const expected={...source(),canonical:'https://example.org/%E6%BC%A2%E5%AD%97/',image:'https://cdn.example.org/image.webp?size=1200&format=webp'};
 const elements=createPublicationHeadElements(expected,{twitterCard:'summary_large_image',robots:'index'});
 assert.deepEqual(auditPageHead(elements,expected,auditPolicy(expected)),[]);
 assert.equal(elements.find(e=>e.tag==='link').attrs.href,expected.canonical);
 assert.equal(elements.find(e=>e.attrs.property==='og:image').attrs.content,expected.image);
});

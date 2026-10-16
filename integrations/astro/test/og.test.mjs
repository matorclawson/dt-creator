import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditOgArtifacts as audit} from '@zeroemployeeorg/astro-integration';
const url = 'https://example.org/og/example.webp';
const expected = [{url, sha256: 'a'.repeat(64)}];
const image = {url, sha256: 'a'.repeat(64), decoded:true, pixelSha256:'b'.repeat(64), format:'webp', width:1200, height:630, bytes:100};
const policy = {origins:['https://example.org'], formats:['webp'],width:1200,height:630,maxBytes:100,uniquePixels:true};
test('accepts boundary budget and leaves inputs unchanged', () => {
  const before = JSON.stringify({expected,image,policy});
  assert.deepEqual(audit(expected,[image],policy), []);
  assert.equal(JSON.stringify({expected,image,policy}),before);
});
for (const [code, patch] of [
  ['hash-mismatch',{sha256:'c'.repeat(64)}], ['decode-failed',{decoded:false}],
  ['decode-failed',{pixelSha256:'invalid'}], ['wrong-format',{format:'png'}],
  ['wrong-dimensions',{height:629}], ['byte-budget',{bytes:101}],
  ['byte-budget',{bytes:0}], ['byte-budget',{bytes:NaN}],
]) test(`rejects ${code} ${JSON.stringify(patch)}`, () => assert.ok(audit(expected,[{...image,...patch}],policy).some(x => x.code === code)));
test('rejects missing and extra artifacts', () => {
  assert.equal(audit(expected,[],policy)[0].code,'missing-artifact');
  assert.ok(audit(expected,[image,{...image,url:url+'x'}],policy).some(x=>x.code==='unexpected-artifact'));
});
test('rejects duplicate target, observation and optionally artwork', () => {
  assert.ok(audit([...expected,...expected],[image],policy).some(x=>x.code==='duplicate-target'));
  assert.ok(audit(expected,[image,image],policy).some(x=>x.code==='duplicate-observation'));
  const second = {...expected[0],url:'https://example.org/og/second.webp'};
  const observations = [image,{...image,url:second.url}];
  assert.ok(audit([...expected,second],observations,policy).some(x=>x.code==='duplicate-pixels'));
  assert.deepEqual(audit([...expected,second],observations,{...policy,uniquePixels:false}),[]);
});
for (const bad of ['http://example.org/a.webp','https://elsewhere.org/a.webp','https://user@example.org/a.webp',url+'?v=1',url+'#x','broken'])
  test(`rejects URL ${bad}`,()=>assert.ok(audit([{...expected[0],url:bad}],[],policy).some(x=>x.code==='invalid-url')));
test('requires explicit complete policy and trustworthy expected hash',()=>{
  for (const bad of [{}, {...policy,maxBytes:0},{...policy,origins:['http://example.org']},{...policy,uniquePixels:undefined}]) assert.throws(()=>audit(expected,[image],bad),TypeError);
  assert.throws(()=>audit([{url,sha256:'bad'}],[image],policy),TypeError);
});

test('rejects malformed format policies even when observations match them',()=>{
 for (const formats of [[null],[''],[' '],[42],[]]) assert.throws(()=>audit(expected,[{...image,format:formats[0]}],{...policy,formats}),TypeError);
});

test('rejects empty query and fragment delimiters',()=>{
 for(const suffix of ['?','#']) assert.ok(audit([{...expected[0],url:url+suffix}],[],policy).some(x=>x.code==='invalid-url'));
});
test('hashes require primitive strings rather than regex-coercible arrays',()=>{
 assert.throws(()=>audit([{url,sha256:['a'.repeat(64)]}],[image],policy),TypeError);
 assert.ok(audit(expected,[{...image,sha256:['a'.repeat(64)]}],policy).some(x=>x.code==='hash-mismatch'));
 assert.ok(audit(expected,[{...image,pixelSha256:['b'.repeat(64)]}],policy).some(x=>x.code==='decode-failed'));
});

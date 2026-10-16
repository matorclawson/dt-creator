// Pure contract over normalized HTML head observations. No parsing or site defaults.
import {headFields,robotsState} from './head-fields.mjs';
export function auditPageHead(elements, expected, policy) {
  const textKeys = ['canonical','title','description','image'];
  if (!Array.isArray(elements) || !expected || !textKeys.every(k => typeof expected[k] === 'string' && expected[k].trim()) ||
      typeof expected.indexable !== 'boolean' || !Array.isArray(policy?.imageUrls) ||
      typeof policy.twitterCard !== 'string' || !policy.twitterCard.trim()) throw new TypeError('Explicit head expectations and policy required');
  const origin = new URL(policy.pageOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== policy.pageOrigin) throw new TypeError('HTTPS page origin required');
  const canonical = new URL(expected.canonical);
  const image = new URL(expected.image);
  if (canonical.protocol !== 'https:' || canonical.origin !== policy.pageOrigin || canonical.username || canonical.password || canonical.search || canonical.hash ||
      image.protocol !== 'https:' || image.username || image.password || !policy.imageUrls.includes(expected.image)) throw new TypeError('Expected canonical/image must satisfy explicit inventory policy');
  for (const e of elements) if (!e || typeof e.tag !== 'string' || !e.attrs || typeof e.attrs !== 'object') throw new TypeError('Normalized elements required');
  const findings = [];
  const add = (code,field) => findings.push({code,field});
  const meta = key => elements.filter(e=>e.tag === 'meta' && e.attrs[key.startsWith('og:') ? 'property' : 'name']?.toLowerCase() === key).map(e=>e.attrs.content);
  const one = (field,values,wanted) => {
    if (!values.length) { add('missing',field); return; }
    if (values.length !== 1) add('duplicate',field);
    for (const value of values) if (typeof value !== 'string' || !value.trim()) add('empty',field);
    else if (value !== wanted) add('mismatch',field);
  };
  for(const shape of headFields) {
    const values=shape.tag==='title'?elements.filter(e=>e.tag==='title').map(e=>e.text):
      shape.tag==='link'?elements.filter(e=>e.tag==='link' && e.attrs.rel?.toLowerCase().split(/\s+/).includes('canonical')).map(e=>e.attrs.href):meta(shape.field);
    one(shape.field,values,shape.source==='twitterCard'?policy.twitterCard:expected[shape.source]);
  }
  const robots = meta('robots');
  if (robots.length > 1) add('duplicate','robots');
  if (robots.some(value=>typeof value !== 'string' || !value.trim())) add('empty','robots');
  const {blocked,conflicting}=robotsState(robots);
  if (blocked === expected.indexable) add('indexability','robots');
  if (conflicting) add('conflicting','robots');
  return findings;
}

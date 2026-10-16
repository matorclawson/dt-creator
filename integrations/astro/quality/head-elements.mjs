import {headFields,robotsState} from './head-fields.mjs';

const invalid=()=>{throw new TypeError('Explicit valid source head metadata and policy required');};
const snapshot=(input,fields)=>{
  if(!input || typeof input!=='object' || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) invalid();
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(descriptors).length!==fields.length) invalid();
  const result={};
  for(const field of fields) {
    const descriptor=descriptors[field];
    if(!descriptor || !Object.hasOwn(descriptor,'value')) invalid();
    result[field]=descriptor.value;
  }
  return result;
};
const text=value=>typeof value==='string' && value.trim().length>0 && value.isWellFormed();

export function createPublicationHeadElements(expectedInput,policyInput) {
  try {
    const expected=snapshot(expectedInput,['canonical','title','description','image','indexable']);
    const policy=snapshot(policyInput,['twitterCard','robots']);
    if(!['canonical','title','description','image'].every(key=>text(expected[key])) || typeof expected.indexable!=='boolean' || !text(policy.twitterCard) || !text(policy.robots)) invalid();
    for(const field of ['canonical','image']) {
      const url=new URL(expected[field]);
      if(url.protocol!=='https:' || url.username || url.password || (field==='canonical' && /[?#]/.test(expected[field]))) invalid();
    }
    const robots=robotsState([policy.robots]);
    if(robots.blocked===expected.indexable || robots.conflicting) invalid();
    const elements=headFields.map(shape=>{
      const value=shape.source==='twitterCard'?policy.twitterCard:expected[shape.source];
      return Object.freeze({tag:shape.tag,attrs:Object.freeze({...shape.attrs,...(shape.valueAttr?{[shape.valueAttr]:value}:{})}),...(!shape.valueAttr?{text:value}:{})});
    });
    elements.push(Object.freeze({tag:'meta',attrs:Object.freeze({name:'robots',content:policy.robots})}));
    return Object.freeze(elements);
  } catch {invalid();}
}

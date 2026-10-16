import {utcInstant} from '@zeroemployeeorg/publication-core';

const invalid=()=>{throw new TypeError('Explicit valid source sitemap metadata and policy required');};
const record=(value,allowed,required=allowed)=>{
  if(!value || typeof value!=='object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) invalid();
  const descriptors=Object.getOwnPropertyDescriptors(value),entries=[];
  for(const key of Reflect.ownKeys(descriptors)) {
    const descriptor=descriptors[key];
    if(!allowed.includes(key) || !Object.hasOwn(descriptor,'value')) invalid();
    entries.push([key,descriptor.value]);
  }
  if(required.some(key=>!Object.hasOwn(descriptors,key))) invalid();
  return Object.fromEntries(entries);
};
const array=value=>{
  if(!Array.isArray(value)) invalid();
  const descriptors=Object.getOwnPropertyDescriptors(value),length=descriptors.length?.value;
  if(!Number.isSafeInteger(length) || length<0 || Reflect.ownKeys(descriptors).length!==length+1) invalid();
  const copy=[];
  for(let i=0;i<length;i++) {
    const descriptor=descriptors[i];
    if(!descriptor || !Object.hasOwn(descriptor,'value')) invalid();
    copy.push(descriptor.value);
  }
  return copy;
};
const text=value=>typeof value==='string' && value.trim().length>0 && value.isWellFormed();
const entryFields=['id','kind','path','title','summary','canonicalUrl','availableAt','publishedAt','updatedAt'];
const pageFields=['canonical','title','description','image','indexable'];

export function createPublicationSitemapEntries(manifestInput,policyInput) {
  try {
    const policy=record(policyInput,['pageOrigin','selectLastModified']);
    const origin=new URL(policy.pageOrigin);
    if(typeof policy.pageOrigin!=='string' || origin.protocol!=='https:' || origin.origin!==policy.pageOrigin || typeof policy.selectLastModified!=='function' || Object.getPrototypeOf(policy.selectLastModified)!==Function.prototype) invalid();
    const manifest=record(manifestInput,['inventory','pages']);
    const inventory=record(manifest.inventory,['evaluatedAt','entries']);
    if(typeof inventory.evaluatedAt!=='number' || !Number.isFinite(inventory.evaluatedAt) || !Number.isFinite(new Date(inventory.evaluatedAt).getTime())) invalid();
    const entries=array(inventory.entries),pages=array(manifest.pages);
    if(entries.length!==pages.length) invalid();
    const ids=new Map(),paths=new Set(),urls=new Set();
    const canonical=(path,url)=>{
      if(!text(path) || !/^\/[A-Za-z0-9._~/-]*$/.test(path) || path.includes('//') || path.split('/').some(part=>part==='.' || part==='..') || !text(url) || new URL(path,origin).href!==url) invalid();
    };
    for(const raw of entries) {
      const entry=record(raw,entryFields,entryFields.slice(0,7));
      if(!entryFields.slice(0,7).every(key=>text(entry[key])) || ids.has(entry.id) || paths.has(entry.path.toLowerCase()) || urls.has(entry.canonicalUrl)) invalid();
      canonical(entry.path,entry.canonicalUrl);
      const available=Date.parse(utcInstant(entry.availableAt));
      if(available>inventory.evaluatedAt) invalid();
      if(entry.publishedAt!==undefined && Date.parse(utcInstant(entry.publishedAt))>inventory.evaluatedAt) invalid();
      if(entry.updatedAt!==undefined) {
        const updated=Date.parse(utcInstant(entry.updatedAt));
        if(updated<available || updated>inventory.evaluatedAt || (entry.publishedAt!==undefined && updated<Date.parse(entry.publishedAt))) invalid();
      }
      ids.set(entry.id,Object.freeze(entry));paths.add(entry.path.toLowerCase());urls.add(entry.canonicalUrl);
    }
    const joined=[],seen=new Set();
    for(const raw of pages) {
      const page=record(raw,['id','path','expected']);
      const expected=record(page.expected,pageFields);
      if(!text(page.id) || seen.has(page.id) || !pageFields.slice(0,4).every(key=>text(expected[key])) || typeof expected.indexable!=='boolean') invalid();
      const entry=ids.get(page.id);
      if(!entry || entry.path!==page.path || entry.canonicalUrl!==expected.canonical) invalid();
      canonical(page.path,expected.canonical);seen.add(page.id);
      joined.push(Object.freeze({entry,page:Object.freeze({...page,expected:Object.freeze(expected)})}));
    }
    joined.sort((a,b)=>a.entry.canonicalUrl<b.entry.canonicalUrl?-1:a.entry.canonicalUrl>b.entry.canonicalUrl?1:0);
    const rows=[];
    for(const item of joined) {
      if(!item.page.expected.indexable) continue;
      const date=policy.selectLastModified(item,inventory.evaluatedAt);
      if(date!==null && (typeof date!=='string' || Date.parse(utcInstant(date))>inventory.evaluatedAt)) invalid();
      rows.push(Object.freeze({url:item.entry.canonicalUrl,...(date===null?{}:{lastModified:date})}));
    }
    return Object.freeze(rows);
  } catch {invalid();}
}

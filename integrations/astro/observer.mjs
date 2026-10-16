import {PublicationBuildError} from './hook.mjs';

const refuse=code=>{throw new PublicationBuildError(code);};
const record=value=>value!==null && typeof value==='object' && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const string=value=>typeof value==='string' && value.trim().length>0 && value.isWellFormed();
const keys=(value,allowed)=>record(value) && Reflect.ownKeys(value).every(key=>allowed.includes(key));
const list=value=>Array.isArray(value) && Array.from(value).every((_,index)=>Object.hasOwn(value,index));
const positive=value=>Number.isSafeInteger(value) && value>0;
const route=value=>string(value) && value.startsWith('/') && !value.startsWith('//') && !/[?#\\\u0000-\u0020\u007f]/.test(value) && !/%(?:2f|5c)/i.test(value) && new URL(value,'https://example.invalid').pathname===value;
const freezeArray=values=>Object.freeze(values);

export function createStaticPublicationObserver(options) {
  let plan,groups,attestCoverage,readHead,readArtifact,paths;
  try {
    ({attestCoverage,readHead,readArtifact}=options);
    if(![attestCoverage,readHead,readArtifact].every(port=>typeof port==='function')) refuse('invalid-observer-config');
    const {manifest,headPlan,artifactGroups,limits}=options;
    if(!record(limits) || !positive(limits.maxPages) || !positive(limits.maxArtifacts)) refuse('invalid-observer-config');
    if(!list(manifest?.pages) || !manifest.pages.length || !list(headPlan) || !list(artifactGroups)) refuse('invalid-observer-config');
    if(manifest.pages.length>limits.maxPages || headPlan.length>limits.maxPages) refuse('observer-limit');
    paths=freezeArray(manifest.pages.map(page=>{if(!route(page?.path)) refuse('invalid-observer-config');return page.path;}));
    const known=new Set(paths),seen=new Set();
    if(known.size!==paths.length) refuse('invalid-observer-config');
    plan=freezeArray(headPlan.map(row=>{
      if(!keys(row,['path','reference']) || !known.has(row.path) || seen.has(row.path) || !string(row.reference)) refuse('invalid-observer-config');
      seen.add(row.path);return Object.freeze({path:row.path,reference:row.reference});
    }));
    if(seen.size!==known.size) refuse('invalid-observer-config');
    const ids=new Set(),urls=new Set();let count=0;
    groups=freezeArray(artifactGroups.map(group=>{
      if(!record(group) || !string(group.id) || ids.has(group.id) || !list(group.expected) || !group.expected.length) refuse('invalid-observer-config');
      ids.add(group.id);count+=group.expected.length;
      if(count>limits.maxArtifacts) refuse('observer-limit');
      const policy=group.policy;
      if(!keys(policy,['origins','formats','width','height','maxBytes','uniquePixels']) || !list(policy.origins) || !policy.origins.length || !list(policy.formats) || !policy.formats.length || !policy.formats.every(string) || ![policy.width,policy.height,policy.maxBytes].every(positive) || typeof policy.uniquePixels!=='boolean') refuse('invalid-observer-config');
      const origins=policy.origins.map(origin=>{const url=new URL(origin);if(url.protocol!=='https:' || url.origin!==origin) refuse('invalid-observer-config');return origin;});
      const expected=freezeArray(group.expected.map(row=>{
        if(!keys(row,['url','sha256','reference']) || !string(row.reference) || typeof row.sha256!=='string' || !/^[a-f0-9]{64}$/i.test(row.sha256)) refuse('invalid-observer-config');
        const url=new URL(row.url);
        if(typeof row.url!=='string' || url.protocol!=='https:' || url.username || url.password || /[?#]/.test(row.url) || !origins.includes(url.origin) || urls.has(row.url)) refuse('invalid-observer-config');
        urls.add(row.url);return Object.freeze({url:row.url,sha256:row.sha256,reference:row.reference});
      }));
      return Object.freeze({id:group.id,expected,policy:Object.freeze({origins:freezeArray(origins),formats:freezeArray([...policy.formats]),width:policy.width,height:policy.height,maxBytes:policy.maxBytes,uniquePixels:policy.uniquePixels})});
    }));
  } catch(error) {
    if(error instanceof PublicationBuildError && error.code==='observer-limit') throw error;
    refuse('invalid-observer-config');
  }
  const call=async(port,...args)=>{try{return await port(...args);}catch{refuse('observer-port-failed');}};
  return async context=>{
    const coverage=await call(attestCoverage,context,paths);
    try {
      if(!keys(coverage,['complete','paths']) || coverage.complete!==true || !list(coverage.paths) || coverage.paths.length!==paths.length) refuse('observer-coverage');
      const actual=new Set(coverage.paths);
      if(actual.size!==paths.length || paths.some(path=>!actual.has(path))) refuse('observer-coverage');
    } catch {refuse('observer-coverage');}
    const heads=[];
    for(const row of plan) {
      const value=await call(readHead,context,row.reference);
      try {
        if(!keys(value,['elements']) || !list(value.elements)) refuse('invalid-observer-output');
        const elements=freezeArray(value.elements.map(element=>{
          if(!keys(element,['tag','attrs','text']) || !string(element.tag) || !record(element.attrs) || Reflect.ownKeys(element.attrs).some(key=>typeof key!=='string' || typeof element.attrs[key]!=='string') || (element.text!==undefined && typeof element.text!=='string')) refuse('invalid-observer-output');
          return Object.freeze({tag:element.tag,attrs:Object.freeze({...element.attrs}),...(element.text===undefined?{}:{text:element.text})});
        }));
        heads.push(Object.freeze({path:row.path,elements}));
      } catch {refuse('invalid-observer-output');}
    }
    const artifactGroups=[];
    for(const group of groups) {
      const observed=[];
      for(const row of group.expected) {
        const value=await call(readArtifact,context,row.reference);
        try {
          if(!keys(value,['sha256','bytes','decoded','pixelSha256','format','width','height'])) refuse('invalid-observer-output');
          for(const key of ['sha256','pixelSha256','format']) if(value[key]!==undefined && typeof value[key]!=='string') refuse('invalid-observer-output');
          for(const key of ['bytes','width','height']) if(value[key]!==undefined && !positive(value[key])) refuse('invalid-observer-output');
          if(value.decoded!==undefined && typeof value.decoded!=='boolean') refuse('invalid-observer-output');
          observed.push(Object.freeze({url:row.url,...value}));
        } catch {refuse('invalid-observer-output');}
      }
      artifactGroups.push(Object.freeze({id:group.id,policy:group.policy,expected:freezeArray(group.expected.map(({url,sha256})=>Object.freeze({url,sha256}))),observed:freezeArray(observed)}));
    }
    return Object.freeze({complete:true,heads:freezeArray(heads),artifactGroups:freezeArray(artifactGroups)});
  };
}

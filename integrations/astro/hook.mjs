import {auditOgArtifacts} from './quality/og.mjs';
import {auditPageHead} from './quality/head.mjs';
export class PublicationBuildError extends Error {
  constructor(code, report) {
    super('Publication quality check failed');
    this.name='PublicationBuildError';this.code=code;
    if(report) this.report=report;
  }
}
const fail = code => {throw new PublicationBuildError(code);};
export function createAstroPublicationIntegration(options) {
  let pages,evaluatedAt,observeBuild,onReport,headPolicy;
  try {
    const {manifest}=options;
    ({observeBuild,onReport}=options);
    if(typeof observeBuild!=='function' || typeof onReport!=='function') fail('invalid-config');
    if(!manifest || !Array.isArray(manifest.pages) || manifest.pages.length===0 || !Number.isFinite(manifest.inventory?.evaluatedAt)) fail('invalid-config');
    evaluatedAt=manifest.inventory.evaluatedAt;
    const paths=new Set();
    pages=manifest.pages.map(page=>{
      if(!page || typeof page.path!=='string' || !page.path.startsWith('/') || paths.has(page.path)) fail('invalid-config');
      paths.add(page.path);
      const expected=page.expected;
      if(!expected || !['canonical','title','description','image'].every(key=>typeof expected[key]==='string' && expected[key].trim()) || typeof expected.indexable!=='boolean') fail('invalid-config');
      return Object.freeze({path:page.path,expected:Object.freeze({canonical:expected.canonical,title:expected.title,description:expected.description,image:expected.image,indexable:expected.indexable})});
    });
    headPolicy={pageOrigin:options.headPolicy?.pageOrigin,twitterCard:options.headPolicy?.twitterCard};
    const origin=new URL(headPolicy.pageOrigin);
    if(origin.protocol!=='https:' || origin.origin!==headPolicy.pageOrigin || typeof headPolicy.twitterCard!=='string' || !headPolicy.twitterCard.trim()) fail('invalid-config');
  } catch {fail('invalid-config');}
  return Object.freeze({name:'publication-quality',hooks:Object.freeze({
    'astro:build:done':async context=>{
      let observations;
      try {observations=await observeBuild(context);} catch {fail('observation-failed');}
      let report;
      try {
        if(!observations || observations.complete!==true || observations.incomplete===true) fail('incomplete-observations');
        const {heads,artifactGroups}=observations;
        if(!Array.isArray(heads) || !Array.isArray(artifactGroups)) fail('invalid-observations');
        const findings=[];
        const note=(code,extra={})=>findings.push(Object.freeze({code,...extra}));
        const qualified=new Set(),groupIds=new Set(),artifactUrls=new Set();
        for(const [groupIndex,group] of artifactGroups.entries()) {
          if(!group || typeof group.id!=='string' || !group.id.trim() || groupIds.has(group.id) || !Array.isArray(group.expected) || !Array.isArray(group.observed)) fail('invalid-observations');
          groupIds.add(group.id);
          for(const artifact of group.expected) {
            if(!artifact || typeof artifact.url!=='string' || artifactUrls.has(artifact.url)) fail('invalid-observations');
            artifactUrls.add(artifact.url);
          }
          const issues=auditOgArtifacts(group.expected,group.observed,group.policy);
          for(const issue of issues) note('artifact:'+issue.code,{group:groupIndex});
          if(!issues.length) for(const artifact of group.expected) qualified.add(artifact.url);
        }
        const expectedPaths=new Set(pages.map(page=>page.path)),byPath=new Map();
        for(const observation of heads) {
          if(!observation || typeof observation.path!=='string' || !Array.isArray(observation.elements)) fail('invalid-observations');
          if(!expectedPaths.has(observation.path)) {note('unexpected-route');continue;}
          if(byPath.has(observation.path)) note('duplicate-route',{path:observation.path});
          else byPath.set(observation.path,observation.elements);
        }
        let checkedHeads=0;
        for(const page of pages) {
          const elements=byPath.get(page.path);
          if(!elements) {note('missing-route',{path:page.path});continue;}
          if(!qualified.has(page.expected.image)) {note('unaudited-image',{path:page.path});continue;}
          const issues=auditPageHead(elements,page.expected,{...headPolicy,imageUrls:[...qualified]});
          for(const issue of issues) note('head:'+issue.code,{path:page.path,field:issue.field});
          checkedHeads++;
        }
        report=Object.freeze({schema:'publication-quality/build-v1',ok:findings.length===0,evaluatedAt,
          counts:Object.freeze({expectedPages:pages.length,observedHeads:heads.length,artifactGroups:artifactGroups.length,qualifiedArtifacts:qualified.size,checkedHeads}),findings:Object.freeze(findings)});
      } catch(error) {
        if(error instanceof PublicationBuildError) throw error;
        fail('invalid-observations');
      }
      try {await onReport(report);} catch {fail('report-failed');}
      if(!report.ok) throw new PublicationBuildError('quality-refused',report);
    },
  })});
}

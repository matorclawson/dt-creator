import type {SiteInput,DocumentInput,ProjectionOptions,PublicEntry,Inventory} from '@zeroemployeeorg/publication-core';
export interface PageExpectation {readonly canonical:string;readonly title:string;readonly description:string;readonly image:string;readonly indexable:boolean;}
export interface PageDescription extends Omit<PageExpectation,'canonical'> {}
export interface ManifestInput {
  readonly site:SiteInput;readonly documents:readonly DocumentInput[];readonly projection:ProjectionOptions;
  readonly describePage:(entry:Readonly<PublicEntry>)=>PageDescription;
}
export interface PublicationManifest {readonly inventory:Readonly<Inventory>;readonly pages:readonly Readonly<{id:string;path:string;expected:Readonly<PageExpectation>}>[];}
export declare function createPublicationManifest(input:ManifestInput):Readonly<PublicationManifest>;
export interface ExpectedArtifact {readonly url:string;readonly sha256:string;}
export interface ObservedArtifact {readonly url:string;readonly sha256?:string;readonly bytes?:number;readonly decoded?:boolean;readonly pixelSha256?:string;readonly format?:string;readonly width?:number;readonly height?:number;}
export interface ArtifactPolicy {readonly origins:readonly string[];readonly formats:readonly string[];readonly width:number;readonly height:number;readonly maxBytes:number;readonly uniquePixels:boolean;}
export interface ArtifactFinding {readonly code:string;readonly url:string;}
export declare function auditOgArtifacts(expected:readonly ExpectedArtifact[],observed:readonly ObservedArtifact[],policy:ArtifactPolicy):ArtifactFinding[];
export interface HeadElement {readonly tag:string;readonly attrs:Readonly<Record<string,string>>;readonly text?:string;}
export interface HeadPolicy {readonly pageOrigin:string;readonly imageUrls:readonly string[];readonly twitterCard:string;}
export interface HeadFinding {readonly code:string;readonly field:string;}
export declare function auditPageHead(elements:readonly HeadElement[],expected:PageExpectation,policy:HeadPolicy):HeadFinding[];

export interface AstroPublicationBuildContext {
  readonly pages:readonly {readonly pathname:string}[];readonly dir:URL;readonly assets:Map<string,URL[]>;readonly logger:unknown;
}
export interface ArtifactObservationGroup {readonly id:string;readonly expected:readonly ExpectedArtifact[];readonly observed:readonly ObservedArtifact[];readonly policy:ArtifactPolicy;}
export interface BuildObservations {readonly complete:true;readonly incomplete?:boolean;readonly heads:readonly {readonly path:string;readonly elements:readonly HeadElement[]}[];readonly artifactGroups:readonly ArtifactObservationGroup[];}
export interface PublicationQualityReport {
  readonly schema:'publication-quality/build-v1';readonly ok:boolean;readonly evaluatedAt:number;
  readonly counts:Readonly<{expectedPages:number;observedHeads:number;artifactGroups:number;qualifiedArtifacts:number;checkedHeads:number}>;
  readonly findings:readonly Readonly<{code:string;path?:string;group?:number;field?:string}>[];
}
export type PublicationBuildErrorCode='invalid-config'|'invalid-observations'|'incomplete-observations'|'observation-failed'|'report-failed'|'quality-refused'|'invalid-observer-config'|'observer-limit'|'observer-port-failed'|'observer-coverage'|'invalid-observer-output';
export declare class PublicationBuildError extends Error {readonly code:PublicationBuildErrorCode;readonly report?:PublicationQualityReport;constructor(code:PublicationBuildErrorCode,report?:PublicationQualityReport);}
export interface AstroPublicationOptions {
  readonly manifest:PublicationManifest;readonly observeBuild:(context:AstroPublicationBuildContext)=>BuildObservations|Promise<BuildObservations>;
  readonly headPolicy:Readonly<{pageOrigin:string;twitterCard:string}>;readonly onReport:(report:PublicationQualityReport)=>void|Promise<void>;
}
export interface AstroPublicationIntegration {readonly name:string;readonly hooks:Readonly<{'astro:build:done':(context:AstroPublicationBuildContext)=>Promise<void>}>;}
export declare function createAstroPublicationIntegration(options:AstroPublicationOptions):AstroPublicationIntegration;

export interface StaticHeadPlan {readonly path:string;readonly reference:string;}
export interface StaticArtifactPlan extends ExpectedArtifact {readonly reference:string;}
export interface StaticArtifactGroup {readonly id:string;readonly policy:ArtifactPolicy;readonly expected:readonly StaticArtifactPlan[];}
export interface StaticObserverOptions {
  readonly manifest:PublicationManifest;
  readonly headPlan:readonly StaticHeadPlan[];
  readonly artifactGroups:readonly StaticArtifactGroup[];
  readonly limits:Readonly<{maxPages:number;maxArtifacts:number}>;
  readonly attestCoverage:(context:AstroPublicationBuildContext,paths:readonly string[])=>Readonly<{complete:true;paths:readonly string[]}>|Promise<Readonly<{complete:true;paths:readonly string[]}>>;
  readonly readHead:(context:AstroPublicationBuildContext,reference:string)=>Readonly<{elements:readonly HeadElement[]}>|Promise<Readonly<{elements:readonly HeadElement[]}>>;
  readonly readArtifact:(context:AstroPublicationBuildContext,reference:string)=>Omit<ObservedArtifact,'url'>|Promise<Omit<ObservedArtifact,'url'>>;
}
export declare function createStaticPublicationObserver(options:StaticObserverOptions):(context:AstroPublicationBuildContext)=>Promise<BuildObservations>;

export interface PublicationHeadElementPolicy {readonly twitterCard:string;readonly robots:string;}
export declare function createPublicationHeadElements(expected:PageExpectation,policy:PublicationHeadElementPolicy):readonly Readonly<HeadElement>[];

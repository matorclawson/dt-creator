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

import {projectPublicInventory} from '@zeroemployeeorg/publication-core';
export {auditOgArtifacts} from './quality/og.mjs';
export {auditPageHead} from './quality/head.mjs';
const text = value => {
  if (typeof value !== 'string' || !value.trim() || !value.isWellFormed()) throw new TypeError('Explicit nonempty well-formed page metadata required');
  return value;
};
export function createPublicationManifest({site, documents, projection, describePage}) {
  if (typeof describePage !== 'function') throw new TypeError('Explicit page metadata callback required');
  const inventory = projectPublicInventory(site, documents, projection);
  const pages = inventory.entries.map(entry => {
    const described = describePage(entry);
    if (!described || typeof described !== 'object' || Array.isArray(described) || typeof described.indexable !== 'boolean') throw new TypeError('Explicit page metadata and indexability required');
    const image = text(described.image);
    const url = new URL(image);
    if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError('Explicit HTTPS image URL required');
    const expected = Object.freeze({canonical:entry.canonicalUrl,title:text(described.title),description:text(described.description),image,indexable:described.indexable});
    return Object.freeze({id:entry.id,path:entry.path,expected});
  });
  return Object.freeze({inventory,pages:Object.freeze(pages)});
}

export {createAstroPublicationIntegration,PublicationBuildError} from './hook.mjs';

export {createStaticPublicationObserver} from './observer.mjs';

export {createPublicationHeadElements} from './quality/head-elements.mjs';

export {createPublicationSitemapEntries} from './quality/sitemap.mjs';

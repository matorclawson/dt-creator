const meta=(field,source)=>({field,source,tag:'meta',valueAttr:'content',attrs:{[field.startsWith('og:')?'property':'name']:field}});
export const headFields=Object.freeze([
  {field:'title',source:'title',tag:'title',attrs:{}},
  {field:'canonical',source:'canonical',tag:'link',valueAttr:'href',attrs:{rel:'canonical'}},
  meta('description','description'),meta('og:title','title'),meta('og:description','description'),
  meta('og:url','canonical'),meta('og:image','image'),meta('twitter:title','title'),
  meta('twitter:description','description'),meta('twitter:image','image'),meta('twitter:card','twitterCard'),
].map(row=>Object.freeze({...row,attrs:Object.freeze(row.attrs)})));

export function robotsState(values) {
  const tokens=values.flatMap(value=>typeof value==='string'?value.toLowerCase().split(/[\s,]+/):[]);
  const blocked=tokens.includes('noindex') || tokens.includes('none');
  return {blocked,conflicting:blocked && (tokens.includes('index') || tokens.includes('all'))};
}

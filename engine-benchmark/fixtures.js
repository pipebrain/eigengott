import {normalizeSettings} from './stats.js';
export const FIXTURE_KEY='eigengott-arena-fixtures-v1';
export function parseFixture(value){
  if(value?.version!==1||typeof value.name!=='string'||!value.name.trim()||value.name.length>64||!Number.isInteger(value.seed)||value.seed<0||value.seed>0xffffffff)throw new Error('Invalid benchmark fixture.');
  const settings=normalizeSettings(value.settings);
  if(['profile','lights','density','detail'].some(key=>settings[key]!==value.settings?.[key]))throw new Error('Fixture settings exceed the supported workload limits.');
  return {version:1,name:value.name.trim(),seed:value.seed,settings,movement:value.movement===1?1:0};
}
export function loadFixtures(storage){
  try{storage??=globalThis.localStorage;return JSON.parse(storage.getItem(FIXTURE_KEY)||'[]').slice(0,64).map(parseFixture);}catch{return [];}
}
export function storeFixtures(fixtures,storage=localStorage){storage.setItem(FIXTURE_KEY,JSON.stringify(fixtures.slice(0,64)));}

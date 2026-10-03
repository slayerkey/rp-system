// Product-first Marketplace descriptions should be readable before a buyer
// opens the full listing. Strict formatting is opt-in for newly refreshed
// listings; historical products keep their existing copy until revised.
import {readFileSync} from 'node:fs';

export function assertMarketplaceDescription(submission) {
  if (submission.description_format == null) return {format:'legacy',paragraphs:null,benefitBullets:null};
  if (submission.description_format !== 'structured-v1') {
    throw new Error('Unknown Marketplace description_format: ' + submission.description_format);
  }
  const copy = String(submission.description || '').replace(/\r/g,'').trim();
  const blocks = copy.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
  const lines = copy.split('\n').map(s=>s.trim());
  const headings = lines.filter(s=>/^[A-Z][A-Z0-9 &/+\-\u2019']{3,45}$/.test(s));
  const bullets = lines.filter(s=>/^[•-] +\S/.test(s));
  if (copy.length < 250 || copy.length > 2800) throw new Error('Structured Marketplace description must be 250–2800 characters');
  if (blocks.length < 4 || headings.length < 2 || bullets.length < 3) {
    throw new Error('Structured Marketplace description needs introduction, blank-line-separated sections, at least two short headings and three feature bullets');
  }
  if (/^[•-]/.test(lines[0]) || lines[0].length < 45) throw new Error('Structured Marketplace description must open with a plain-language value proposition');
  if (bullets.some(s=>s.length>240) || headings.some(s=>s.length>46)) throw new Error('Marketplace bullets/headings exceed the scannable layout limit');
  if (lines.some(s=>s.includes('\\n'))) throw new Error('Literal backslash-n detected in structured Marketplace description');
  return {format:'structured-v1',paragraphs:blocks.length,benefitBullets:bullets.length};
}
if (process.argv[1] && /marketplace_description_guard\.mjs$/i.test(process.argv[1]) && process.argv[2]==='--submission') {
  const s=JSON.parse(readFileSync(process.argv[3],'utf8'));
  const result=assertMarketplaceDescription(s);
  console.log('MARKETPLACE DESCRIPTION PASS: '+result.format+(result.paragraphs==null?'':', '+result.paragraphs+' sections, '+result.benefitBullets+' bullets'));
}

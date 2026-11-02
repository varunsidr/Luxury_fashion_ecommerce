import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const manifest = JSON.parse(await readFile('src/lib/product-photo-manifest.json','utf8'));
const errors = [], remaining = [];
const originals = new Set();
let originalCount = 0, retained = 0, bytes = 0;
for (const category of await readdir('public/demo-products',{ withFileTypes: true })) {
  if (!category.isDirectory()) continue;
  for (const filename of await readdir('public/demo-products/'+category.name)) {
    if (!filename.endsWith('.jpg')) continue;
    originalCount++;
    const source = '/demo-products/'+category.name+'/'+filename;
    originals.add(source);
    const original = await sharp('public'+source).metadata();
    const replacement = manifest[source];
    if (original.width >= 900) {
      retained++;
      if (replacement) errors.push(source+': existing high-resolution source was unnecessarily replaced');
      continue;
    }
    if (!replacement) { remaining.push(source); continue; }
    if (replacement.src !== source.replace('/demo-products/','/product-photos-v2/').replace(/\.jpg$/,'.webp')) {
      errors.push(source+': unexpected replacement URL'); continue;
    }
    const file = await readFile('public'+replacement.src);
    const image = await sharp(file).metadata();
    bytes += file.length;
    if (image.format !== 'webp') errors.push(source+': replacement is not WebP');
    if (image.width < 1024 || image.height < 1536 || image.width / image.height !== 2/3) errors.push(source+': replacement is not a high-resolution 2:3 portrait');
    if (image.width !== replacement.width || image.height !== replacement.height) errors.push(source+': dimensions disagree with manifest');
    if (createHash('sha256').update(file).digest('hex') !== replacement.sha256) errors.push(source+': replacement checksum disagrees');
    if (!replacement.provenance?.includes('AI-enhanced demo illustration')) errors.push(source+': missing illustration provenance');
  }
}
for (const source of Object.keys(manifest)) if (!originals.has(source)) errors.push(source+': mapping has no original catalog photo');
console.log(JSON.stringify({ originalCount,retainedHighResolution: retained,enhanced: Object.keys(manifest).length,totalReplacementBytes: bytes,remaining: remaining.length,errors },null,2));
if (remaining.length) console.log('Still awaiting a reviewed high-resolution replacement:\n'+remaining.join('\n'));
if (errors.length || remaining.length) process.exitCode = 1;

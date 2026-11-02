import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Install selected imagegen outputs without overwriting original catalog photos.
// Re-encoding changes delivery format only; generation/editing happens in imagegen.
const records = JSON.parse(await readFile(process.argv[2], 'utf8'));
const manifestPath = resolve('src/lib/product-photo-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const record of records) {
  const match = /^\/demo-products\/([a-z-]+)\/(\d{2})\.jpg$/.exec(record.source);
  if (!match || typeof record.generated !== 'string') throw new Error('Invalid photo installation record');
  const source = resolve('public' + record.source);
  if (relative(resolve('public/demo-products'),source).startsWith('..')) throw new Error('Source outside demo catalog');
  const original = await sharp(source).metadata();
  if (original.width >= 900) throw new Error('Do not replace an existing high-resolution photograph');
  const metadata = await sharp(record.generated).metadata();
  if (metadata.width < 1024 || metadata.height < 1536) throw new Error('Generated photo is below the required portrait resolution');
  const destination = '/product-photos-v2/' + match[1] + '/' + match[2] + '.webp';
  const target = resolve('public' + destination);
  if (relative(resolve('public/product-photos-v2'),target).startsWith('..')) throw new Error('Destination outside photo library');
  const bytes = await sharp(record.generated).webp({ quality: 88, effort: 6 }).toBuffer();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target,bytes);
  manifest[record.source] = { src: destination,width: metadata.width,height: metadata.height,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    provenance: 'AI-enhanced demo illustration from the legacy photograph; fine details are illustrative.' };
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a],[b]) => a.localeCompare(b)));
await writeFile(manifestPath,JSON.stringify(sorted,null,2)+'\n');
console.log(JSON.stringify({ installed: records.length,total: Object.keys(sorted).length }));

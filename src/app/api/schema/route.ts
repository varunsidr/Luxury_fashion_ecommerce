import fs from 'fs';
import path from 'path';

export async function GET() {
  const file = path.resolve(process.cwd(), 'supabase_schema.sql');
  try {
    const sql = await fs.promises.readFile(file, 'utf8');
    return new Response(sql, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    return new Response('Schema file not found', { status: 404 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

const BRIDGE_URL = 'https://m5oqj21chd.execute-api.ap-southeast-2.amazonaws.com/lambda/invoke';
const BRIDGE_KEY = process.env.BRIDGE_API_KEY!;
const SUPA_URL   = 'https://lzfgigiyqpuuxslsygjt.supabase.co/rest/v1/rpc/exec_sql';
const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      raw_text,
      source_url  = null,
      source_app  = 'knowledge-drop',
      project     = null,
      topic_tags  = null,
      notes       = null,
      kind        = 'text',
      format      = 'markdown',
    } = body;

    if (!raw_text?.trim()) {
      return NextResponse.json({ error: 'raw_text required' }, { status: 400 });
    }

    const tags = Array.isArray(topic_tags) && topic_tags.length > 0
      ? `ARRAY[${topic_tags.map((t: string) => `'${t.replace(/'/g,"''")}'`).join(',')}]`
      : 'NULL';

    const sql = `SELECT knowledge.fn_enqueue_item(
      now()::timestamptz,
      'troy',
      ${source_url ? `'${source_url.replace(/'/g,"''")}'` : 'NULL'},
      '${source_app}',
      'browser',
      NULL,
      ${project ? `'${project.replace(/'/g,"''")}'` : 'NULL'},
      ${tags},
      ${notes ? `'${notes.replace(/'/g,"''")}'` : 'NULL'},
      '${kind}',
      '${format}',
      $txt$${raw_text}$txt$,
      NULL
    ) AS job_id`;

    // Try bridge first
    let jobId: string | null = null;
    try {
      const br = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'x-api-key': BRIDGE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: 'troy-sql-executor', sql }),
      });
      const bd = await br.json();
      jobId = bd?.rows?.[0]?.job_id ?? null;
    } catch {}

    // Fallback: direct Supabase REST
    if (!jobId) {
      const sr = await fetch(SUPA_URL, {
        method: 'POST',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
      const sd = await sr.json();
      jobId = sd?.rows?.[0]?.job_id ?? null;
    }

    if (!jobId) return NextResponse.json({ error: 'enqueue failed' }, { status: 500 });
    return NextResponse.json({ job_id: jobId, status: 'queued' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

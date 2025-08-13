// app/api/uploads/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ingestQ, DEFAULT_OPTS } from '@/lib/queues';

export async function POST(req: NextRequest) {
  const body = await req.json();
  // body: { uploadId, rows: [...] } — in prod you'll stream to object storage and only pass a file URL
  await ingestQ.add('ingest-file', body, DEFAULT_OPTS);
  return NextResponse.json({ ok: true });
}
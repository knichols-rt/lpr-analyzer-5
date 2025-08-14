// app/api/uploads/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ingestQ } from '@/lib/queues';

export async function POST(req: NextRequest) {
  const body = await req.json();
  // body: { uploadId, rows: [...] } — in prod you'll stream to object storage and only pass a file URL
  await ingestQ.add('ingest-file', body, {
    removeOnComplete: true,
    removeOnFail: false
  });
  return NextResponse.json({ ok: true });
}
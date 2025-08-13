import { NextRequest, NextResponse } from 'next/server';
import { ingestQ, DEFAULT_OPTS } from '@/lib/queues';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadId, mapping, zone, timezone } = body;

    // Validate required fields
    if (!uploadId || !mapping) {
      return NextResponse.json(
        { error: 'Missing required fields: uploadId, mapping' },
        { status: 400 }
      );
    }

    // TODO: Retrieve upload metadata from database
    // const upload = await db.query('SELECT * FROM uploads WHERE id = $1', [uploadId]);
    // if (!upload.rows.length) {
    //   return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    // }

    // TODO: Validate that the upload is in UPLOADED status
    // if (upload.rows[0].status !== 'UPLOADED') {
    //   return NextResponse.json({ 
    //     error: `Upload status must be UPLOADED, current status: ${upload.rows[0].status}` 
    //   }, { status: 400 });
    // }

    // TODO: Update upload status to COMMITTED
    // await db.query('UPDATE uploads SET status = $1, mapping = $2, zone = $3, timezone = $4, committed_at = NOW() WHERE id = $5', 
    //   ['COMMITTED', JSON.stringify(mapping), zone, timezone, uploadId]);

    // Enqueue ingest job as specified in the spec
    const ingestJob = {
      uploadId,
      mapping,
      zone,
      timezone,
      // TODO: Add S3 file location once database is implemented
      // s3Location: upload.rows[0].s3_location
    };

    await ingestQ.add('ingest-csv', ingestJob, DEFAULT_OPTS);

    return NextResponse.json({
      success: true,
      uploadId,
      status: 'COMMITTED',
      message: 'Upload committed and ingest job enqueued'
    });

  } catch (error) {
    console.error('Error in uploads/commit:', error);
    return NextResponse.json(
      { error: 'Failed to commit upload for processing' },
      { status: 500 }
    );
  }
}
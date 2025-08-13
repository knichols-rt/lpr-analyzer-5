// app/api/uploads/[id]/status/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  // Note: Promise type for Next.js 15
) {
  try {
    // Await params for Next.js 15
    const { id } = await params;
    
    // Get real upload status from database
    const uploadResult = await pool.query(
      `SELECT 
        id,
        filename,
        bytes,
        rows_claimed,
        rows_loaded,
        status,
        error_log,
        created_at,
        completed_at
       FROM uploads 
       WHERE id = $1`,
      [id]
    );

    if (uploadResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    const upload = uploadResult.rows[0];

    // Get session count if processing is complete
    let sessionCount = 0;
    if (upload.status === 'COMPLETED') {
      const sessionResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM sessions 
         WHERE entry_event_id IN (
           SELECT id FROM events WHERE upload_id = $1
         )`,
        [id]
      );
      sessionCount = parseInt(sessionResult.rows[0].count);
    }

    return NextResponse.json({
      uploadId: upload.id,
      status: upload.status,
      progress: {
        rowsProcessed: upload.rows_loaded || 0,
        totalRows: upload.rows_claimed || 0,
        percentage: upload.rows_claimed > 0 
          ? Math.round((upload.rows_loaded / upload.rows_claimed) * 100)
          : 0
      },
      stats: {
        filename: upload.filename,
        bytes: upload.bytes,
        rowsLoaded: upload.rows_loaded || 0,
        sessionsCreated: sessionCount,
        startTime: upload.created_at,
        endTime: upload.completed_at
      },
      error: upload.error_log
    });
  } catch (error) {
    console.error('Error fetching upload status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload status' },
      { status: 500 }
    );
  }
}
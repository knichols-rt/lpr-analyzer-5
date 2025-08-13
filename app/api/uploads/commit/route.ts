// app/api/uploads/commit/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { uploadId, action } = await request.json();
    
    if (!uploadId || !action) {
      return NextResponse.json(
        { error: 'Missing uploadId or action' },
        { status: 400 }
      );
    }

    if (action === 'CANCEL') {
      // Mark upload as cancelled and clean up
      await pool.query(
        `UPDATE uploads 
         SET status = 'CANCELLED', completed_at = NOW() 
         WHERE id = $1`,
        [uploadId]
      );
      
      // Delete any events that were loaded
      await pool.query(
        `DELETE FROM events WHERE upload_id = $1`,
        [uploadId]
      );
      
      return NextResponse.json({
        status: 'CANCELLED',
        message: 'Upload cancelled and data cleaned up'
      });
    }

    if (action === 'COMMIT') {
      // Check if processing is complete
      const result = await pool.query(
        `SELECT status, rows_claimed, rows_loaded 
         FROM uploads 
         WHERE id = $1`,
        [uploadId]
      );
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Upload not found' },
          { status: 404 }
        );
      }

      const upload = result.rows[0];
      
      if (upload.status !== 'PROCESSING' && upload.status !== 'COMPLETED') {
        return NextResponse.json(
          { error: 'Upload not ready to commit' },
          { status: 400 }
        );
      }

      // Mark as completed
      await pool.query(
        `UPDATE uploads 
         SET status = 'COMPLETED', completed_at = NOW() 
         WHERE id = $1`,
        [uploadId]
      );

      return NextResponse.json({
        status: 'COMPLETED',
        message: 'Upload committed successfully',
        stats: {
          rowsClaimed: upload.rows_claimed,
          rowsLoaded: upload.rows_loaded
        }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error committing upload:', error);
    return NextResponse.json(
      { error: 'Failed to commit upload' },
      { status: 500 }
    );
  }
}
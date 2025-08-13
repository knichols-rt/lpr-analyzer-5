import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const uploadId = params.id;

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      );
    }

    // TODO: Retrieve upload status and progress from database
    // const upload = await db.query(`
    //   SELECT 
    //     id, status, last_processed_row, 
    //     inserted_count, skipped_count, error_count,
    //     total_rows, created_at, updated_at
    //   FROM uploads 
    //   WHERE id = $1
    // `, [uploadId]);
    
    // if (!upload.rows.length) {
    //   return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    // }

    // const uploadData = upload.rows[0];

    // Mock response for development - following exact spec format
    const mockResponse = {
      state: 'PROCESSING', // PENDING, UPLOADED, COMMITTED, PROCESSING, COMPLETED, ERROR, ABORTED
      counts: {
        inserted: 1250,
        skipped: 15,
        errors: 3
      },
      lastProcessedRow: 1268,
      totalRows: 5000,
      progress: {
        percentage: 25.36,
        estimatedTimeRemaining: '00:03:45'
      },
      metadata: {
        uploadId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(mockResponse);

  } catch (error) {
    console.error('Error in uploads/[id]/status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve upload status' },
      { status: 500 }
    );
  }
}
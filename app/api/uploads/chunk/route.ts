// app/api/uploads/chunk/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const CHUNK_SIZE = 10000; // Process in batches
const chunks = new Map<string, string[]>(); // Temporary storage

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const chunk = formData.get('chunk') as Blob;
    
    if (!uploadId || !chunk) {
      return NextResponse.json(
        { error: 'Missing uploadId or chunk data' },
        { status: 400 }
      );
    }

    // Convert chunk to text
    const chunkText = await chunk.text();
    
    // Store chunk in memory (in production, use Redis or temp files)
    if (!chunks.has(uploadId)) {
      chunks.set(uploadId, []);
    }
    const uploadChunks = chunks.get(uploadId)!;
    uploadChunks[chunkIndex] = chunkText;

    // Check if all chunks received
    if (uploadChunks.filter(Boolean).length === totalChunks) {
      // Combine all chunks
      const fullCsv = uploadChunks.join('');
      chunks.delete(uploadId); // Clean up memory
      
      // Parse CSV headers to count rows
      const lines = fullCsv.split('\n').filter(line => line.trim());
      const rowCount = lines.length - 1; // Subtract header row
      
      // Update upload record with row count
      await pool.query(
        `UPDATE uploads 
         SET rows_claimed = $1, status = 'PROCESSING' 
         WHERE id = $2`,
        [rowCount, uploadId]
      );
      
      // Queue for processing
      const { ingestQ } = await import('@/lib/queues');
      await ingestQ.add('process-csv', {
        uploadId,
        csvData: fullCsv
      }, {
        removeOnComplete: true,
        removeOnFail: false,
      });
      
      return NextResponse.json({
        status: 'COMPLETED',
        message: 'All chunks received, processing started',
        rowCount
      });
    }

    return NextResponse.json({
      status: 'CHUNK_RECEIVED',
      message: `Chunk ${chunkIndex + 1}/${totalChunks} received`
    });
  } catch (error) {
    console.error('Error processing chunk:', error);
    return NextResponse.json(
      { error: 'Failed to process chunk' },
      { status: 500 }
    );
  }
}
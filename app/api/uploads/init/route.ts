// app/api/uploads/init/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const { filename, bytes } = await request.json();
    
    if (!filename || !bytes) {
      return NextResponse.json(
        { error: 'Missing filename or bytes' },
        { status: 400 }
      );
    }

    const uploadId = randomUUID();
    
    // Create real upload record in database
    await pool.query(
      `INSERT INTO uploads (id, filename, bytes, status, created_at) 
       VALUES ($1, $2, $3, 'PENDING', NOW())`,
      [uploadId, filename, bytes]
    );

    return NextResponse.json({ 
      uploadId,
      status: 'PENDING',
      message: 'Upload initialized successfully' 
    });
  } catch (error) {
    console.error('Error initializing upload:', error);
    return NextResponse.json(
      { error: 'Failed to initialize upload' },
      { status: 500 }
    );
  }
}
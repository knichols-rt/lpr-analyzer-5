import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await pool.query(
      `SELECT 
        s.*,
        ein.plate_raw as entry_plate_raw,
        ein.camera_id as entry_camera,
        ein.quality as entry_quality,
        eout.plate_raw as exit_plate_raw,
        eout.camera_id as exit_camera,
        eout.quality as exit_quality
      FROM sessions s
      LEFT JOIN events ein ON ein.id = s.entry_event_id
      LEFT JOIN events eout ON eout.id = s.exit_event_id
      WHERE s.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
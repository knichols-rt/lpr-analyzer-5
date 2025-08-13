// app/api/metrics/zone/route.ts  (dashboard cards)
import { pool } from '@/lib/db';
export async function GET() {
  const { rows } = await pool.query('SELECT * FROM mv_daily_zone ORDER BY day DESC LIMIT 31;');
  return Response.json(rows);
}
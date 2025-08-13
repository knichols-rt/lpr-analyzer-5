#!/bin/bash
while true; do
  clear
  echo "📊 LPR Upload & Matching Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "================================================"
  
  # Database stats
  PGPASSWORD=lpr_password psql -h localhost -p 5432 -U lpr_user -d lpr_analyzer -t -c "
    SELECT 
      'Events: ' || COUNT(*) || ' | Sessions: ' || (SELECT COUNT(*) FROM sessions) || ' | Match Rate: ' || 
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((SELECT COUNT(*) FROM sessions)::numeric / COUNT(*) * 100, 2) || '%'
        ELSE '0%'
      END
    FROM events;
  "
  
  # Status breakdown
  echo -e "\nStatus Breakdown:"
  PGPASSWORD=lpr_password psql -h localhost -p 5432 -U lpr_user -d lpr_analyzer -c "
    SELECT status, COUNT(*) as count 
    FROM events 
    GROUP BY status 
    ORDER BY status;
  "
  
  sleep 30
done

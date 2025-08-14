// app/sessions/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchPlate, setSearchPlate] = useState('all');
  const [searchZone, setSearchZone] = useState('all');
  const [pagination, setPagination] = useState({
    limit: 100,
    offset: 0,
    total: 0,
    hasMore: false
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });
      
      if (searchPlate) params.append('plate', searchPlate);
      if (searchZone) params.append('zone', searchZone);
      
      const response = await fetch(`/api/sessions?${params}`);
      const data = await response.json();
      
      setSessions(data.sessions);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPagination(prev => ({ ...prev, offset: 0 }));
    fetchSessions();
  }

  if (loading && sessions.length === 0) {
    return <div className="p-8">Loading sessions...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Sessions</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Search by plate..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Input
              placeholder="Filter by zone..."
              value={searchZone}
              onChange={(e) => setSearchZone(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session List ({pagination.total} total)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2">Plate</th>
                  <th className="text-left p-2">Zone</th>
                  <th className="text-left p-2">Entry</th>
                  <th className="text-left p-2">Exit</th>
                  <th className="text-left p-2">Duration</th>
                  <th className="text-left p-2">Amount</th>
                  <th className="text-left p-2">Match</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: any) => (
                  <tr key={session.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                    <td className="p-2 font-mono">{session.plate_norm}</td>
                    <td className="p-2">{session.zone}</td>
                    <td className="p-2 text-sm">
                      {new Date(session.entry_ts).toLocaleString()}
                    </td>
                    <td className="p-2 text-sm">
                      {new Date(session.exit_ts).toLocaleString()}
                    </td>
                    <td className="p-2">{session.duration_minutes} min</td>
                    <td className="p-2">${session.billing_amount}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        session.match_type === 'EXACT' ? 'badge-exact' :
                        session.match_type === 'FUZZY_ACCEPTED' ? 'badge-fuzzy' :
                        'badge-state-mismatch'
                      }`}>
                        {session.match_type}
                      </span>
                    </td>
                    <td className="p-2">
                      <Link 
                        href={`/sessions/${session.id}`}
                        className="text-primary hover:underline transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {pagination.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button 
                onClick={() => {
                  setPagination(prev => ({ 
                    ...prev, 
                    offset: prev.offset + prev.limit 
                  }));
                  fetchSessions();
                }}
              >
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
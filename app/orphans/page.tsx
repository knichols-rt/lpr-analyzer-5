// app/orphans/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';

export default function OrphansPage() {
  const [orphans, setOrphans] = useState([]);
  const [counts, setCounts] = useState({ expired: 0, open: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [pagination, setPagination] = useState({
    limit: 100,
    offset: 0,
    hasMore: false
  });

  useEffect(() => {
    fetchOrphans();
  }, [activeTab, pagination.offset]);

  async function fetchOrphans() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });
      
      if (activeTab !== 'all') {
        params.append('type', activeTab);
      }
      
      const response = await fetch(`/api/orphans?${params}`);
      const data = await response.json();
      
      setOrphans(data.orphans);
      setCounts(data.counts);
      setPagination(prev => ({ ...prev, hasMore: data.pagination.hasMore }));
    } catch (error) {
      console.error('Error fetching orphans:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    setPagination(prev => ({ ...prev, offset: 0 }));
  }

  if (loading && orphans.length === 0) {
    return <div className="p-8">Loading orphans...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Orphaned Events</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Orphans</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.expired}</div>
            <p className="text-xs text-muted-foreground">
              IN events that exceeded horizon window
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Orphans</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.open}</div>
            <p className="text-xs text-muted-foreground">
              OUT events without matching IN
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orphan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="all">All Orphans</TabsTrigger>
              <TabsTrigger value="expired">Expired</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2">Event ID</th>
                      <th className="text-left p-2">Timestamp</th>
                      <th className="text-left p-2">Direction</th>
                      <th className="text-left p-2">Plate</th>
                      <th className="text-left p-2">Zone</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Camera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphans.map((orphan: any) => (
                      <tr key={orphan.event_id} className="border-b border-border hover:bg-accent/50 transition-colors">
                        <td className="p-2 font-mono text-sm">{orphan.event_id}</td>
                        <td className="p-2 text-sm">
                          {new Date(orphan.ts).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            orphan.direction === 'IN' ? 'badge-exact' : 'badge-fuzzy'
                          }`}>
                            {orphan.direction}
                          </span>
                        </td>
                        <td className="p-2 font-mono">{orphan.plate_norm}</td>
                        <td className="p-2">{orphan.zone}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            orphan.status === 'ORPHAN_EXPIRED' ? 'badge-expired' : 'badge-open'
                          }`}>
                            {orphan.status}
                          </span>
                        </td>
                        <td className="p-2 text-sm">{orphan.camera_id || 'N/A'}</td>
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
                    }}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
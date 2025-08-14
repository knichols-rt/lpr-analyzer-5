// app/events/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    direction: '',
    status: '',
    zone: ''
  });
  const [pagination, setPagination] = useState({
    limit: 100,
    offset: 0,
    hasMore: false
  });

  useEffect(() => {
    fetchEvents();
  }, [pagination.offset]);

  async function fetchEvents() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      });
      
      if (filters.direction) params.append('direction', filters.direction);
      if (filters.status) params.append('status', filters.status);
      if (filters.zone) params.append('zone', filters.zone);
      
      const response = await fetch(`/api/events?${params}`);
      const data = await response.json();
      
      setEvents(data.events);
      setPagination(prev => ({ ...prev, hasMore: data.pagination.hasMore }));
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilter() {
    setPagination(prev => ({ ...prev, offset: 0 }));
    fetchEvents();
  }

  if (loading && events.length === 0) {
    return <div className="p-8">Loading events...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Events</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filters.direction} onValueChange={(value) => setFilters(prev => ({ ...prev, direction: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="IN">IN</SelectItem>
                <SelectItem value="OUT">OUT</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="OPEN">OPEN</SelectItem>
                <SelectItem value="PAIRED">PAIRED</SelectItem>
                <SelectItem value="ORPHAN_OPEN">ORPHAN_OPEN</SelectItem>
                <SelectItem value="ORPHAN_EXPIRED">ORPHAN_EXPIRED</SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              placeholder="Zone..."
              value={filters.zone}
              onChange={(e) => setFilters(prev => ({ ...prev, zone: e.target.value }))}
            />
            
            <Button onClick={handleFilter}>Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Timestamp</th>
                  <th className="text-left p-2">Direction</th>
                  <th className="text-left p-2">Plate</th>
                  <th className="text-left p-2">Zone</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Camera</th>
                  <th className="text-left p-2">Quality</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: any) => (
                  <tr key={event.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-sm">{event.id}</td>
                    <td className="p-2 text-sm">
                      {new Date(event.ts).toLocaleString()}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.direction === 'IN' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {event.direction}
                      </span>
                    </td>
                    <td className="p-2 font-mono">{event.plate_norm}</td>
                    <td className="p-2">{event.zone}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.status === 'OPEN' ? 'bg-yellow-100' :
                        event.status === 'PAIRED' ? 'bg-green-100' :
                        event.status.includes('ORPHAN') ? 'bg-red-100' :
                        'bg-gray-100'
                      }`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="p-2 text-sm">{event.camera_id || 'N/A'}</td>
                    <td className="p-2 text-sm">{event.quality ? `${(event.quality * 100).toFixed(0)}%` : 'N/A'}</td>
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
        </CardContent>
      </Card>
    </div>
  );
}
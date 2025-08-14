// app/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>({ daily: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [zone, setZone] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [days, zone]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ days });
      if (zone) params.append('zone', zone);
      
      const response = await fetch(`/api/analytics?${params}`);
      const data = await response.json();
      
      // Transform data for charts
      const chartData = data.daily.map((d: any) => ({
        date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sessions: d.total_sessions,
        exact: d.exact_sessions,
        fuzzy: d.fuzzy_sessions,
        mismatch: d.state_mismatch_sessions,
        overnight: d.overnight_sessions
      }));
      
      setAnalyticsData({
        daily: chartData.reverse(), // Show oldest to newest
        summary: data.summary
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading analytics...</div>;
  }

  const { summary } = analyticsData;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>
      
      <div className="flex gap-4 mb-6">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Zones</SelectItem>
            <SelectItem value="MAIN_GATE">Main Gate</SelectItem>
            <SelectItem value="ZONE1">Zone 1</SelectItem>
            <SelectItem value="Omaha">Omaha</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {parseInt(summary.total_sessions || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg duration: {Math.round(parseFloat(summary.avg_duration || 0))} min
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Match Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Exact:</span>
                <span className="font-bold">{summary.exact_matches || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Fuzzy:</span>
                <span className="font-bold">{summary.fuzzy_matches || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Mismatch:</span>
                <span className="font-bold">{summary.state_mismatches || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${parseFloat(summary.total_revenue || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active vehicles: {summary.active_vehicles || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Daily Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="#3b82f6" name="Total" />
              <Line type="monotone" dataKey="exact" stroke="#10b981" name="Exact" />
              <Line type="monotone" dataKey="fuzzy" stroke="#f59e0b" name="Fuzzy" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Types Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="exact" stackId="a" fill="#10b981" name="Exact" />
              <Bar dataKey="fuzzy" stackId="a" fill="#f59e0b" name="Fuzzy" />
              <Bar dataKey="mismatch" stackId="a" fill="#ef4444" name="Mismatch" />
              <Bar dataKey="overnight" fill="#8b5cf6" name="Overnight" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
// app/zones/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Target } from 'lucide-react';

export default function ZonesPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();
  }, []);

  async function fetchZones() {
    try {
      const response = await fetch('/api/zones');
      const data = await response.json();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading zones...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Zone Configuration</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zones.map((zone: any) => (
          <Card key={zone.zone_id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  {zone.zone_id}
                </span>
                <Badge variant="outline">Active</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Horizon Days
                  </span>
                  <span className="font-semibold">{zone.horizon_days}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Target className="h-3 w-3 mr-1" />
                    Fuzzy Threshold
                  </span>
                  <span className="font-semibold">{(zone.fuzzy_threshold * 100).toFixed(0)}%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Review Below</span>
                  <span className="font-semibold">{(zone.review_required_below_score * 100).toFixed(0)}%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Max Stay</span>
                  <span className="font-semibold">{zone.max_stay_hours} hrs</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2">Billing Rules</h4>
                {zone.billing_rules && Object.keys(zone.billing_rules).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(zone.billing_rules).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <span>{typeof value === 'number' ? `$${value}` : String(value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No billing rules configured</p>
                )}
              </div>
              
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Sessions</span>
                    <p className="font-semibold">{zone.total_sessions || 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Events</span>
                    <p className="font-semibold">{zone.total_events || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {zones.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No zones configured yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Add zones using SQL: INSERT INTO zone_config (zone_id, horizon_days, fuzzy_threshold) VALUES ('ZONE_NAME', 8, 0.95);
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
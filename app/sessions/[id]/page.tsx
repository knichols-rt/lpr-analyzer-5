// app/sessions/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SessionDetailPage() {
  const params = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchSession();
    }
  }, [params.id]);

  async function fetchSession() {
    try {
      const response = await fetch(`/api/sessions/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setSession(data);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading session details...</div>;
  }

  if (!session) {
    return <div className="p-8">Session not found</div>;
  }

  return (
    <div className="p-8">
      <Link href="/sessions" className="flex items-center mb-6 text-primary hover:underline transition-colors">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sessions
      </Link>

      <h1 className="text-3xl font-bold mb-8">Session Details</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session ID:</span>
              <span className="font-mono">{session.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plate:</span>
              <span className="font-mono font-bold">{session.plate_norm}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zone:</span>
              <span>{session.zone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration:</span>
              <span>{session.duration_minutes} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing Amount:</span>
              <span className="font-bold">${session.billing_amount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entry/Exit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry Time:</span>
              <span>{new Date(session.entry_ts).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry Camera:</span>
              <span>{session.entry_camera || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exit Time:</span>
              <span>{new Date(session.exit_ts).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exit Camera:</span>
              <span>{session.exit_camera || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matching Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Match Type:</span>
              <span className={`px-2 py-1 rounded ${
                session.match_type === 'EXACT' ? 'badge-exact' :
                session.match_type === 'FUZZY_ACCEPTED' ? 'badge-fuzzy' :
                'badge-state-mismatch'
              }`}>
                {session.match_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Match Method:</span>
              <span>{session.match_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence Score:</span>
              <span>{(session.confidence_score * 100).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        {session.flags && Object.keys(session.flags).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Flags</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(session.flags).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{key}:</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
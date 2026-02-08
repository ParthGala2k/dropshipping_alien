import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type Event } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { Calendar, MapPin } from 'lucide-react'

export function EventsPage() {
  const { data: events = [], isLoading } = useQuery({ queryKey: ['events'], queryFn: () => api.events.list() })

  if (isLoading) return <div className="text-center py-12 text-slate-500">Loading events…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <p className="text-slate-600 mt-1">Join the queue. Verified humans only. Fair FIFO.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(events as Event[]).map((e) => (
          <Link key={e.id} to={`/events/${e.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2 font-semibold">{e.title}</CardTitle>
                  {e.drop_status && e.drop_status !== 'unknown' && (
                    <Badge variant={e.drop_status === 'live' ? 'default' : 'secondary'}>{e.drop_status}</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {e.venue}, {e.city}
                </p>
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDateTime(e.date_time)}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm font-medium text-emerald-700">{e.tickets_remaining} tickets left</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">No events yet. Run the seed script.</CardContent>
        </Card>
      )}
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * ActivityFeed - Chat-style timeline of all cycle events
 * Shows: bids, payments, verifications in chronological order
 * Auto-scrolls to bottom on new activity
 */
export default function ActivityFeed({ cycleId }: { cycleId: string }) {
  const [activities, setActivities] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchActivities()

    // Real-time subscription
    const channel = supabase
      .channel(`activities-${cycleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cycle_activities',
          filter: `cycle_id=eq.${cycleId}`
        },
        () => {
          fetchActivities()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycleId])

  const fetchActivities = async () => {
    const { data } = await supabase
      .from('cycle_activities')
      .select(`
        *,
        user:profiles(full_name, username)
      `)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true })

    setActivities(data || [])
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getActivityMessage = (activity: any) => {
    const userName = activity.user?.full_name || 'Someone'
    
    switch (activity.activity_type) {
      case 'cycle_started':
        return { icon: '🎬', text: 'Cycle started', color: 'bg-blue-100 text-blue-800' }
      case 'bidding_opened':
        return { icon: '🎯', text: 'Bidding is now open', color: 'bg-yellow-100 text-yellow-800' }
      case 'bid_placed':
        return { 
          icon: '⬇️', 
          text: `${userName} bid ₹${activity.metadata?.bid_amount?.toLocaleString('en-IN')}`,
          color: 'bg-purple-100 text-purple-800' 
        }
      case 'bidding_closed':
        return { icon: '🔒', text: 'Bidding closed', color: 'bg-gray-100 text-gray-800' }
      case 'winner_declared':
        return { icon: '👑', text: `${userName} won the bid!`, color: 'bg-green-100 text-green-800' }
      case 'payment_phase_started':
        return { icon: '💰', text: 'Payment phase started', color: 'bg-blue-100 text-blue-800' }
      case 'payment_made':
        return { icon: '✓', text: `${userName} marked payment`, color: 'bg-green-100 text-green-800' }
      case 'payment_verified':
        return { icon: '🎉', text: `${userName}'s payment verified`, color: 'bg-teal-100 text-teal-800' }
      case 'admin_verified_payment':
        return { icon: '⭐', text: `Admin verified ${userName}'s payment`, color: 'bg-purple-100 text-purple-800' }
      case 'cycle_completed':
        return { icon: '🏁', text: 'Cycle completed', color: 'bg-gray-100 text-gray-800' }
      default:
        return { icon: '📌', text: activity.activity_type, color: 'bg-gray-100 text-gray-800' }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
      </div>

      {/* Chat-style feed */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No activity yet</p>
          </div>
        ) : (
          activities.map((activity) => {
            const { icon, text, color } = getActivityMessage(activity)
            
            return (
              <div key={activity.id} className="flex items-start gap-3">
                {/* Icon bubble */}
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                  {icon}
                </div>

                {/* Message bubble */}
                <div className="flex-1">
                  <div className={`inline-block px-4 py-2 rounded-lg ${color}`}>
                    <p className="text-sm font-medium">{text}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTime(activity.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

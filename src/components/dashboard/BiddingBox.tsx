'use client'

import { useState, useEffect } from 'react'
import { placeBid } from '@/app/dashboard/groups/[id]/cycle-actions'
import { createClient } from '@/lib/supabase/client'

export default function BiddingBox({ 
  cycle, 
  group, 
  currentUser 
}: { 
  cycle: any
  group: any
  currentUser: any
}) {
  const [bidAmount, setBidAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lowestBid, setLowestBid] = useState<number>(cycle.winning_bid_amount)
  const [recentBids, setRecentBids] = useState<any[]>([])
  const [isMember, setIsMember] = useState(false)
  const [hasMemberReceived, setHasMemberReceived] = useState(false)
  
  const supabase = createClient()

  // ✅ NEW: Check if current user is actually a member
  useEffect(() => {
    const checkMemberStatus = async () => {
      const { data: member } = await supabase
        .from('rosca_members')
        .select('has_received')
        .eq('rosca_id', group.id)
        .eq('user_id', currentUser.id)
        .single()
      
      if (member) {
        setIsMember(true)
        setHasMemberReceived(member.has_received)
      } else {
        setIsMember(false)
        setHasMemberReceived(false)
      }
    }

    checkMemberStatus()
  }, [group.id, currentUser.id])

  useEffect(() => {
    fetchBids()

    // Real-time subscription for new bids
    const channel = supabase
      .channel(`bids-${cycle.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cycle_bids',
          filter: `cycle_id=eq.${cycle.id}`
        },
        () => {
          fetchBids()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycle.id])

  const fetchBids = async () => {
    // Fetch lowest bid
    const { data: lowest } = await supabase
      .from('cycle_bids')
      .select('bid_amount')
      .eq('cycle_id', cycle.id)
      .order('bid_amount', { ascending: true })
      .limit(1)
      .single()

    if (lowest) {
      setLowestBid(lowest.bid_amount)
    } else {
      setLowestBid(cycle.winning_bid_amount)
    }

    // Fetch recent bids with user profiles
    const { data: bidsData } = await supabase
      .from('cycle_bids')
      .select('id, bid_amount, created_at, user_id')
      .eq('cycle_id', cycle.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (bidsData) {
      // Fetch profiles separately
      const userIds = bidsData.map(b => b.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      // Combine bids with profiles
      const bidsWithProfiles = bidsData.map(bid => ({
        ...bid,
        profile: profiles?.find(p => p.id === bid.user_id)
      }))

      setRecentBids(bidsWithProfiles)
    }
  }

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const amount = parseFloat(bidAmount)

    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (amount >= lowestBid) {
      setError(`Bid must be lower than £${lowestBid.toLocaleString('en-GB')}`)
      return
    }

    setLoading(true)
    const result = await placeBid(cycle.id, amount, group.id)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setBidAmount('')
      fetchBids()
    }
  }

  // ✅ Check if user is creator/admin (even if not a member)
  const isCreator = group.created_by === currentUser.id

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Bidding</h3>

      {/* Current Lowest Bid Display */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
        <p className="text-sm text-yellow-800 mb-2">Current Lowest Bid</p>
        <p className="text-4xl font-bold text-yellow-900">
          £{lowestBid.toLocaleString('en-GB')}
        </p>
        <p className="text-xs text-yellow-700 mt-2">
          {recentBids.length > 0 ? `${recentBids.length} bid(s) placed` : 'No bids yet - be the first!'}
        </p>
      </div>

      {/* ✅ NEW: Show different UI for non-member admins */}
      {!isMember && isCreator ? (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 font-medium">
            👁️ Monitoring as banker (non-participant)
          </p>
          <p className="text-xs text-blue-700 mt-1">
            You can view bids but cannot place bids since you're not participating in this cycle.
          </p>
        </div>
      ) : !isMember ? (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700">
            You are not a member of this group
          </p>
        </div>
      ) : hasMemberReceived ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 font-medium">
            ✅ You have already received your payout
          </p>
          <p className="text-xs text-green-700 mt-1">
            You cannot bid in future cycles
          </p>
        </div>
      ) : (
        /* Bidding Form - Only for eligible members */
        <form onSubmit={handlePlaceBid} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Bid Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">£</span>
            <input
               type="number"
                step="1"
                min="0"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Less than ${lowestBid}`}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />

            </div>
            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Placing Bid...' : 'Place Bid'}
          </button>
        </form>
      )}

      {/* Recent Bids */}
      {recentBids.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Bids</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentBids.map((bid, index) => (
              <div
                key={bid.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0
                    ? 'bg-yellow-100 border-2 border-yellow-300'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {index === 0 && (
                    <span className="text-xl">🏆</span>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {bid.profile?.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(bid.created_at).toLocaleString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <p className={`font-bold ${index === 0 ? 'text-yellow-900' : 'text-gray-700'}`}>
                  £{bid.bid_amount.toLocaleString('en-GB')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}



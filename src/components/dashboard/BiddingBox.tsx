'use client'

import { useState, useEffect } from 'react'
import { placeBid } from '@/app/dashboard/groups/[id]/cycle-actions'
import { createClient } from '@/lib/supabase/client'

/**
 * BiddingBox - Interactive bidding interface
 * Features:
 * - Manual bid input
 * - Quick percentage discount buttons (1%, 2%, 5%)
 * - Down Bid button to submit
 * - Live bid queue showing all bids
 */
export default function BiddingBox({ cycle, group, currentUser }: any) {
  const supabase = createClient()
  const totalAmount = group.contribution_amount * group.total_slots
  const [currentBid, setCurrentBid] = useState(totalAmount)
  const [inputValue, setInputValue] = useState(totalAmount.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bids, setBids] = useState<any[]>([])

  // Fetch current bids and lowest bid on mount
  useEffect(() => {
    fetchBids()
    fetchLowestBid()
  }, [])

  const fetchLowestBid = async () => {
    const { data } = await supabase
      .from('cycle_bids')
      .select('bid_amount')
      .eq('cycle_id', cycle.id)
      .order('bid_amount', { ascending: true })
      .limit(1)
      .single()

    if (data) {
      setCurrentBid(data.bid_amount)
      setInputValue(data.bid_amount.toString())
    }
  }

  const fetchBids = async () => {
    const { data } = await supabase
      .from('cycle_bids')
      .select(`
        id,
        bid_amount,
        created_at,
        profiles!cycle_bids_user_id_fkey(full_name, username)
      `)
      .eq('cycle_id', cycle.id)
      .order('bid_amount', { ascending: true })

    if (data) {
      const formattedBids = data.map(bid => ({
        id: bid.id,
        bid_amount: bid.bid_amount,
        username: bid.profiles?.full_name || bid.profiles?.username || 'Anonymous',
        created_at: bid.created_at
      }))
      setBids(formattedBids)
    }
  }

  // Calculate percentage reduction
  const applyDiscount = (percentage: number) => {
    const reduction = Math.round(currentBid * (percentage / 100))
    const newBid = currentBid - reduction
    setInputValue(newBid.toString())
  }

  // Submit bid
  const handleDownBid = async () => {
    const bidAmount = parseFloat(inputValue)
    
    if (isNaN(bidAmount) || bidAmount <= 0) {
      setError('Invalid bid amount')
      return
    }

    if (bidAmount >= currentBid) {
      setError(`Bid must be lower than ₹${currentBid}`)
      return
    }

    setLoading(true)
    setError('')

    const result = await placeBid(cycle.id, bidAmount, group.id)

    if (result.error) {
      setError(result.error)
    } else {
      setCurrentBid(bidAmount)
      setInputValue(bidAmount.toString())
      fetchBids()
    }

    setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Place Your Bid
      </h3>

      {/* Current Lowest Bid Display */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-600 mb-1">Current Lowest Bid</p>
        <p className="text-3xl font-bold text-blue-600">
          ₹{currentBid.toLocaleString('en-IN')}
        </p>
      </div>

      {/* Bid Input + Discount Buttons */}
      <div className="space-y-3 mb-4">
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter your bid"
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Quick Discount Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => applyDiscount(1)}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            -1%
          </button>
          <button
            onClick={() => applyDiscount(2)}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            -2%
          </button>
          <button
            onClick={() => applyDiscount(5)}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            -5%
          </button>
        </div>
      </div>

      {/* Down Bid Button */}
      <button
        onClick={handleDownBid}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Placing Bid...' : '⬇️ Down Bid'}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {/* Bid Queue */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Bid History ({bids.length})
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {bids.map((bid, idx) => (
            <div 
              key={bid.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500">
                  #{idx + 1}
                </span>
                <span className="font-medium text-gray-900">
                  {bid.username}
                </span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                ₹{bid.bid_amount.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


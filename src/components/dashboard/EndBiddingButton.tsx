'use client'

import { useState } from 'react'
import { endBiddingPhase } from '@/app/dashboard/groups/[id]/actions'

export default function EndBiddingButton({ 
  cycleId, 
  groupId 
}: { 
  cycleId: string
  groupId: string 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEndBidding() {
    if (!confirm('Are you sure you want to end bidding and select the winner?')) {
      return
    }
    
    setLoading(true)
    setError('')
    
    const result = await endBiddingPhase(cycleId, groupId)
    
    if (result.error) {
      setError(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleEndBidding}
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? 'Ending...' : '💰 End Bidding & Start Payment'}
      </button>
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { startBiddingPhase } from '@/app/dashboard/groups/[id]/cycle-actions'

export default function StartBiddingButton({ 
  cycleId, 
  groupId 
}: { 
  cycleId: string
  groupId: string 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStartBidding() {
    setLoading(true)
    setError('')
    
    const result = await startBiddingPhase(cycleId, groupId)
    
    if (result.error) {
      setError(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleStartBidding}
        disabled={loading}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? 'Starting...' : '🎯 Start Bidding Phase'}
      </button>
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}

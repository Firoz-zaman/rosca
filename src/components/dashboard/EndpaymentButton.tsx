'use client'

import { useState } from 'react'
import { endPaymentPhase } from '@/app/dashboard/groups/[id]/actions'

export default function EndPaymentButton({ 
  cycleId, 
  groupId 
}: { 
  cycleId: string
  groupId: string 
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEndPayment() {
    if (!confirm('Are you sure all payments are verified? This will complete the cycle.')) {
      return
    }
    
    setLoading(true)
    setError('')
    
    const result = await endPaymentPhase(cycleId, groupId)
    
    if (result.error) {
      setError(result.error)
    }
    
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleEndPayment}
        disabled={loading}
        className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? 'Completing...' : '✅ Complete Cycle'}
      </button>
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}

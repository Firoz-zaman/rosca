'use client'

import { useState } from 'react'
import { resetRosca } from '@/app/dashboard/groups/[id]/cycle-actions'

export default function ResetRoscaButton({ 
  groupId, 
  totalMembers 
}: { 
  groupId: string
  totalMembers: number
}) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    const result = await resetRosca(groupId)
    setLoading(false)

    if (result.error) {
      alert('❌ ' + result.error)
    } else {
      alert('✅ ROSCA reset successfully! All members can now participate in new cycles.')
      setShowConfirm(false)
      window.location.reload() // Refresh to show updated state
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
      >
        🔄 Reset ROSCA & Start New Round
      </button>
    )
  }

  return (
    <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6">
      <p className="text-orange-900 font-bold mb-2 text-lg">
        ⚠️ Reset ROSCA Confirmation
      </p>
      <p className="text-sm text-orange-800 mb-4">
        This will reset all <strong>{totalMembers} members</strong> so everyone can participate in new cycles again. 
        All payment history will be preserved.
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          disabled={loading}
          className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold rounded-lg transition"
        >
          {loading ? 'Resetting...' : 'Yes, Reset & Start Fresh'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { startNewCycle } from '@/app/dashboard/groups/[id]/actions'

export default function StartCycleButton({ groupId }: { groupId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartCycle = async () => {
    if (!confirm('Start a new cycle for this group?')) return

    setLoading(true)
    setError('')

    const result = await startNewCycle(groupId)

    if (result.error) {
      setError(result.error)
    }

    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handleStartCycle}
        disabled={loading}
        className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50"
      >
        {loading ? 'Starting...' : '🚀 Start New Cycle'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

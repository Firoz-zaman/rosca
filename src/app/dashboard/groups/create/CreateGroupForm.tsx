'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CreateGroupFormProps {
  createGroup: (formData: FormData) => Promise<{ error?: string }>
}

export default function CreateGroupForm({ createGroup }: CreateGroupFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createGroup(formData)

    if (result?.error) {
      alert(result.error)
      setLoading(false)
    }
    // If successful, the server action will redirect
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M15 19l-7-7 7-7"></path>
          </svg>
          <span>Back</span>
        </button>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          Create New Group
        </h2>
        <p className="text-slate-600">Set up your chitfund group</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Group Name *
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g., Family Fund"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Description
          </label>
          <textarea
            name="description"
            placeholder="Brief description of the group"
            rows={3}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
          />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Contribution Amount (₹) *
          </label>
          <input
            type="number"
            name="amount"
            required
            placeholder="5000"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Frequency *
          </label>
          <select
            name="frequency"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Total Members *
          </label>
          <input
            type="number"
            name="totalSlots"
            required
            min="2"
            placeholder="12"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Allocation Method *
          </label>
          <select
            name="allocationMethod"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
          >
            <option value="random">Random Draw</option>
            <option value="bidding">Bidding</option>
            <option value="banker">Banker Managed</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-400 disabled:to-purple-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:transform-none disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Group...
            </span>
          ) : (
            'Create Group'
          )}
        </button>
      </form>
    </div>
  )
}

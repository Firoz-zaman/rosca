'use client'

import { useState } from 'react'
import { saveWinnerPaymentDetails } from '@/app/dashboard/groups/[id]/cycle-actions'

interface WinnerPaymentDetailsFormProps {
  cycle: any
  groupId: string
}

type PaymentMethodType = 'UPI' | 'Bank' | 'Crypto' | 'PayPal' | 'Cash' | 'Other'

export default function WinnerPaymentDetailsForm({ cycle, groupId }: WinnerPaymentDetailsFormProps) {
  // Fixed to Bank Transfer only
  const [methodType] = useState<PaymentMethodType>('Bank')
  const [instructions, setInstructions] = useState(cycle.payment_instructions || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // UK Bank Transfer fields only
  const [accountNumber, setAccountNumber] = useState(cycle.payment_details?.account_number || '')
  const [ifsc, setIfsc] = useState(cycle.payment_details?.ifsc || '') // Sort Code
  const [accountName, setAccountName] = useState(cycle.payment_details?.account_name || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Only Bank Transfer supported
    const details = {
      account_number: accountNumber.trim(),
      ifsc: ifsc.trim(), // Sort code stored in ifsc field
      account_name: accountName.trim(),
    }

    const result = await saveWinnerPaymentDetails(cycle.id, groupId, {
      methodType: 'Bank',
      details,
      instructions: instructions.trim(),
    })

    setLoading(false)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Payment details saved successfully!' })
    }
  }

  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🏆</span>
        <div>
          <h3 className="text-lg font-bold text-green-900">You're the Winner of Cycle {cycle.cycle_number}!</h3>
          <p className="text-sm text-green-700">
            Provide your payment details so members know where to send £{cycle.winning_bid_amount?.toLocaleString('en-GB')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Payment Method Label - Fixed to UK Bank Transfer */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900">
            💷 Payment Method: UK Bank Transfer
          </p>
        </div>

        {/* UK Bank Transfer Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account Holder Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="12345678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sort Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value)}
            placeholder="12-34-56"
            maxLength={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        {/* Additional Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Instructions (Optional)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder='e.g., "Please add ROSCA-Cycle7 in payment reference"'
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : cycle.payment_method_type ? 'Update Payment Details' : 'Save Payment Details'}
        </button>

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  )
}


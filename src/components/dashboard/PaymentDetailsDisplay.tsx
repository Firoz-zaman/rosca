'use client'

import { useState } from 'react'

interface PaymentDetailsDisplayProps {
  cycle: any
  group: any
}

export default function PaymentDetailsDisplay({ cycle, group }: PaymentDetailsDisplayProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!cycle.payment_method_type || !cycle.payment_details) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
        <p className="text-yellow-800 font-medium">⏳ Waiting for winner to provide payment details...</p>
      </div>
    )
  }

  const renderCopyButton = (text: string, fieldName: string) => (
    <button
      onClick={() => copyToClipboard(text, fieldName)}
      className="ml-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1"
    >
      {copiedField === fieldName ? (
        <>
          <span>✓</span> Copied
        </>
      ) : (
        <>
          <span>📋</span> Copy
        </>
      )}
    </button>
  )

  const details = cycle.payment_details

  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
      <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
        <span>💷</span> Payment Details - Send to Winner
      </h4>
      
      <div className="space-y-3">
        {/* UK Bank Transfer Details Only */}
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-gray-600 mb-2">Account Holder Name</p>
          <div className="flex items-center justify-between">
            <p className="text-lg text-blue-900">{details.account_name}</p>
            {renderCopyButton(details.account_name, 'accountname')}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-gray-600 mb-2">Account Number</p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-mono text-blue-900">{details.account_number}</p>
            {renderCopyButton(details.account_number, 'account')}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-gray-600 mb-2">Sort Code</p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-mono text-blue-900">{details.ifsc}</p>
            {renderCopyButton(details.ifsc, 'sortcode')}
          </div>
        </div>

        {/* Instructions */}
        {cycle.payment_instructions && (
          <div className="bg-white rounded-lg p-4 border border-blue-200 mt-4">
            <p className="text-sm font-medium text-gray-600 mb-1">📝 Instructions from Winner</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{cycle.payment_instructions}</p>
          </div>
        )}

        {/* Your Share Box */}
        <div className="bg-blue-100 rounded-lg p-3 mt-4">
          <p className="text-sm text-blue-800">
            <strong>Your Share:</strong> £{(cycle.winning_bid_amount / group.total_slots)?.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            (Total pot: £{cycle.winning_bid_amount?.toLocaleString('en-GB')} ÷ {group.total_slots} members)
          </p>
        </div>
      </div>
    </div>
  )
}

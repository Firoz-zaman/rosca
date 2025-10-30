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
      setTimeout(() => setCopiedField(null), 2000) // Reset after 2 seconds
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

  const renderDetails = () => {
    const details = cycle.payment_details

    switch (cycle.payment_method_type) {
      case 'UPI':
        return (
          <>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">UPI ID</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-mono text-blue-900">{details.upi_id}</p>
                {renderCopyButton(details.upi_id, 'upi')}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Phone Number</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-mono text-blue-900">{details.phone}</p>
                {renderCopyButton(details.phone, 'phone')}
              </div>
            </div>
            <p className="text-sm text-gray-600">💡 Use Google Pay, PhonePe, Paytm, or any UPI app</p>
          </>
        )

      case 'Bank':
        return (
          <>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Account Number</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-mono text-blue-900">{details.account_number}</p>
                {renderCopyButton(details.account_number, 'account')}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">IFSC / Routing</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-mono text-blue-900">{details.ifsc}</p>
                {renderCopyButton(details.ifsc, 'ifsc')}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Bank Name</p>
              <p className="text-lg text-blue-900">{details.bank_name}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Account Holder</p>
              <p className="text-lg text-blue-900">{details.account_name}</p>
            </div>
          </>
        )

      case 'Crypto':
        return (
          <>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Currency & Network</p>
              <p className="text-lg text-blue-900">{details.currency} ({details.network})</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Wallet Address</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-mono text-blue-900 break-all flex-1">{details.address}</p>
                {renderCopyButton(details.address, 'crypto')}
              </div>
            </div>
            <p className="text-sm text-red-600">⚠️ Double-check address before sending - crypto transfers are irreversible!</p>
          </>
        )

      case 'PayPal':
        return (
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-medium text-gray-600 mb-2">PayPal Email</p>
            <div className="flex items-center justify-between">
              <p className="text-lg font-mono text-blue-900">{details.email}</p>
              {renderCopyButton(details.email, 'paypal')}
            </div>
          </div>
        )

      case 'Cash':
        return (
          <>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Collection Location</p>
              <p className="text-lg text-blue-900">{details.location}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Contact Number</p>
              <div className="flex items-center justify-between">
                <p className="text-lg font-mono text-blue-900">{details.contact}</p>
                {renderCopyButton(details.contact, 'contact')}
              </div>
            </div>
            <p className="text-sm text-gray-600">💵 Collect and pay in cash at the specified location</p>
          </>
        )

      case 'Other':
        return (
          <>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Method</p>
              <p className="text-lg text-blue-900">{details.method}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Details</p>
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg text-blue-900 whitespace-pre-wrap flex-1">{details.details}</p>
                {renderCopyButton(details.details, 'other')}
              </div>
            </div>
          </>
        )
    }
  }

  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
      <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
        <span>💳</span> Payment Details - Send to Winner
      </h4>
      
      <div className="space-y-3">
        {renderDetails()}

        {cycle.payment_instructions && (
          <div className="bg-white rounded-lg p-4 border border-blue-200 mt-4">
            <p className="text-sm font-medium text-gray-600 mb-1">📝 Instructions from Winner</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{cycle.payment_instructions}</p>
          </div>
        )}

            <div className="bg-blue-100 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-800">
                 <strong>Your Share:</strong> ₹{(cycle.winning_bid_amount / group.total_slots)?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                        (Total pot: ₹{cycle.winning_bid_amount?.toLocaleString('en-IN')} ÷ {group.total_slots} members)
                </p>
            </div>

      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { verifyPayment } from '@/app/dashboard/groups/[id]/cycle-actions'
import { createClient } from '@/lib/supabase/client'

/**
 * VerificationPanel - For payout receiver to verify payments
 * Shows popup with all members and their payment status
 * Receiver can click "Verify" for each member
 */
export default function VerificationPanel({ 
  cycle, 
  groupId 
}: { 
  cycle: any
  groupId: string 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchPayments()
    }
  }, [isOpen])

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('cycle_payments')
      .select(`
        *,
        member:rosca_members!inner(
          user_id,
          slot_number,
          profiles(full_name, username)
        )
      `)
      .eq('cycle_id', cycle.id)
      .order('member.slot_number', { ascending: true })

    setPayments(data || [])
  }

  const handleVerify = async (memberId: string) => {
    setLoading(memberId)
    await verifyPayment(cycle.id, memberId, groupId)
    await fetchPayments()
    setLoading(null)
  }

  const paidCount = payments.filter(p => p.has_paid).length
  const verifiedCount = payments.filter(p => p.verified_by_receiver).length

  return (
    <>
      {/* Verification Button */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Payment Verification
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {verifiedCount}/{payments.length} payments verified
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-600">
              {paidCount}/{payments.length}
            </p>
            <p className="text-xs text-gray-500">Marked Paid</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          View & Verify Payments
        </button>
      </div>

      {/* Popup Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  Verify Payments
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Click verify for members who paid you
              </p>
            </div>

            {/* Payment List */}
            <div className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
              {payments.map((payment) => {
                const member = payment.member
                const isVerified = payment.verified_by_receiver
                const hasPaid = payment.has_paid

                return (
                  <div
                    key={payment.id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      isVerified 
                        ? 'bg-green-50 border-green-300'
                        : hasPaid
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {/* Member Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-semibold text-gray-700">
                          {member.slot_number}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {member.profiles?.full_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {hasPaid ? (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                ✓ Marked Paid
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded">
                                ⏳ Not Paid
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Verify Button */}
                      {!isVerified && hasPaid ? (
                        <button
                          onClick={() => handleVerify(member.id)}
                          disabled={loading === member.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {loading === member.id ? 'Verifying...' : 'Verify ✓'}
                        </button>
                      ) : isVerified ? (
                        <span className="text-green-600 font-semibold">
                          ✓ Verified
                        </span>
                      ) : (
                        <button
                          disabled
                          className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                        >
                          Verify ✓
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

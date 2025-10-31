'use client'

import { useState, useEffect } from 'react'
import { markPaymentMade } from '@/app/dashboard/groups/[id]/cycle-actions'
import { createClient } from '@/lib/supabase/client'

/**
 * PaymentTracker - Shows payment status for current user
 * Allows member to mark "I Paid"
 * Shows if receiver has verified the payment
 */
export default function PaymentTracker({ 
  cycle, 
  currentUser, 
  isReceiver,
  group  // ← ADD THIS
}: any) {

  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

useEffect(() => {
  console.log('🔄 PaymentTracker mounted. Cycle:', cycle)
  console.log('👤 Current user:', currentUser)
  console.log('🏢 Group:', group)
  fetchPaymentStatus()
  // ... rest of existing code

    
    // Real-time subscription for payment updates
    const channel = supabase
      .channel(`payment-${cycle.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cycle_payments',
          filter: `cycle_id=eq.${cycle.id}`
        },
        () => {
          fetchPaymentStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycle.id])

const fetchPaymentStatus = async () => {
  // Step 1: Get current user's member record
  const { data: member } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', cycle.rosca_id)
    .eq('user_id', currentUser.id)
    .single()

  if (!member) {
    setPayment(null)
    return
  }

  // Step 2: Get payment record using member_id
  const { data } = await supabase
    .from('cycle_payments')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('member_id', member.id)
    .single()

  setPayment(data)
}


const handleMarkPaid = async () => {
  console.log('🔘 Button clicked! Cycle:', cycle.id, 'Rosca:', cycle.rosca_id)
  setLoading(true)
  
  // ✅ Optimistic UI update - immediately mark as paid
  const previousPayment = payment
  setPayment({ ...payment, has_paid: true })
  
  const result = await markPaymentMade(cycle.id, cycle.rosca_id)
  console.log('📥 Result from markPaymentMade:', result)
  
  // ✅ If error, revert the optimistic update
  if (result?.error) {
    console.error('❌ Failed to mark payment:', result.error)
    setPayment(previousPayment)
  }
  
  setLoading(false)
}



  if (isReceiver) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xl">👑</span>
          </div>
          <div>
            <p className="font-semibold text-green-900">You are the receiver</p>
            <p className="text-sm text-green-700">
              Collect payments from all members
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Your Payment Status
      </h3>

      {!payment?.has_paid ? (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 mb-3">
              💰 Please send ₹{(cycle.winning_bid_amount / group.total_slots)?.toLocaleString('en-IN')} to the receiver
            </p>

          <button
            onClick={handleMarkPaid}
            disabled={loading || payment?.has_paid}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Marking...' : '✓ I Paid'}
          </button>

          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Paid Confirmation */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✓</span>
              <span className="font-semibold text-green-900">
                Payment Marked
              </span>
            </div>
            <p className="text-sm text-green-700">
              You marked this payment as completed
            </p>
          </div>

          {/* Verification Status */}
          {payment.verified_by_receiver ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <span className="font-semibold text-blue-900">
                  Verified by Receiver
                </span>
              </div>
            </div>
          ) : payment.verified_by_admin ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <span className="font-semibold text-purple-900">
                  Verified by Admin
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                ⏳ Waiting for receiver to verify...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

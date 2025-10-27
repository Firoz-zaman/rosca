'use client'

import { useState, useEffect } from 'react'
import { adminVerifyPayment } from '@/app/dashboard/groups/[id]/cycle-actions'
import { createClient } from '@/lib/supabase/client'

/**
 * AdminOverduePanel - Shows after payment deadline
 * Only visible to admins
 * Lists unverified payments for manual admin verification
 */
export default function AdminOverduePanel({ 
  cycle, 
  groupId 
}: { 
  cycle: any
  groupId: string 
}) {
  const [unpaidMembers, setUnpaidMembers] = useState<any[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUnpaidMembers()

    // Real-time updates
    const channel = supabase
      .channel(`overdue-${cycle.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cycle_payments',
          filter: `cycle_id=eq.${cycle.id}`
        },
        () => {
          fetchUnpaidMembers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycle.id])

  const fetchUnpaidMembers = async () => {
    // Get members who haven't been verified (by receiver or admin)
    const { data } = await supabase
      .from('cycle_payments')
      .select(`
        *,
        member:rosca_members!inner(
          slot_number,
          profiles(full_name, username, phone)
        )
      `)
      .eq('cycle_id', cycle.id)
      .eq('verified_by_receiver', false)
      .eq('verified_by_admin', false)
      .order('member.slot_number', { ascending: true })

    setUnpaidMembers(data || [])
  }

  const handleAdminVerify = async (memberId: string) => {
    setLoading(memberId)
    await adminVerifyPayment(cycle.id, memberId, groupId)
    setLoading(null)
  }

  if (unpaidMembers.length === 0) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
        <div className="text-center">
          <span className="text-4xl mb-2 block">🎉</span>
          <p className="font-semibold text-green-900">All Payments Verified!</p>
          <p className="text-sm text-green-700 mt-1">
            No pending verifications
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-lg overflow-hidden">
      {/* Warning Header */}
      <div className="bg-red-100 p-4 border-b border-red-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-900">
              Admin Action Required
            </p>
            <p className="text-sm text-red-700">
              {unpaidMembers.length} unverified payment{unpaidMembers.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Unpaid Members List */}
      <div className="p-4 space-y-3">
        {unpaidMembers.map((payment) => {
          const member = payment.member

          return (
            <div
              key={payment.id}
              className="bg-white border-2 border-red-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                {/* Member Info */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-semibold text-sm">
                      {member.slot_number}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {member.profiles?.full_name}
                    </p>
                  </div>
                  
                  {/* Status */}
                  <div className="ml-11">
                    {payment.has_paid ? (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        Marked Paid • Awaiting Receiver Verification
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                        Not Paid
                      </span>
                    )}
                    
                    {member.profiles?.phone && (
                      <p className="text-xs text-gray-500 mt-1">
                        📞 {member.profiles.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Admin Verify Button */}
                <button
                  onClick={() => handleAdminVerify(payment.member_id)}
                  disabled={loading === payment.member_id}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading === payment.member_id ? (
                    'Verifying...'
                  ) : (
                    <>
                      <span>⭐</span>
                      <span>Admin Verify</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

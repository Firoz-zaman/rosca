'use client'

import { useState, useEffect } from 'react'
import BiddingBox from './BiddingBox'
import PaymentTracker from './PaymentTracker'
import ActivityFeed from './ActivityFeed'
import VerificationPanel from './VerificationPanel'
import AdminOverduePanel from './AdminOverduePanel'
import StartBiddingButton from './StartBiddingButton'
import EndBiddingButton from './EndBiddingButton'
import EndPaymentButton from './EndpaymentButton'
import WinnerPaymentDetailsForm from './WinnerPaymentDetailsForm'
import PaymentDetailsDisplay from './PaymentDetailsDisplay'

/**
 * CycleManager - Main container for current cycle
 * Shows different UI based on:
 * - Cycle status (pending/bidding/payment/overdue/completed)
 * - Allocation method (bidding/random/banker)
 * - User role (member/receiver/admin)
 */
export default function CycleManager({
  cycle,
  group,
  currentUser,
  isAdmin,
  isReceiver,
  hasMemberReceived,
}: {
  cycle: any
  group: any
  currentUser: any
  isAdmin: boolean
  isReceiver: boolean
  hasMemberReceived: boolean
}) {
  const [activeTab, setActiveTab] = useState('payment') // 'payment' | 'activity'

  // Added countdown timer state
  const [timeLeft, setTimeLeft] = useState('')

  // Set deadline dynamically based on cycle status
  const deadline = new Date(
    cycle.status === 'bidding' ? '2025-12-03T17:00:00Z' : '2025-12-06T17:00:00Z'
  ).getTime()

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime()
      const distance = deadline - now

      if (distance < 0) {
        clearInterval(interval)
        setTimeLeft('Deadline passed')
        return
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
    }, 1000)

    return () => clearInterval(interval)
  }, [deadline])

  // Status checks
  const isPending = cycle.status === 'pending'
  const isBidding = cycle.status === 'bidding'
  const isPayment = cycle.status === 'payment'
  const isOverdue = cycle.status === 'overdue'
  const isCompleted = cycle.status === 'completed'

  // ✅ Check if user is actually a member (not just creator)
  const isMember = hasMemberReceived !== undefined // If has_received exists, they're a member
  const isCreator = group.created_by === currentUser.id

  // UI visibility
  const showBidding = group.allocation_method === 'bidding' && isBidding
  const showPayment = isPayment || isOverdue

  return (
    <div className="space-y-4">
      {/* Cycle Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Cycle {cycle.cycle_number}/{group.total_slots}</h2>
            <p className="text-blue-100 mt-1">
              {isPending && 'Waiting to start bidding phase'}
              {isBidding && 'Bidding Phase Active'}
              {isPayment && 'Payment Phase - Send contributions'}
              {isOverdue && 'Payment Deadline Passed'}
              {isCompleted && 'Cycle Completed'}
            </p>
          </div>

          <div className="text-right">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              isPending ? 'bg-gray-400 text-gray-900' :
              isBidding ? 'bg-yellow-400 text-yellow-900' :
              isPayment ? 'bg-green-400 text-green-900' :
              isOverdue ? 'bg-red-400 text-red-900' :
              'bg-blue-400 text-blue-900'
            }`}>
              {cycle.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* 🔥 DEADLINE BOX - Shows based on cycle phase 🔥 */}
      {isBidding && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⏰</span>
              <div className="flex-1">
                <p className="text-xs text-yellow-700 uppercase tracking-wide mb-1">
                  03 December 2025 (Wednesday), 5:00 PM GMT
                </p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">
                {timeLeft}
                </p>
            </div>
          </div>
        </div>
      )}

      {(isPayment || isOverdue) && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚠️</span>

              <div className="flex-1">
                <p className="text-xs text-red-700 uppercase tracking-wide mb-1">
                  06 December 2025 (Saturday), 5:00 PM GMT
                </p>
                  <p className="text-2xl font-bold text-red-900 mt-1">
                    {timeLeft}
                  </p>
              <p className="text-xs text-red-700 mt-2">
              All payments must be verified before this date
              </p>
            </div>
          </div>
        </div>
      )}




      {/* Admin Control Panel - Shows different button based on status */}
      {(isAdmin || group.created_by === currentUser.id) && (
        <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Admin Controls</h3>


          {/* Status: PENDING - Show Start Bidding Button */}
          {isPending && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Ready to start the cycle? Click below to open bidding for members.
              </p>
              <StartBiddingButton cycleId={cycle.id} groupId={group.id} />
            </div>
          )}


          {/* Status: BIDDING - Show End Bidding Button */}
          {isBidding && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Bidding is open. When ready, end bidding to select winner and start payment phase.
              </p>
              <EndBiddingButton cycleId={cycle.id} groupId={group.id} />
            </div>
          )}


          {/* Status: PAYMENT - Show Complete Cycle Button */}
          {(isPayment || isOverdue) && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Once all payments are verified, complete the cycle to move to the next round.
              </p>
              <EndPaymentButton cycleId={cycle.id} groupId={group.id} />
            </div>
          )}


          {/* Status: COMPLETED */}
          {isCompleted && (
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-green-700 font-medium">
                ✅ Cycle {cycle.cycle_number} completed successfully!
              </p>
              <p className="text-sm text-gray-600 mt-2">
                You can start a new cycle when ready.
              </p>
            </div>
          )}
        </div>
      )}


      {/* Pending State - Info for regular members (non-admins, non-creators) */}
      {isPending && !isAdmin && group.created_by !== currentUser.id && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">
            ⏳ Waiting for admin to start bidding phase...
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            You'll be notified when bidding opens.
          </p>
        </div>
      )}


      {/* ✅ FIXED: Bidding Box - Show to members OR admins (even non-participating) */}
      {showBidding && (isMember ? !hasMemberReceived : isCreator || isAdmin) && (
        <BiddingBox 
          cycle={cycle} 
          group={group} 
          currentUser={currentUser} 
        />
      )}


      {/* Tab Navigation */}
      {!isPending && (
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'activity'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Activity Feed
          </button>


          {showPayment && (
            <button
              onClick={() => setActiveTab('payment')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'payment'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💰 Payments
            </button>
          )}
        </div>
      )}


      {/* Content */}
      {!isPending && (
        <>
          {/* ✅ FIXED: Activity Feed - Always show (no member check) */}
          {activeTab === 'activity' && <ActivityFeed cycleId={cycle.id} />}


          {/* Payment Tab */}
          {activeTab === 'payment' && showPayment && (
            <div className="space-y-4">
              {/* ✅ NEW: Winner Payment Details Form - Only show to winner */}
              {isReceiver && (
                <WinnerPaymentDetailsForm cycle={cycle} groupId={group.id} />
              )}


              {/* ✅ NEW: Display Payment Details to Other Members */}
              {!isReceiver && isMember && (


               <PaymentDetailsDisplay cycle={cycle} group={group} />
              )}


              {/* ✅ FIXED: Payment Tracker - Only for actual members who are participants */}
              {isMember && (


                <PaymentTracker
                  cycle={cycle}
                  currentUser={currentUser}
                  isReceiver={isReceiver}
                  group={group}
                />
              )}


              {/* Verification Panel for receiver */}
              {isReceiver && !isOverdue && (
                <VerificationPanel cycle={cycle} groupId={group.id} />
              )}


              {/* Admin Panel for overdue payments */}
              {isAdmin && isOverdue && (
                <AdminOverduePanel cycle={cycle} groupId={group.id} />
              )}


              {/* ✅ FIXED: Non-participating admin view - with verification panel */}
              {!isMember && (isCreator || isAdmin) && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <p className="text-blue-900 font-semibold">
                        Managing as Banker (Non-Participant)
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        You're managing this group without participating in payments.
                      </p>
                    </div>
                  </div>


                  
                  {/* Allow admin to verify payments even if not participating */}
                  {!isOverdue && (
                    <div className="mt-4">
                      <VerificationPanel cycle={cycle} groupId={group.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}






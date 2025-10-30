'use client'

import { useState } from 'react'
import BiddingBox from './BiddingBox'
import PaymentTracker from './PaymentTracker'
import ActivityFeed from './ActivityFeed'
import VerificationPanel from './VerificationPanel'
import AdminOverduePanel from './AdminOverduePanel'
import StartBiddingButton from './StartBiddingButton'
import EndBiddingButton from './EndBiddingButton'
import EndPaymentButton from './EndpaymentButton'

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
  const [activeTab, setActiveTab] = useState('activity') // 'payment' | 'activity'

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
            <h2 className="text-2xl font-bold">Cycle {cycle.cycle_number}</h2>
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
              {/* ✅ FIXED: Payment Tracker - Only for actual members who are participants */}
              {isMember && !(!group.creatorparticipates && isCreator) && (
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
                    <VerificationPanel cycle={cycle} groupId={group.id} />
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
  




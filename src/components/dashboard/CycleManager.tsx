'use client'

import { useState } from 'react'
import BiddingBox from './BiddingBox'
import PaymentTracker from './PaymentTracker'
import ActivityFeed from './ActivityFeed'
import VerificationPanel from './VerificationPanel'
import AdminOverduePanel from './AdminOverduePanel'

/**
 * CycleManager - Main container for current cycle
 * Shows different UI based on:
 * - Cycle status (bidding/payment/overdue)
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
  const [activeTab, setActiveTab] = useState<'activity' | 'payment'>('activity')

  // Don't show bidding UI for non-bidding groups
  const showBidding = group.allocation_method === 'bidding' && cycle.status === 'bidding'
  const showPayment = cycle.status === 'payment' || cycle.status === 'overdue'
  const isOverdue = cycle.status === 'overdue'

  return (
    <div className="space-y-4">
      {/* Cycle Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Cycle {cycle.cycle_number}</h2>
            <p className="text-blue-100 mt-1">
              {cycle.status === 'bidding' && 'Bidding Phase Active'}
              {cycle.status === 'payment' && 'Payment Phase - Send contributions'}
              {cycle.status === 'overdue' && '⚠️ Payment Deadline Passed'}
              {cycle.status === 'completed' && '✓ Cycle Completed'}
            </p>
          </div>
          
          <div className="text-right">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              cycle.status === 'bidding' ? 'bg-yellow-400 text-yellow-900' :
              cycle.status === 'payment' ? 'bg-green-400 text-green-900' :
              cycle.status === 'overdue' ? 'bg-red-400 text-red-900' :
              'bg-gray-400 text-gray-900'
            }`}>
              {cycle.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Bidding Box (only for bidding allocation + active bidding) */}
      {showBidding && !hasMemberReceived && (
        <BiddingBox 
          cycle={cycle}
          group={group}
          currentUser={currentUser}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-3 font-medium transition-colors ${
            activeTab === 'activity' 
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Activity Feed
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
            Payments
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'activity' && (
        <ActivityFeed cycleId={cycle.id} />
      )}

      {activeTab === 'payment' && showPayment && (
        <div className="space-y-4">
          {/* Payment Tracker for regular members */}
          <PaymentTracker 
            cycle={cycle}
            currentUser={currentUser}
            isReceiver={isReceiver}
          />

          {/* Verification Panel for receiver */}
          {isReceiver && !isOverdue && (
            <VerificationPanel cycle={cycle} groupId={group.id} />
          )}

          {/* Admin Panel for overdue payments */}
          {isAdmin && isOverdue && (
            <AdminOverduePanel cycle={cycle} groupId={group.id} />
          )}
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // ✅ FIXED: Fetch groups where user is a MEMBER
  const { data: memberGroups, error: memberError } = await supabase
    .from('rosca_members')
    .select(`
      rosca_id,
      has_received,
      roscas (
        id,
        name,
        contribution_amount,
        frequency,
        start_date,
        status,
        total_slots,
        allocation_method,
        created_by
      )
    `)
    .eq('user_id', user.id)

  console.log('📦 Raw memberGroups:', memberGroups)

  // Filter out null roscas before mapping
  const memberGroupsList = memberGroups
    ?.filter((g: any) => g.roscas !== null)
    ?.map((g: any) => ({
      ...g.roscas,
      has_received: g.has_received,
      is_member: true
    })) || []

  // ✅ NEW: Also fetch groups where user is CREATOR but NOT a member
  const memberGroupIds = memberGroupsList.map((g: any) => g.id)
  
  const { data: createdGroups } = await supabase
    .from('roscas')
    .select('*')
    .eq('created_by', user.id)
    .not('id', 'in', memberGroupIds.length > 0 ? `(${memberGroupIds.join(',')})` : '()')

  console.log('👤 Created (non-member) groups:', createdGroups)

  // Combine both lists
  const userGroups = [
    ...memberGroupsList,
    ...(createdGroups?.map((g: any) => ({
      ...g,
      has_received: false, // Creator not participating = never receives
      is_member: false
    })) || [])
  ]

  console.log('✅ All userGroups:', userGroups)

  // Fetch active cycles for user's groups
  const groupIds = userGroups.map((g: any) => g.id)
  
  const { data: activeCycles } = groupIds.length > 0 ? await supabase
    .from('payment_cycles')
    .select('*')
    .in('rosca_id', groupIds)
    .in('status', ['bidding', 'payment', 'overdue'])
    : { data: [] }

  // Fetch user's payment statuses for active cycles (only for member groups)
  const memberGroupIdsList = memberGroupsList.map((g: any) => g.id)
  const cycleIds = activeCycles
    ?.filter((c: any) => memberGroupIdsList.includes(c.rosca_id))
    .map((c: any) => c.id) || []
  
  const { data: userPayments } = cycleIds.length > 0 ? await supabase
    .from('cycle_payments')
    .select(`
      cycle_id,
      has_paid,
      verified_by_receiver,
      member:rosca_members!inner(user_id)
    `)
    .in('cycle_id', cycleIds)
    .eq('member.user_id', user.id)
    : { data: [] }

  // Create a map of cycle info by rosca_id
  const cyclesByRosca = new Map()
  activeCycles?.forEach((cycle: any) => {
    const payment = userPayments?.find((p: any) => p.cycle_id === cycle.id)
    cyclesByRosca.set(cycle.rosca_id, {
      ...cycle,
      userPayment: payment
    })
  })

  // Get pending action for each group
  const getGroupAction = (group: any) => {
    // ✅ NEW: Non-member creators have no actions, just manage
    if (!group.is_member) {
      return {
        type: 'manage',
        text: 'Manage group',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        urgent: false
      }
    }

    const cycle = cyclesByRosca.get(group.id)
    if (!cycle) return null

    const isReceiver = cycle.winner_id === user.id
    const payment = cycle.userPayment

    // Priority 1: Bidding (if member hasn't received yet)
    if (cycle.status === 'bidding' && !group.has_received && group.allocation_method === 'bidding') {
      return {
        type: 'bid',
        text: 'Place your bid',
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        urgent: true
      }
    }

    // Priority 2: Payment needed
    if ((cycle.status === 'payment' || cycle.status === 'overdue') && !isReceiver && !payment?.has_paid) {
      return {
        type: 'pay',
        text: 'Payment pending',
        color: 'bg-red-100 text-red-700 border-red-300',
        urgent: true
      }
    }

    // Priority 3: Receiver needs to verify
    if (cycle.status === 'payment' && isReceiver) {
      return {
        type: 'verify',
        text: 'Verify payments',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        urgent: false
      }
    }

    // Payment made, waiting for verification
    if (payment?.has_paid && !payment?.verified_by_receiver) {
      return {
        type: 'waiting',
        text: 'Awaiting verification',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        urgent: false
      }
    }

    // All good
    if (payment?.verified_by_receiver) {
      return {
        type: 'verified',
        text: 'Payment verified',
        color: 'bg-green-100 text-green-700 border-green-300',
        urgent: false
      }
    }

    return null
  }

  // Calculate stats
  const totalGroups = userGroups.length
  const activeGroups = userGroups.filter((g: any) => g.status === 'active').length
  const pendingActions = userGroups.filter((g: any) => {
    const action = getGroupAction(g)
    return action?.urgent
  }).length

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          Welcome back, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}! 👋
        </h2>
        <p className="text-slate-600">
          Manage your ROSCA groups
          {isAdmin && (
            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
              Admin
            </span>
          )}
        </p>
      </div>

      {/* Quick Stats */}
      {totalGroups > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{totalGroups}</p>
            <p className="text-xs text-blue-100 mt-1">Total Groups</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{activeGroups}</p>
            <p className="text-xs text-green-100 mt-1">Active</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{pendingActions}</p>
            <p className="text-xs text-red-100 mt-1">Action Needed</p>
          </div>
        </div>
      )}

      {/* Create Group Button - Only show to admins */}
      {isAdmin && (
        <Link href="/dashboard/groups/create">
          <button className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]">
            <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 4v16m8-8H4"></path>
            </svg>
            <span>Create New Group</span>
          </button>
        </Link>
      )}

      {/* Groups List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          My Groups ({userGroups.length})
        </h3>

        {userGroups.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <p className="text-slate-600 font-medium mb-2">No groups yet</p>
            <p className="text-slate-500 text-sm">
              {isAdmin 
                ? 'Create your first chitfund group to get started' 
                : 'Wait for an admin to add you to a group'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {userGroups.map((group: any) => {
              const action = getGroupAction(group)
              const cycle = cyclesByRosca.get(group.id)

              return (
                <Link 
                  key={group.id} 
                  href={`/dashboard/groups/${group.id}`}
                  className={`block bg-white rounded-xl p-5 shadow-sm border transition-all hover:shadow-md ${
                    action?.urgent 
                      ? 'border-red-300 hover:border-red-400' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-bold text-slate-900">
                          {group.name}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded capitalize ${
                          group.status === 'active' 
                            ? 'bg-green-100 text-green-700'
                            : group.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {group.status}
                        </span>
                        {/* ✅ NEW: Show banker badge for non-participating creators */}
                        {!group.is_member && group.created_by === user.id && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                            👤 Banker
                          </span>
                        )}
                      </div>

                      {/* Action Badge */}
                      {action && (
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-xs font-semibold ${action.color}`}>
                          {action.text}
                          {action.urgent && (
                            <span className="animate-pulse">●</span>
                          )}
                        </div>
                      )}

                      {/* Cycle Info */}
                      {cycle && (
                        <p className="text-xs text-slate-500 mt-2">
                          Cycle {cycle.cycle_number} • {cycle.status === 'bidding' ? '🎯 Bidding' : cycle.status === 'payment' ? '💰 Payment' : '⚠️ Overdue'}
                        </p>
                      )}
                    </div>

                    {/* Group Icon */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                      </svg>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Contribution</p>
                      <p className="text-lg font-bold text-slate-900">
                        ₹{Number(group.contribution_amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Frequency</p>
                      <p className="text-sm font-semibold text-blue-600 capitalize">
                        {group.frequency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Members</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {group.total_slots}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}








import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupDetails from '@/components/dashboard/GroupDetails'
import MembersList from '@/components/dashboard/MembersList'
import AddMemberButton from '@/components/dashboard/AddMemberButton'
import StartCycleButton from '@/components/dashboard/StartCycleButton'
import CycleManager from '@/components/dashboard/CycleManager'

/**
 * Group Detail Page - Displays full information about a ROSCA group
 * Dynamic route: /dashboard/groups/[id]
 */
export default async function GroupPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  
  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login')
  }

  // Fetch group details
  const { data: group, error: groupError } = await supabase
    .from('roscas')
    .select(`
      id,
      name,
      description,
      contribution_amount,
      frequency,
      total_slots,
      status,
      allocation_method,
      start_date,
      created_by,
      created_at
    `)
    .eq('id', id)
    .single()

  if (groupError || !group) {
    redirect('/dashboard')
  }

  // Fetch all members
  // Fetch members without nested profile join
  const { data: membersData, error: membersError } = await supabase
    .from('rosca_members')
    .select(`
      id,
      slot_number,
      has_received,
      joined_at,
      user_id
    `)
    .eq('rosca_id', id)
    .order('slot_number', { ascending: true })

  // Fetch all profiles separately in one query
  const memberIds = membersData?.map(m => m.user_id) || []
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, phone, email')
    .in('id', memberIds)

  // Combine members with their profiles
  const members = membersData?.map(member => {
    const profile = profiles?.find(p => p.id === member.user_id)
    return {
      ...member,
      profiles: profile || null
    }
  }) || []

  // Check permissions
  const isCreator = user.id === group.created_by
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  const isAdmin = profile?.role === 'admin'

  // Get current user's member record
  const currentMember = members?.find(m => m.user_id === user.id)
  const hasMemberReceived = currentMember?.has_received || false

  // Fetch active cycle
  const { data: activeCycle } = await supabase
    .from('payment_cycles')
    .select('*')
    .eq('rosca_id', id)
    .in('status', ['pending','bidding', 'payment', 'overdue'])
    .order('cycle_number', { ascending: false })
    .limit(1)
    .single()

  const isReceiver = activeCycle?.winner_id === user.id

  // Calculate available slots
  const availableSlots = group.total_slots - (members?.length || 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        
        {/* Group Information Card */}
        <GroupDetails 
          group={group} 
          availableSlots={availableSlots}
        />

        {/* Active Cycle Manager OR Start Cycle Button */}
        {activeCycle ? (
          <CycleManager
            cycle={activeCycle}
            group={group}
            currentUser={user}
            isAdmin={isAdmin}
            isReceiver={isReceiver}
            hasMemberReceived={hasMemberReceived}
          />
        ) : isCreator ? (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              No Active Cycle
            </h3>
            <p className="text-sm text-yellow-800 mb-4">
              Start the first cycle to begin bidding and payments
            </p>
            <StartCycleButton groupId={group.id} />
          </div>
        ) : (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 text-center">
            <p className="text-blue-800">
              Waiting for group creator to start the first cycle...
            </p>
          </div>
        )}

        {/* Members Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Members ({members?.length || 0}/{group.total_slots})
            </h2>
            
            {/* Only show Add Member button to group creator */}
            {isCreator && availableSlots > 0 && (
              <AddMemberButton groupId={group.id} />
            )}
          </div>

          {/* Members List */}
          <MembersList 
            members={members || []} 
            isCreator={isCreator}
          />
        </div>
      </div>
    </div>
  )
}

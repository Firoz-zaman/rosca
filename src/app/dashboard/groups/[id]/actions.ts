'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Add Member to Group Server Action
 * 
 * Security:
 * - Verifies user is authenticated
 * - Checks user is group creator (via RLS policy)
 * - Validates group has available slots
 * - Ensures user exists before adding
 * 
 * @param groupId - UUID of the ROSCA group
 * @param memberEmail - Email of user to add
 */
export async function addMemberToGroup(groupId: string, memberEmail: string) {
  const supabase = await createClient()
  
  // 1. Authenticate current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // 2. Verify group exists and user is creator
  const { data: group, error: groupError } = await supabase
    .from('roscas')
    .select('id, created_by, total_slots')
    .eq('id', groupId)
    .single()

  if (groupError || !group) {
    return { error: 'Group not found' }
  }

  if (group.created_by !== user.id) {
    return { error: 'Only group creator can add members' }
  }

  // 3. FIXED: Find user by email from auth.users metadata
  // First get all profiles to check against auth users
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, email')
  
  // Find the profile with matching email
  const memberProfile = allProfiles?.find(
    p => p.email?.toLowerCase() === memberEmail.trim().toLowerCase()
  )

  if (!memberProfile) {
    return { error: 'User not found. They must create an account first.' }
  }

  // 4. Check if user is already a member
  const { data: existingMember } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', groupId)
    .eq('user_id', memberProfile.id)
    .single()

  if (existingMember) {
    return { error: 'User is already a member of this group' }
  }

  // 5. Check available slots
  const { count: currentMembers } = await supabase
    .from('rosca_members')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  if (currentMembers !== null && currentMembers >= group.total_slots) {
    return { error: 'Group is full' }
  }

  // 6. Assign next available slot number
  const nextSlot = (currentMembers || 0) + 1

  // 7. Add member to group
  const { data: insertedMember, error: insertError } = await supabase
    .from('rosca_members')
    .insert({
      rosca_id: groupId,
      user_id: memberProfile.id,
      slot_number: nextSlot,
      has_received: false
    })
    .select()
    .single()

  if (insertError) {
    console.error('Insert error:', insertError)
    return { error: 'Failed to add member: ' + insertError.message }
  }

  console.log('✅ Member added successfully:', insertedMember)

  // 8. Revalidate page to show new member
  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { 
    success: true,
    memberName: memberProfile.email 
  }
}

/**
 * Start a new cycle for the group
 * Only group creator or admin can start cycles
 */
export async function startNewCycle(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get group details
  const { data: group } = await supabase
    .from('roscas')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) {
    return { error: 'Group not found' }
  }

  // Check if user is creator or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isCreator = group.created_by === user.id

  if (!isAdmin && !isCreator) {
    return { error: 'Only group creator or admin can start cycles' }
  }

  // Get current cycle count
  const { count: cycleCount } = await supabase
    .from('payment_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  const nextCycleNumber = (cycleCount || 0) + 1

  // Calculate dates based on frequency
  const now = new Date()
  let biddingEnd = new Date(now)
  let paymentDeadline = new Date(now)
  let cycleEnd = new Date(now)

  switch (group.frequency) {
    case 'daily':
      biddingEnd.setHours(now.getHours() + 12) // 12 hours bidding
      paymentDeadline.setHours(now.getHours() + 19) // 19 hours total
      cycleEnd.setDate(now.getDate() + 1)
      break
    case 'weekly':
      biddingEnd.setDate(now.getDate() + 3) // 3 days bidding
      paymentDeadline.setDate(now.getDate() + 5) // 5 days payment
      cycleEnd.setDate(now.getDate() + 7)
      break
    case 'monthly':
      biddingEnd.setDate(now.getDate() + 15) // 15 days bidding
      paymentDeadline.setDate(now.getDate() + 24) // 24 days payment
      cycleEnd.setMonth(now.getMonth() + 1)
      break
  }

  // Calculate starting bid (total pool amount)
  const totalAmount = group.contribution_amount * group.total_slots

  // Create cycle
  const { data: cycle, error: cycleError } = await supabase
    .from('payment_cycles')
    .insert({
      rosca_id: groupId,
      cycle_number: nextCycleNumber,
      status: group.allocation_method === 'bidding' ? 'bidding' : 'payment',
      bidding_start_date: now.toISOString(),
      bidding_end_date: biddingEnd.toISOString(),
      payment_deadline_date: paymentDeadline.toISOString(),
      cycle_end_date: cycleEnd.toISOString(),
      winning_bid_amount: totalAmount
    })
    .select()
    .single()

  if (cycleError) {
    return { error: 'Failed to create cycle: ' + cycleError.message }
  }

  // Create payment records for all members
  const { data: members } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', groupId)

  if (members && members.length > 0) {
    await supabase
      .from('cycle_payments')
      .insert(
        members.map((member) => ({
          cycle_id: cycle.id,
          member_id: member.id,
          has_paid: false,
          verified_by_receiver: false,
          verified_by_admin: false
        }))
      )
  }

  // Create activity log
  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycle.id,
      activity_type: 'cycle_started',
      user_id: user.id
    })

  // If bidding, create another activity
  if (group.allocation_method === 'bidding') {
    await supabase
      .from('cycle_activities')
      .insert({
        cycle_id: cycle.id,
        activity_type: 'bidding_opened',
        user_id: user.id
      })
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true, cycleNumber: nextCycleNumber }
}

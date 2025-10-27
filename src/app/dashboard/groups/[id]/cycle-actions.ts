'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Add Member to Group
 * Updated to search by email instead of username
 */
export async function addMemberToGroup(groupId: string, memberEmail: string) {
  const supabase = await createClient()
  
  // 1. Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // 2. Verify group and permissions
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

  // 3. Find user by email
  const { data: memberProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', memberEmail.toLowerCase().trim())
    .single()

  if (profileError || !memberProfile) {
    return { 
      error: 'User not found. They must sign up first at your app with this email: ' + memberEmail 
    }
  }

  // 4. Check if already a member
  const { data: existingMember } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', groupId)
    .eq('user_id', memberProfile.id)
    .single()

  if (existingMember) {
    return { error: `${memberProfile.full_name} is already a member of this group` }
  }

  // 5. Check available slots
  const { count: currentMembers } = await supabase
    .from('rosca_members')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  if (currentMembers !== null && currentMembers >= group.total_slots) {
    return { error: 'Group is full' }
  }

  // 6. Add member
  const nextSlot = (currentMembers || 0) + 1

  const { error: insertError } = await supabase
    .from('rosca_members')
    .insert({
      rosca_id: groupId,
      user_id: memberProfile.id,
      slot_number: nextSlot,
      has_received: false
    })

  if (insertError) {
    console.error('Insert error:', insertError)
    return { error: 'Failed to add member: ' + insertError.message }
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { 
    success: true, 
    memberName: memberProfile.full_name,
    memberEmail: memberProfile.email
  }
}

/**
 * Place a bid in the current cycle
 * 
 * Validations:
 * - User is a member of the group
 * - User hasn't received payout yet (has_received = false)
 * - Cycle is in 'bidding' status
 * - Bid amount is lower than current lowest bid
 */
export async function placeBid(cycleId: string, bidAmount: number, roscaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // 1. Check if user is member and hasn't received payout
  const { data: member } = await supabase
    .from('rosca_members')
    .select('id, has_received')
    .eq('rosca_id', roscaId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { error: 'You are not a member of this group' }
  }

  if (member.has_received) {
    return { error: 'You have already received payout and cannot bid again' }
  }

  // 2. Check cycle status
  const { data: cycle } = await supabase
    .from('payment_cycles')
    .select('status, winning_bid_amount')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.status !== 'bidding') {
    return { error: 'Bidding is not active for this cycle' }
  }

  // 3. Get current lowest bid
  const { data: lowestBid } = await supabase
    .from('cycle_bids')
    .select('bid_amount')
    .eq('cycle_id', cycleId)
    .order('bid_amount', { ascending: true })
    .limit(1)
    .single()

  const currentLowest = lowestBid?.bid_amount || cycle.winning_bid_amount

  // 4. Validate bid is lower
  if (bidAmount >= currentLowest) {
    return { error: `Bid must be lower than current lowest (₹${currentLowest})` }
  }

  // 5. Insert bid
  const { error: bidError } = await supabase
    .from('cycle_bids')
    .insert({
      cycle_id: cycleId,
      user_id: user.id,
      bid_amount: bidAmount
    })

  if (bidError) {
    return { error: 'Failed to place bid' }
  }

  // 6. Create activity log
  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'bid_placed',
      user_id: user.id,
      metadata: { bid_amount: bidAmount }
    })

  revalidatePath(`/dashboard/groups/${roscaId}`)
  return { success: true }
}

/**
 * Mark payment as made by current user
 */
export async function markPaymentMade(cycleId: string, roscaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Find user's payment record
  const { data: member } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', roscaId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { error: 'Not a member' }
  }

  // Update payment status
  const { error } = await supabase
    .from('cycle_payments')
    .update({
      has_paid: true,
      paid_at: new Date().toISOString()
    })
    .eq('cycle_id', cycleId)
    .eq('member_id', member.id)

  if (error) {
    return { error: 'Failed to mark payment' }
  }

  // Log activity
  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'payment_made',
      user_id: user.id
    })

  revalidatePath(`/dashboard/groups/${roscaId}`)
  return { success: true }
}

/**
 * Verify payment as receiver (winner of current cycle)
 */
export async function verifyPayment(
  cycleId: string, 
  memberIdToVerify: string, 
  roscaId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if current user is the winner of this cycle
  const { data: cycle } = await supabase
    .from('payment_cycles')
    .select('winner_id')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.winner_id !== user.id) {
    return { error: 'Only the payout receiver can verify payments' }
  }

  // Verify payment
  const { error } = await supabase
    .from('cycle_payments')
    .update({
      verified_by_receiver: true,
      receiver_verified_at: new Date().toISOString()
    })
    .eq('cycle_id', cycleId)
    .eq('member_id', memberIdToVerify)

  if (error) {
    return { error: 'Failed to verify payment' }
  }

  // Log activity
  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'payment_verified',
      user_id: user.id,
      metadata: { verified_member_id: memberIdToVerify }
    })

  revalidatePath(`/dashboard/groups/${roscaId}`)
  return { success: true }
}

/**
 * Admin verification for overdue payments
 */
export async function adminVerifyPayment(
  cycleId: string,
  memberIdToVerify: string,
  roscaId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Admin access required' }
  }

  // Verify payment
  const { error } = await supabase
    .from('cycle_payments')
    .update({
      verified_by_admin: true,
      admin_verified_at: new Date().toISOString(),
      admin_id: user.id
    })
    .eq('cycle_id', cycleId)
    .eq('member_id', memberIdToVerify)

  if (error) {
    return { error: 'Failed to verify payment' }
  }

  // Log activity
  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'admin_verified_payment',
      user_id: user.id,
      metadata: { verified_member_id: memberIdToVerify }
    })

  revalidatePath(`/dashboard/groups/${roscaId}`)
  return { success: true }
}


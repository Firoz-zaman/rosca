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
 * Start a new cycle (creates cycle in 'pending' status)
 */
export async function startNewCycle(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: group } = await supabase
    .from('roscas')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) {
    return { error: 'Group not found' }
  }

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

  // Check if there's already an active cycle
  const { data: activeCycle } = await supabase
    .from('payment_cycles')
    .select('id')
    .eq('rosca_id', groupId)
    .in('status', ['pending', 'bidding', 'payment', 'overdue'])
    .single()

  if (activeCycle) {
    return { error: 'There is already an active cycle. Complete it first.' }
  }

  const { count: cycleCount } = await supabase
    .from('payment_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  const nextCycleNumber = (cycleCount || 0) + 1
  const totalAmount = group.contribution_amount * group.total_slots

  // Create cycle in 'pending' status
  const { data: cycle, error: cycleError } = await supabase
    .from('payment_cycles')
    .insert({
      rosca_id: groupId,
      cycle_number: nextCycleNumber,
      status: 'pending',
      bidding_start_date: null,
      bidding_end_date: null,
      payment_deadline_date: null,
      cycle_end_date: null,
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

  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycle.id,
      activity_type: 'cycle_created',
      user_id: user.id
    })

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true, cycleNumber: nextCycleNumber }
}

/**
 * Start Bidding Phase
 */
export async function startBiddingPhase(cycleId: string, groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: group } = await supabase
    .from('roscas')
    .select('created_by')
    .eq('id', groupId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isCreator = group?.created_by === user.id

  if (!isAdmin && !isCreator) {
    return { error: 'Only admin or creator can start bidding' }
  }

  const { error: updateError } = await supabase
    .from('payment_cycles')
    .update({
      status: 'bidding',
      bidding_start_date: new Date().toISOString()
    })
    .eq('id', cycleId)

  if (updateError) {
    return { error: 'Failed to start bidding: ' + updateError.message }
  }

  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'bidding_opened',
      user_id: user.id
    })

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}

/**
 * End Bidding Phase and Select Winner
 * FIXED: Creates payment records if they don't exist
 * FIXED: Selects winner for random/banker allocation methods
 */
export async function endBiddingPhase(cycleId: string, groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: group } = await supabase
    .from('roscas')
    .select('created_by, allocation_method, contribution_amount, total_slots')
    .eq('id', groupId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isCreator = group?.created_by === user.id

  if (!isAdmin && !isCreator) {
    return { error: 'Only admin or creator can end bidding' }
  }

  if (group?.allocation_method === 'bidding') {
    // Find lowest bid
    const { data: bids } = await supabase
      .from('cycle_bids')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('bid_amount', { ascending: true })
      .limit(1)

    if (!bids || bids.length === 0) {
      return { error: 'No bids placed yet. Cannot end bidding.' }
    }

    const winningBid = bids[0]

    // Update cycle with winner
    const { error: updateError } = await supabase
      .from('payment_cycles')
      .update({
        status: 'payment',
        bidding_end_date: new Date().toISOString(),
        winner_id: winningBid.user_id,
        winning_bid_amount: winningBid.bid_amount
      })
      .eq('id', cycleId)

    if (updateError) {
      return { error: 'Failed to end bidding: ' + updateError.message }
    }

    // Mark winner as having received
    await supabase
      .from('rosca_members')
      .update({ has_received: true })
      .eq('rosca_id', groupId)
      .eq('user_id', winningBid.user_id)

    // Create payment records if they don't exist
    const { data: existingPayments } = await supabase
      .from('cycle_payments')
      .select('id')
      .eq('cycle_id', cycleId)

    if (!existingPayments || existingPayments.length === 0) {
      const { data: members } = await supabase
        .from('rosca_members')
        .select('id')
        .eq('rosca_id', groupId)

      if (members && members.length > 0) {
        await supabase
          .from('cycle_payments')
          .insert(
            members.map((member) => ({
              cycle_id: cycleId,
              member_id: member.id,
              has_paid: false,
              verified_by_receiver: false,
              verified_by_admin: false
            }))
          )
      }
    }

    // Log activity
    await supabase
      .from('cycle_activities')
      .insert({
        cycle_id: cycleId,
        activity_type: 'bidding_closed',
        user_id: user.id,
        metadata: { winner_id: winningBid.user_id, amount: winningBid.bid_amount }
      })
  } else {
    // Random/Banker allocation
    
    // Step 1: Get members who haven't received yet
    const { data: eligibleMembers } = await supabase
      .from('rosca_members')
      .select('id, user_id, slot_number')
      .eq('rosca_id', groupId)
      .eq('has_received', false)

    if (!eligibleMembers || eligibleMembers.length === 0) {
      return { error: 'No eligible members remaining for payout' }
    }

    // Step 2: Select winner based on allocation method
    let selectedWinner
    
    if (group.allocation_method === 'random') {
      // Random selection
      const randomIndex = Math.floor(Math.random() * eligibleMembers.length)
      selectedWinner = eligibleMembers[randomIndex]
    } else if (group.allocation_method === 'banker') {
      // Sequential by slot number (banker decides order)
      selectedWinner = eligibleMembers.sort((a, b) => a.slot_number - b.slot_number)[0]
    } else {
      // Fallback to sequential
      selectedWinner = eligibleMembers.sort((a, b) => a.slot_number - b.slot_number)[0]
    }

    // Step 3: Calculate total amount (contribution × members)
    const totalAmount = group.contribution_amount * group.total_slots

    // Step 4: Update cycle with winner
    const { error: updateError } = await supabase
      .from('payment_cycles')
      .update({
        status: 'payment',
        bidding_end_date: new Date().toISOString(),
        winner_id: selectedWinner.user_id,
        winning_bid_amount: totalAmount
      })
      .eq('id', cycleId)

    if (updateError) {
      return { error: 'Failed to start payment phase: ' + updateError.message }
    }

    // Step 5: Mark winner as having received
    await supabase
      .from('rosca_members')
      .update({ has_received: true })
      .eq('id', selectedWinner.id)

    // Step 6: Create payment records if they don't exist
    const { data: existingPayments } = await supabase
      .from('cycle_payments')
      .select('id')
      .eq('cycle_id', cycleId)

    if (!existingPayments || existingPayments.length === 0) {
      const { data: members } = await supabase
        .from('rosca_members')
        .select('id')
        .eq('rosca_id', groupId)

      if (members && members.length > 0) {
        await supabase
          .from('cycle_payments')
          .insert(
            members.map((member) => ({
              cycle_id: cycleId,
              member_id: member.id,
              has_paid: false,
              verified_by_receiver: false,
              verified_by_admin: false
            }))
          )
      }
    }

    // Step 7: Log activity
    await supabase
      .from('cycle_activities')
      .insert({
        cycle_id: cycleId,
        activity_type: 'winner_selected',
        user_id: user.id,
        metadata: { 
          winner_id: selectedWinner.user_id, 
          method: group.allocation_method,
          amount: totalAmount 
        }
      })
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}

/**
 * End Payment Collection Phase
 */
export async function endPaymentPhase(cycleId: string, groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: group } = await supabase
    .from('roscas')
    .select('created_by')
    .eq('id', groupId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isCreator = group?.created_by === user.id

  if (!isAdmin && !isCreator) {
    return { error: 'Only admin or creator can end payment phase' }
  }

  const { count: unpaidCount } = await supabase
    .from('cycle_payments')
    .select('*', { count: 'exact' })
    .eq('cycle_id', cycleId)
    .eq('verified_by_receiver', false)

  if (unpaidCount && unpaidCount > 0) {
    return { 
      error: `${unpaidCount} payment(s) not yet verified. Verify all payments before ending cycle.`,
      unpaidCount 
    }
  }

  const { error: updateError } = await supabase
    .from('payment_cycles')
    .update({
      status: 'completed',
      cycle_end_date: new Date().toISOString()
    })
    .eq('id', cycleId)

  if (updateError) {
    return { error: 'Failed to complete cycle: ' + updateError.message }
  }

  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'cycle_completed',
      user_id: user.id
    })

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}

/**
 * Place a bid in the current cycle
 */
export async function placeBid(cycleId: string, bidAmount: number, roscaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

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

  const { data: cycle } = await supabase
    .from('payment_cycles')
    .select('status, winning_bid_amount')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.status !== 'bidding') {
    return { error: 'Bidding is not active for this cycle' }
  }

  const { data: lowestBid } = await supabase
    .from('cycle_bids')
    .select('bid_amount')
    .eq('cycle_id', cycleId)
    .order('bid_amount', { ascending: true })
    .limit(1)
    .single()

  const currentLowest = lowestBid?.bid_amount || cycle.winning_bid_amount

  if (bidAmount >= currentLowest) {
    return { error: `Bid must be lower than current lowest (₹${currentLowest})` }
  }

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
    console.error('❌ Not authenticated')
    return { error: 'Not authenticated' }
  }

  console.log('🔍 Finding member for user:', user.id, 'in rosca:', roscaId)

  const { data: member, error: memberError } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', roscaId)
    .eq('user_id', user.id)
    .single()

  console.log('👤 Member found:', member, 'Error:', memberError)

  if (!member) {
    console.error('❌ Not a member')
    return { error: 'Not a member' }
  }

  console.log('💾 Updating payment for cycle:', cycleId, 'member:', member.id)

  const { data: updateData, error } = await supabase
    .from('cycle_payments')
    .update({
      has_paid: true,
      paid_at: new Date().toISOString()
    })
    .eq('cycle_id', cycleId)
    .eq('member_id', member.id)
    .select()  // ← ADD THIS to see what was updated

  console.log('✅ Update result:', updateData, 'Error:', error)

  if (error) {
    console.error('❌ Failed to mark payment:', error)
    return { error: 'Failed to mark payment' }
  }

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
 * Verify payment as receiver
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

  const { data: cycle } = await supabase
    .from('payment_cycles')
    .select('winner_id')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.winner_id !== user.id) {
    return { error: 'Only the payout receiver can verify payments' }
  }

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Admin access required' }
  }

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



'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Add Member to Group Server Action
 */
export async function addMemberToGroup(groupId: string, memberEmail: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

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

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, email')
  
  const memberProfile = allProfiles?.find(
    p => p.email?.toLowerCase() === memberEmail.trim().toLowerCase()
  )

  if (!memberProfile) {
    return { error: 'User not found. They must create an account first.' }
  }

  const { data: existingMember } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', groupId)
    .eq('user_id', memberProfile.id)
    .single()

  if (existingMember) {
    return { error: 'User is already a member of this group' }
  }

  const { count: currentMembers } = await supabase
    .from('rosca_members')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  if (currentMembers !== null && currentMembers >= group.total_slots) {
    return { error: 'Group is full' }
  }

  const nextSlot = (currentMembers || 0) + 1

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

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { 
    success: true,
    memberName: memberProfile.email 
  }
}

/**
 * Start a new cycle (creates cycle in 'pending' status)
 * Admin will manually start bidding phase
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

  // Create cycle in 'pending' status - admin will manually start bidding
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
 * Admin/Creator manually starts the bidding
 */
export async function startBiddingPhase(cycleId: string, groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user is admin/creator
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

  // Update cycle to bidding status
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

  // Log activity
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
 * Admin/Creator manually ends bidding
 */
export async function endBiddingPhase(cycleId: string, groupId: string) {
  console.log('🔥 endBiddingPhase called with:', { cycleId, groupId })  // ADD THIS
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  console.log('👤 User:', user?.id)  // ADD THIS
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: group } = await supabase
    .from('roscas')
    .select('created_by, allocation_method')
    .eq('id', groupId)
    .single()

  console.log('📦 Group:', group)  // ADD THIS


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

    // FIXED: Create payment records if they don't exist
    // FIXED: Create payment records if they don't exist
    console.log('💳 Checking for existing payments...')  // ADD THIS
    
    const { data: existingPayments } = await supabase
      .from('cycle_payments')
      .select('id')
      .eq('cycle_id', cycleId)
    
    console.log('💳 Existing payments:', existingPayments)  // ADD THIS


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
    // Random/Sequential allocation - just move to payment
    const { error: updateError } = await supabase
      .from('payment_cycles')
      .update({
        status: 'payment',
        bidding_end_date: new Date().toISOString()
      })
      .eq('id', cycleId)

    if (updateError) {
      return { error: 'Failed to start payment phase: ' + updateError.message }
    }

    // FIXED: Create payment records if they don't exist
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
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}

/**
 * End Payment Collection Phase and Complete Cycle
 * Admin/Creator manually closes the cycle
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

  // Check if all payments are verified
  const { data: payments, count: unpaidCount } = await supabase
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

  // Mark cycle as completed
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

  // Log activity
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
 * Place a bid (for bidding allocation method)
 */
export async function placeBid(cycleId: string, groupId: string, bidAmount: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get cycle details
  const { data: cycle } = await supabase
    .from('payment_cycles')
    .select('*, roscas(contribution_amount, total_slots)')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.status !== 'bidding') {
    return { error: 'Bidding is not open for this cycle' }
  }

  // Check if user is member and hasn't received
  const { data: member } = await supabase
    .from('rosca_members')
    .select('has_received')
    .eq('rosca_id', groupId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return { error: 'You are not a member of this group' }
  }

  if (member.has_received) {
    return { error: 'You have already received your payout' }
  }

  const totalAmount = cycle.roscas.contribution_amount * cycle.roscas.total_slots

  if (bidAmount > totalAmount) {
    return { error: 'Bid cannot exceed total pool amount' }
  }

  if (bidAmount < cycle.roscas.contribution_amount) {
    return { error: 'Bid must be at least the contribution amount' }
  }

  // Check for existing bid
  const { data: existingBid } = await supabase
    .from('cycle_bids')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('user_id', user.id)
    .single()

  if (existingBid) {
    // Update existing bid
    const { error: updateError } = await supabase
      .from('cycle_bids')
      .update({ bid_amount: bidAmount })
      .eq('id', existingBid.id)

    if (updateError) {
      return { error: 'Failed to update bid: ' + updateError.message }
    }
  } else {
    // Insert new bid
    const { error: insertError } = await supabase
      .from('cycle_bids')
      .insert({
        cycle_id: cycleId,
        user_id: user.id,
        bid_amount: bidAmount
      })

    if (insertError) {
      return { error: 'Failed to place bid: ' + insertError.message }
    }
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}



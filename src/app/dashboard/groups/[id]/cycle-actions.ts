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
 * ✅ FIXED: Validates minimum 2 members before starting
 * ✅ FIXED: Blocks starting when all members have won
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

  // ✅ NEW: Validate minimum members
  const { count: memberCount } = await supabase
    .from('rosca_members')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  if (!memberCount || memberCount < 2) {
    return { error: 'Need at least 2 members to start a cycle. Add more members first.' }
  }

  // ✅ NEW: Check if ALL members have already received (ROSCA complete)
  const { data: allMembers } = await supabase
    .from('rosca_members')
    .select('has_received')
    .eq('rosca_id', groupId)

  const allHaveReceived = allMembers?.every(m => m.has_received === true)

  if (allHaveReceived) {
    return { error: 'All members have received payouts. Please reset the ROSCA to start a new round.' }
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
  
  // ✅ FIXED: Use actual member count, not total_slots
  const totalAmount = group.contribution_amount * (memberCount || 0)

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
/**
 * Start Bidding Phase
 * ✅ FIXED: Auto-selects if only 1 eligible member (skips bidding entirely)
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

  // ✅ NEW: Check eligible members count BEFORE starting bidding
  const { data: eligibleMembers } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', groupId)
    .eq('has_received', false)

  if (!eligibleMembers || eligibleMembers.length === 0) {
    return { error: 'No eligible members remaining' }
  }

  // ✅ NEW: If only 1 eligible member, skip bidding and auto-select immediately
  if (eligibleMembers.length === 1) {
    console.log('⚡ Only 1 eligible member - skipping bidding phase, auto-selecting winner...')
    // Call endBiddingPhase which handles auto-selection
    return endBiddingPhase(cycleId, groupId)
  }

  // Normal flow: Multiple eligible members - start bidding
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
 * ✅ FIXED: Auto-selects last eligible member if only 1 remains (final round)
 * ✅ FIXED: Sets has_received flag for winner
 * ✅ FIXED: Uses actual member count for pot calculation
 */
/**
 * End Bidding Phase and Select Winner
 * ✅ FIXED: Auto-selects last eligible member if only 1 remains (final round)
 * ✅ FIXED: Sets has_received flag for winner CORRECTLY
 * ✅ FIXED: Uses member.id instead of user_id for updates
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
    return { error: 'Only admin or creator can end bidding' }
  }

  // Get actual member count for pot calculation
  const { count: memberCount } = await supabase
    .from('rosca_members')
    .select('id', { count: 'exact', head: true })
    .eq('rosca_id', groupId)

  // ✅ Check eligible members count (members who haven't received yet)
  const { data: eligibleMembers } = await supabase
    .from('rosca_members')
    .select('id, user_id, slot_number')
    .eq('rosca_id', groupId)
    .eq('has_received', false)

  if (!eligibleMembers || eligibleMembers.length === 0) {
    return { error: 'No eligible members remaining for payout' }
  }

  // ✅ If only 1 eligible member left, auto-select them (FINAL ROUND)
// ✅ If only 1 eligible member left, auto-select them (FINAL ROUND)
if (eligibleMembers.length === 1) {
  const finalWinner = eligibleMembers[0]
  const totalAmount = group.contribution_amount * (memberCount || 0)

  console.log('🎯 AUTO-SELECT - Final Winner:', {
    memberId: finalWinner.id,
    userId: finalWinner.user_id,
    slotNumber: finalWinner.slot_number
  })

  // Update cycle with auto-selected winner
  const { error: updateError } = await supabase
    .from('payment_cycles')
    .update({
      status: 'payment',
      bidding_end_date: new Date().toISOString(),
      winner_id: finalWinner.user_id,
      winning_bid_amount: totalAmount,
    })
    .eq('id', cycleId)

  if (updateError) {
    return { error: `Failed to select final winner: ${updateError.message}` }
  }

  // ✅ FIXED: Mark winner as having received (using member ID)
  console.log('🏆 Attempting to mark winner as has_received...')
  console.log('🏆 Update query: member_id =', finalWinner.id)
  
  const { error: memberError, data: updatedMember } = await supabase
    .from('rosca_members')
    .update({ has_received: true })
    .eq('id', finalWinner.id)
    .select()

  console.log('🏆 Update result:', {
    error: memberError,
    updatedMember,
    rowsAffected: updatedMember?.length || 0
  })

  if (memberError) {
    console.error('❌ Error marking winner:', memberError)
  } else if (!updatedMember || updatedMember.length === 0) {
    console.error('❌ NO ROWS UPDATED - member ID might be wrong!')
  } else {
    console.log('✅ Winner marked successfully:', updatedMember[0])
  }

  // Auto-verify winner's own payment
  const { data: winnerPayment } = await supabase
    .from('cycle_payments')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('member_id', finalWinner.id)
    .single()

  if (winnerPayment) {
    await supabase
      .from('cycle_payments')
      .update({
        has_paid: true,
        paid_at: new Date().toISOString(),
        verified_by_receiver: true,
        receiver_verified_at: new Date().toISOString(),
      })
      .eq('id', winnerPayment.id)
  }

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
      await supabase.from('cycle_payments').insert(
        members.map((member) => ({
          cycle_id: cycleId,
          member_id: member.id,
          has_paid: false,
          verified_by_receiver: false,
          verified_by_admin: false,
        }))
      )
    }
  }

  // Log activity
  await supabase.from('cycle_activities').insert({
    cycle_id: cycleId,
    activity_type: 'winner_declared',
    user_id: finalWinner.user_id,
    metadata: {
      winner_id: finalWinner.user_id,
      method: 'auto_final_round',
      amount: totalAmount,
      note: 'Last eligible member - auto-selected',
    },
  })

  revalidatePath(`/dashboard/groups/${groupId}`)
  return { success: true, autoSelected: true, message: 'Final member auto-selected as winner!' }
}

  // ✅ NORMAL FLOW: Multiple eligible members remain
  if (group.allocation_method === 'bidding') {
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

    // ✅ FIXED: Get the winner member first, then update using member ID
    const { data: winnerMember } = await supabase
      .from('rosca_members')
      .select('id')
      .eq('rosca_id', groupId)
      .eq('user_id', winningBid.user_id)
      .single()

    if (winnerMember) {
      // ✅ FIXED: Mark winner as having received (using member ID)
      const { error: memberError } = await supabase
        .from('rosca_members')
        .update({ has_received: true })
        .eq('id', winnerMember.id)  // ✅ Use member.id

      if (memberError) {
        console.error('Error marking winner:', memberError)
      }

      // Auto-verify winner's own payment
      await supabase
        .from('cycle_payments')
        .update({
          has_paid: true,
          paid_at: new Date().toISOString(),
          verified_by_receiver: true,
          receiver_verified_at: new Date().toISOString()
        })
        .eq('cycle_id', cycleId)
        .eq('member_id', winnerMember.id)
    }

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

          // Log bidding closed
          await supabase.from('cycle_activities').insert({
            cycle_id: cycleId,
            activity_type: 'bidding_closed',
            user_id: user.id
          })

    // Log activity
    await supabase
      .from('cycle_activities')
      .insert({
        cycle_id: cycleId,
        activity_type: 'winner_declared',
        user_id: winningBid.user_id,
        metadata: { winner_id: winningBid.user_id, amount: winningBid.bid_amount }
      })
  } else {
    // Random/Banker allocation - Select winner based on allocation method
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

    // Calculate total amount using actual member count
    const totalAmount = group.contribution_amount * (memberCount || 0)

    // Update cycle with winner
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

    // ✅ FIXED: Mark winner as having received (using member ID)
    const { error: memberError } = await supabase
      .from('rosca_members')
      .update({ has_received: true })
      .eq('id', selectedWinner.id)  // ✅ Use member.id

    if (memberError) {
      console.error('Error marking winner:', memberError)
    }

    // Auto-verify winner's own payment
    const { data: winnerPayment } = await supabase
      .from('cycle_payments')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('member_id', selectedWinner.id)
      .single()

    if (winnerPayment) {
      await supabase
        .from('cycle_payments')
        .update({
          has_paid: true,
          paid_at: new Date().toISOString(),
          verified_by_receiver: true,
          receiver_verified_at: new Date().toISOString()
        })
        .eq('id', winnerPayment.id)
    }

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
        activity_type: 'winner_declared',
        user_id: selectedWinner.user_id,
        metadata: {
          winner_id: selectedWinner.user_id,
          method: group.allocation_method,
          amount: totalAmount,
        },
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

  // Get cycle winner
  const { data: cycleData } = await supabase
    .from('payment_cycles')
    .select('winner_id')
    .eq('id', cycleId)
    .single()

  if (!cycleData?.winner_id) {
    return { error: 'Cycle winner not found' }
  }

  // Get winner's member_id
  const { data: winnerMember } = await supabase
    .from('rosca_members')
    .select('id')
    .eq('rosca_id', groupId)
    .eq('user_id', cycleData.winner_id)
    .single()

  // Get all unverified payments
  const { data: allPayments } = await supabase
    .from('cycle_payments')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('verified_by_receiver', false)

  // Filter out winner's payment in JavaScript
  const unpaidPayments = allPayments?.filter(p => p.member_id !== winnerMember?.id) || []
  const unpaidCount = unpaidPayments.length

  if (unpaidCount > 0) {
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
    .select()

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

  // ✅ NEW: Fetch member's name before logging activity
  const { data: memberData } = await supabase
    .from('rosca_members')
    .select('user_id')
    .eq('id', memberIdToVerify)
    .single()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', memberData?.user_id)
    .single()

  await supabase
    .from('cycle_activities')
    .insert({
      cycle_id: cycleId,
      activity_type: 'payment_verified',
      user_id: user.id,
      metadata: { 
        verified_member_id: memberIdToVerify, 
        verified_member_name: profileData?.full_name || 'a member'  // ✅ Now defined
      }
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

/**
 * Reset ROSCA - Clear all has_received flags to start fresh
 * Only creator/admin can do this when ALL members have received
 */
export async function resetRosca(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check permissions
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
    return { error: 'Only group creator or admin can reset ROSCA' }
  }

  // Check if there are any active cycles
  const { data: activeCycles } = await supabase
    .from('payment_cycles')
    .select('id')
    .eq('rosca_id', groupId)
    .in('status', ['pending', 'bidding', 'payment', 'overdue'])

  if (activeCycles && activeCycles.length > 0) {
    return { error: 'Cannot reset while there are active cycles. Complete all cycles first.' }
  }

  // Verify ALL members have received before allowing reset
  const { data: members } = await supabase
    .from('rosca_members')
    .select('has_received')
    .eq('rosca_id', groupId)

  const allReceived = members?.every(m => m.has_received) || false

  if (!allReceived) {
    return { error: 'Cannot reset: Not all members have received payouts yet.' }
  }

  // Reset all members' has_received flag
  const { error: resetError } = await supabase
    .from('rosca_members')
    .update({ has_received: false })
    .eq('rosca_id', groupId)

  if (resetError) {
    return { error: 'Failed to reset ROSCA: ' + resetError.message }
  }

  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}




/**
 * Save winner's payment details for current cycle
 * Only the winner can update their payment details
 */
export async function saveWinnerPaymentDetails(
  cycleId: string,
  groupId: string,
  paymentData: {
    methodType: 'UPI' | 'Bank' | 'Crypto' | 'PayPal' | 'Cash' | 'Other'
    details: Record<string, any>
    instructions?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user is the winner of this cycle
  const { data: cycle } = await supabase
    .from('payment_cycles')
    .select('winner_id, status')
    .eq('id', cycleId)
    .single()

  if (!cycle) {
    return { error: 'Cycle not found' }
  }

  if (cycle.winner_id !== user.id) {
    return { error: 'Only the cycle winner can set payment details' }
  }

  if (cycle.status !== 'payment' && cycle.status !== 'overdue') {
    return { error: 'Payment details can only be set during payment phase' }
  }

  // Update payment details
  const { error: updateError } = await supabase
    .from('payment_cycles')
    .update({
      payment_method_type: paymentData.methodType,
      payment_details: paymentData.details,
      payment_instructions: paymentData.instructions || null,
    })
    .eq('id', cycleId)

  if (updateError) {
    return { error: 'Failed to save payment details: ' + updateError.message }
  }

// Log activity
const { error: activityError } = await supabase
  .from('cycle_activities')
  .insert({
    cycle_id: cycleId,
    activity_type: 'payment_details_published',
    user_id: user.id,
    metadata: {
      method_type: paymentData.methodType,
    }
  })

if (activityError) {
  console.error('Failed to log payment_details_published activity:', activityError)
}


  revalidatePath(`/dashboard/groups/${groupId}`)
  
  return { success: true }
}






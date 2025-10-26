'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createGroup(formData: FormData) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Extract form data
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const amount = formData.get('amount') as string
  const frequency = formData.get('frequency') as string
  const totalSlots = formData.get('totalSlots') as string
  const allocationMethod = formData.get('allocationMethod') as string

  // Insert group
  const { data: newGroup, error: insertError } = await supabase
    .from('roscas')
    .insert({
      name,
      description,
      contribution_amount: parseFloat(amount),
      frequency,
      total_slots: parseInt(totalSlots),
      allocation_method: allocationMethod,
      created_by: user.id,
      status: 'pending'
    })
    .select()
    .single()

  if (insertError) {
    return { error: insertError.message }
  }

  // Add creator as first member
  await supabase
    .from('rosca_members')
    .insert({
      rosca_id: newGroup.id,
      user_id: user.id,
      slot_number: 1
    })

  // Revalidate dashboard to show new group
  revalidatePath('/dashboard')
  
  // Redirect to dashboard
  redirect('/dashboard')
}

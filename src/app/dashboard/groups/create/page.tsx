import { createGroup } from './actions'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CreateGroupForm from './CreateGroupForm'

export default async function CreateGroupPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard') // Redirect non-admins to dashboard
  }

  return (
    <CreateGroupForm createGroup={createGroup} />
  )
}



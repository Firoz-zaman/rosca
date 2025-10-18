import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from './signoutbutton'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Welcome, {user.user_metadata?.full_name || 'User'}!
          </h1>
          <p className="text-slate-700 mb-4">
            Email: <span className="font-semibold">{user.email}</span>
          </p>
          <p className="text-slate-600 mb-6 text-sm">
            User ID: {user.id}
          </p>
          
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}


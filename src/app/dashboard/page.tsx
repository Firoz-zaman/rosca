import { createClient } from '../../lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // SECURITY: Always use getUser() in server components
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome, {user.user_metadata?.full_name || 'User'}!
          </h1>
          <p className="text-gray-600 mb-4">Email: {user.email}</p>
          
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

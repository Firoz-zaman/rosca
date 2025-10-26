import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  // Fetch user profile with role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Fetch user's groups with member count
  const { data: groups, error: groupsError } = await supabase
    .from('rosca_members')
    .select(`
      rosca_id,
      roscas (
        id,
        name,
        contribution_amount,
        frequency,
        start_date,
        status,
        total_slots
      )
    `)
    .eq('user_id', user.id)

const userGroups = groups?.map((g: any) => g.roscas).filter(Boolean) || []


  return (
    <div className="px-4 py-6">
      {/* Welcome Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          Welcome back, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}! 👋
        </h2>
        <p className="text-slate-600">
          Manage your chitfund groups
          {isAdmin && <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Admin</span>}
        </p>
      </div>

      {/* Create Group Button - Only show to admins */}
      {isAdmin && (
        <Link href="/dashboard/groups/create">
          <button className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]">
            <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 4v16m8-8H4"></path>
            </svg>
            <span>Create New Group</span>
          </button>
        </Link>
      )}

      {/* Groups List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          My Groups ({userGroups.length})
        </h3>

        {userGroups.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <p className="text-slate-600 font-medium mb-2">No groups yet</p>
            <p className="text-slate-500 text-sm">
              {isAdmin 
                ? 'Create your first chitfund group to get started' 
                : 'Wait for an admin to add you to a group'}
            </p>
          </div>
        ) : (
          userGroups.map((group: any) => (
            <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all hover:border-blue-300">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">
                      {group.name}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {group.total_slots} members • {group.status}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Contribution</p>
                    <p className="text-lg font-bold text-slate-900">
                      ₹{Number(group.contribution_amount).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Frequency</p>
                    <p className="text-sm font-semibold text-blue-600 capitalize">
                      {group.frequency}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}





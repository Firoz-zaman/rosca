'use client'

/**
 * MembersList - Displays all group members in mobile-friendly cards
 * Shows: member name, slot number, payout status
 * Visual indicator for members who have received payout
 */
export default function MembersList({ 
  members, 
  isCreator 
}: { 
  members: any[]
  isCreator: boolean 
}) {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No members yet</p>
        {isCreator && (
          <p className="text-sm text-gray-400 mt-2">
            Click "Add Member" to invite people to this group
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div 
          key={member.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between">
            {/* Member Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {/* Slot Number Badge */}
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 font-semibold">
                    {member.slot_number}
                  </span>
                </div>

                {/* Name and Username */}
                <div>
                  <p className="font-semibold text-gray-900">
                    {member.profiles?.full_name || 'Unknown'}
                  </p>
                  {member.profiles?.username && (
                    <p className="text-sm text-gray-500">
                      @{member.profiles.username}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payout Status Badge */}
            <div>
              {member.has_received ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-200 text-green-800">
                  🏆
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  Yet To Win
                </span>
              )}
            </div>
          </div>

          {/* Phone (only visible to creator) */}
          {isCreator && member.profiles?.phone && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                📞 {member.profiles.phone}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

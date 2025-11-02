'use client'

/**
 * GroupDetails - Displays group metadata in a mobile-friendly card
 * Shows: name, description, contribution amount, frequency, status, slots
 */
export default function GroupDetails({ 
  group, 
  availableSlots 
}: { 
  group: any
  availableSlots: number 
}) {
  // Format currency for Indian context
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Status badge colors
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header with name and status */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {group.name}
            </h1>
            {group.description && (
              <p className="mt-2 text-gray-600">
                {group.description}
              </p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[group.status as keyof typeof statusColors]}`}>
            {group.status === 'pending' ? 'In Progress' : group.status.charAt(0).toUpperCase() + group.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Key Details Grid - Mobile responsive */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contribution Amount */}
        <div>
          <p className="text-sm text-gray-500 mb-1">Contribution Amount</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(group.contribution_amount)}
          </p>
        </div>

        {/* Frequency */}
        <div>
          <p className="text-sm text-gray-500 mb-1">Frequency</p>
          <p className="text-lg font-semibold text-gray-900 capitalize">
            {group.frequency}
          </p>
        </div>

        {/* Allocation Method */}
        <div>
          <p className="text-sm text-gray-500 mb-1">ROSCA Prize</p>
          <p className="text-lg font-semibold text-gray-900 capitalize">
            {formatCurrency(group.contribution_amount * group.total_slots)}
          </p>
        </div>

        {/* Fees */}
        <div>
          <p className="text-sm text-gray-500 mb-1">Fees</p>
          <p className="text-lg font-semibold text-gray-900">
            <span className="line-through text-gray-400 mr-2">1%</span>
            <span className="text-gray-400">→</span>
            <span className="text-green-600">  0%</span>
          </p>
          {/*<p className="text-xs text-green-600 mt-1">🎉 Launch Offer!</p>*/}
        </div>


        {/* Start Date */}
        {group.start_date && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Start Date</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatDate(group.start_date)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { DateTime } from 'luxon'
import React from 'react'
import type { ExpandedCallHistory } from '../routes/loans/scheduled-payments/$scheduledPaymentId/calls'

interface Props {
  callHistory: ExpandedCallHistory[]
}

const CallHistory: React.FC<Props> = ({ callHistory }) => {
  return (
    <ul className="w-full overflow-y-scroll text-gray-900 bg-white divide-y divide-gray-200 dark:text-white dark:divide-gray-700 max-h-52">
      {callHistory.map((ch) => {
        const note = ch.note
        const editor = ch.calledBy.name
        const createdAt = DateTime.fromJSDate(
          new Date(ch.createdAt)
        ).toLocaleString(DateTime.DATETIME_MED)

        return (
          <li key={ch.id} className="flex flex-col px-4 py-3">
            <p className="mb-0 text-sm font-bold text-gray-500">
              {editor}
              <span className="ml-2 text-xs font-normal">{createdAt}</span>
            </p>
            <p className="text-sm font-normal">{note}</p>
          </li>
        )
      })}
    </ul>
  )
}

export default CallHistory

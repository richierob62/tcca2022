import { DateTime } from 'luxon'
import type { ExpandedClientNote } from '../routes/clients/$clientId'
import React from 'react'

interface Props {
  notes: ExpandedClientNote[]
}

const NotesList: React.FC<Props> = ({ notes }) => {
  return (
    <ul className="w-full overflow-y-scroll text-gray-900 bg-white divide-y divide-gray-200 dark:text-white dark:divide-gray-700 max-h-48">
      {notes.map((n) => {
        const note = n.note
        const editor = n.createdBy.name
        const createdAt = DateTime.fromJSDate(
          new Date(n.createdAt)
        ).toLocaleString(DateTime.DATETIME_MED)

        return (
          <li key={n.id} className="flex flex-col px-4 py-3">
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

export default NotesList

import { Link, useSearchParams } from '@remix-run/react'

import { FixedSizeList as List } from 'react-window'
import React from 'react'
import type { User } from '@prisma/client'
import { UserStatus } from '@prisma/client'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  users: User[]
}

const UserList: React.FC<Props> = ({ users }) => {
  const [searchParams] = useSearchParams()

  const Cell = ({ index, style }: { index: number; style: any }) => {
    return (
      <Link
        to={`/permissions/${users[index].id}?${buildQueryStringFromSearchParams(
          searchParams
        )}`}
      >
        <div
          className="flex items-center px-6 py-3 text-base text-left text-gray-500 bg-white border-b cursor-pointer group hover:bg-slate-200 "
          style={style}
        >
          <div style={{ width: 300 }}>{users[index].name}</div>
          <div style={{ width: 300 }}>{users[index].email}</div>
          <div
            className={`${
              users[index].status === UserStatus.ACTIVE
                ? 'text-green-500 '
                : 'text-red-500 '
            } text-sm`}
            style={{ width: 100 }}
          >
            {users[index].status}
          </div>
        </div>
      </Link>
    )
  }

  const totalWidth = 700

  return (
    <div className="relative mt-10 overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 280 }}>Name</div>
        <div style={{ width: 280 }}>Email</div>
        <div style={{ width: 92 }}>Status</div>
      </div>

      <List
        height={300}
        itemCount={users.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default UserList

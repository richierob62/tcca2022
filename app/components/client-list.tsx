import { Link, useSearchParams } from '@remix-run/react'

import type { ExpandedClient } from '../routes/clients/index'
import { FixedSizeList as List } from 'react-window'
import React from 'react'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  clients: ExpandedClient[]
}

const ClientList: React.FC<Props> = ({ clients }) => {
  const [searchParams] = useSearchParams()

  const clientSortBy = searchParams.get('clientSortBy')

  if (clientSortBy === 'name')
    clients.sort((a, b) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1
      return 0
    })

  const Cell = ({ index, style }: { index: number; style: any }) => {
    const numLoans = clients[index].loans.length

    const lastStatus = clients[index].loans[0]?.status || '-'

    return (
      <div
        className="flex items-center px-6 py-3 text-base text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <Link
          to={`/clients/${clients[index].id}?${buildQueryStringFromSearchParams(
            searchParams
          )}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 100 }}
        >
          <div>{clients[index].clientNum}</div>
        </Link>
        <Link
          to={`/clients/${clients[index].id}?${buildQueryStringFromSearchParams(
            searchParams
          )}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 300 }}
        >
          <div>{clients[index].name}</div>
        </Link>
        <div style={{ width: 60 }} className="text-center ">
          {numLoans}
        </div>
        {clients[index].loans.length ? (
          <Link
            to={`/loans/${
              clients[index].loans[0].loanNum
            }?${buildQueryStringFromSearchParams(searchParams)}`}
            className="font-semibold text-center text-blue-500 cursor-pointer"
            style={{ width: 100 }}
          >
            <div>{clients[index].loans[0].loanNum}</div>
          </Link>
        ) : (
          <div className="text-center" style={{ width: 100 }}>
            -
          </div>
        )}
        <div style={{ width: 100 }} className="text-center ">
          {lastStatus}
        </div>
      </div>
    )
  }

  const totalWidth = 48 + 100 + 300 + 60 + 100 + 100

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 100 }}>Client #</div>
        <div style={{ width: 300 }}>Client Name</div>
        <div style={{ width: 60 }} className="text-center">
          # Loans
        </div>
        <div style={{ width: 100 }} className="text-center">
          Last Loan #
        </div>
        <div style={{ width: 100 }} className="text-center">
          Last Status
        </div>
      </div>

      <List
        height={800}
        itemCount={clients.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default ClientList

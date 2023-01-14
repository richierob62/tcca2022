import { Link, useSearchParams } from '@remix-run/react'
import React, { useMemo } from 'react'

import { DateTime } from 'luxon'
import type { ExpandedAppication } from '../routes/loans/applications'
import { FixedSizeList as List } from 'react-window'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  applications: ExpandedAppication[]
}

const ApplicationList: React.FC<Props> = ({ applications: appls }) => {
  const [searchParams] = useSearchParams()

  const applicationSortBy = searchParams.get('applicationSortBy')
  const applicationSortDir = searchParams.get('applicationSortDir')

  const sortReturnValue = applicationSortDir === 'desc' ? 1 : -1

  const applications = useMemo(() => {
    if (applicationSortBy === 'name') {
      appls.sort((a, b) => {
        if (a.client.name.toLowerCase() < b.client.name.toLowerCase())
          return sortReturnValue
        if (a.client.name.toLowerCase() > b.client.name.toLowerCase())
          return sortReturnValue * -1
        return 0
      })
    } else if (applicationSortBy === 'clientNum') {
      appls.sort((a, b) => {
        if (a.client.clientNum < b.client.clientNum) return sortReturnValue
        if (a.client.clientNum > b.client.clientNum) return sortReturnValue * -1
        return 0
      })
    } else if (applicationSortBy === 'applicationNum') {
      appls.sort((a, b) => {
        if (a.applicationNum < b.applicationNum) return sortReturnValue
        if (a.applicationNum > b.applicationNum) return sortReturnValue * -1
        return 0
      })
    } else if (applicationSortBy === 'loanNum') {
      appls.sort((a, b) => {
        if ((a.loan?.loanNum || '') < (b.loan?.loanNum || ''))
          return sortReturnValue
        if ((a.loan?.loanNum || '') > (b.loan?.loanNum || ''))
          return sortReturnValue * -1
        return 0
      })
    } else if (applicationSortBy === 'applicationDate') {
      appls.sort((a, b) => {
        if (a.applicationDate < b.applicationDate) return sortReturnValue
        if (a.applicationDate > b.applicationDate) return sortReturnValue * -1
        return 0
      })
    } else if (applicationSortBy === 'requestedAmount') {
      appls.sort((a, b) => {
        if (a.requestedAmount < b.requestedAmount) return sortReturnValue
        if (a.requestedAmount > b.requestedAmount) return sortReturnValue * -1
        return 0
      })
    } else if (applicationSortBy === 'status') {
      appls.sort((a, b) => {
        if (a.status < b.status) return sortReturnValue
        if (a.status > b.status) return sortReturnValue * -1
        return 0
      })
    }

    return [...appls]
  }, [applicationSortBy, appls, sortReturnValue])

  const Cell = ({ index, style }: { index: number; style: any }) => {
    return (
      <div
        className="flex items-center px-6 py-3 text-base text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <Link
          to={`/clients/${
            applications[index].client.id
          }?${buildQueryStringFromSearchParams(searchParams)}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 100 }}
        >
          <div>{applications[index].client.clientNum}</div>
        </Link>
        <Link
          to={`/clients/${
            applications[index].client.id
          }?${buildQueryStringFromSearchParams(searchParams)}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 300 }}
        >
          <div>{applications[index].client.name}</div>
        </Link>
        <Link
          to={`/loans/applications/${
            applications[index].id
          }?${buildQueryStringFromSearchParams(searchParams)}`}
          className="font-semibold text-center text-blue-500 cursor-pointer"
          style={{ width: 100 }}
        >
          <div>{applications[index].applicationNum}</div>
        </Link>
        <div style={{ width: 120 }} className="text-center ">
          {DateTime.fromJSDate(
            new Date(applications[index].applicationDate)
          ).toLocaleString()}
        </div>
        <div style={{ width: 120 }} className="text-center ">
          {`$${applications[index].requestedAmount.toLocaleString('en-US')}`}
        </div>
        <div style={{ width: 100 }} className="text-center ">
          {`${applications[index].requestedTerm.toLocaleString('en-US')}`}
        </div>
        <div style={{ width: 100 }} className="text-center ">
          {applications[index].status}
        </div>
        {applications[index].loan ? (
          <Link
            to={`/loans/${
              applications[index].loan?.id
            }?${buildQueryStringFromSearchParams(searchParams)}`}
            className="font-semibold text-center text-blue-500 cursor-pointer"
            style={{ width: 100 }}
          >
            <div>{applications[index].loan?.loanNum}</div>
          </Link>
        ) : (
          <div style={{ width: 100 }} className="text-center ">
            {applications[index].loan?.loanNum || '-'}
          </div>
        )}
      </div>
    )
  }

  const totalWidth = 48 + 1040

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 100 }}>Client #</div>
        <div style={{ width: 300 }}>Client Name</div>
        <div style={{ width: 100 }} className="text-center">
          Application #
        </div>
        <div style={{ width: 120 }} className="text-center">
          Application
          <br />
          Date
        </div>
        <div style={{ width: 120 }} className="text-center">
          Requested
          <br />
          Amount
        </div>
        <div style={{ width: 100 }} className="text-center">
          Requested
          <br />
          Term
        </div>
        <div style={{ width: 100 }} className="text-center">
          Status
        </div>
        <div style={{ width: 100 }} className="text-center">
          Loan #
        </div>
      </div>

      <List
        height={800}
        itemCount={applications.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default ApplicationList

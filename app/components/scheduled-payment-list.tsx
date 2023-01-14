import { Link, useSearchParams } from '@remix-run/react'
import React, { useMemo } from 'react'

import { DateTime } from 'luxon'
import type { ExpandedScheduledPayment } from '~/routes/loans/scheduled-payments'
import { FixedSizeList as List } from 'react-window'
import { Permission } from '@prisma/client'
import type { User } from '@prisma/client'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  scheduledPayments: ExpandedScheduledPayment[]
  loggedInUser: User
}

const ScheduledPaymentList: React.FC<Props> = ({
  scheduledPayments: schedPmts,
  loggedInUser,
}) => {
  const [searchParams] = useSearchParams()

  const scheduleSortBy = searchParams.get('scheduleSortBy')
  const scheduleSortDir = searchParams.get('scheduleSortDir')
  const schedulePaymentFilterPaidStatus = searchParams.get(
    'schedulePaymentFilterPaidStatus'
  )
  const scheduledPaymentCallStatus = searchParams.get(
    'scheduledPaymentCallStatus'
  )

  const sortReturnValue = scheduleSortDir === 'desc' ? 1 : -1

  const showPaymentsBtn = loggedInUser.permissions.includes(
    Permission.RECEIPT_VIEW
  )

  const getPaymentNum = (scheduledPayment: ExpandedScheduledPayment) => {
    const numPaymantes = scheduledPayment.loan.numPayments

    return `${scheduledPayment.paymentNumber}/${numPaymantes}`
  }

  const getIsPaid = (scheduledPayment: ExpandedScheduledPayment) => {
    const allPayments = scheduledPayment.paymentReceipts.reduce((acc, curr) => {
      return acc + curr.amount
    }, 0)

    return allPayments >= scheduledPayment.amount ? 'Yes' : 'No'
  }

  const getIsCalled = (scheduledPayment: ExpandedScheduledPayment) => {
    const callCount = scheduledPayment.callHistory.length
    return callCount > 0 ? 'Yes' : 'No'
  }

  const schedules = useMemo(() => {
    if (scheduleSortBy === 'name') {
      schedPmts.sort((a, b) => {
        if (a.loan.client.name.toLowerCase() < b.loan.client.name.toLowerCase())
          return sortReturnValue
        if (a.loan.client.name.toLowerCase() > b.loan.client.name.toLowerCase())
          return sortReturnValue * -1
        return 0
      })
    } else if (scheduleSortBy === 'loanNum') {
      schedPmts.sort((a, b) => {
        if (a.loan.loanNum < b.loan.loanNum) return sortReturnValue
        if (a.loan.loanNum > b.loan.loanNum) return sortReturnValue * -1
        return 0
      })
    } else if (scheduleSortBy === 'dueDate') {
      schedPmts.sort((a, b) => {
        if (a.dueDate < b.dueDate) return sortReturnValue
        if (a.dueDate > b.dueDate) return sortReturnValue * -1
        return 0
      })
    } else if (scheduleSortBy === 'promiseDate') {
      schedPmts.sort((a, b) => {
        if (!a.promiseDate && !b.promiseDate) return 0
        if (!a.promiseDate && b.promiseDate) return 1
        if (a.promiseDate && !b.promiseDate) return -1

        if (a.promiseDate! < b.promiseDate!) return sortReturnValue
        if (a.promiseDate! > b.promiseDate!) return sortReturnValue * -1
        return 0
      })
    }

    return [...schedPmts]
      .filter((scheduledPayment) => {
        if (schedulePaymentFilterPaidStatus === 'Paid') {
          return getIsPaid(scheduledPayment) === 'Yes'
        } else if (schedulePaymentFilterPaidStatus === 'Unpaid') {
          return getIsPaid(scheduledPayment) === 'No'
        } else {
          return true
        }
      })
      .filter((scheduledPayment) => {
        if (scheduledPaymentCallStatus === 'Not Called') {
          return getIsCalled(scheduledPayment) === 'No'
        }
        return true
      })
  }, [
    scheduleSortBy,
    schedPmts,
    sortReturnValue,
    schedulePaymentFilterPaidStatus,
    scheduledPaymentCallStatus,
  ])

  const Cell = ({ index, style }: { index: number; style: any }) => {
    let dueDate: Date | string = schedules[index].dueDate
    if (typeof dueDate === 'string') {
      dueDate = DateTime.fromISO(dueDate).toLocaleString()
    } else {
      dueDate = DateTime.fromJSDate(dueDate).toLocaleString()
    }

    let promiseDate: Date | string | null = schedules[index].promiseDate
    if (promiseDate === null) {
      promiseDate = '-'
    } else if (typeof promiseDate === 'string') {
      promiseDate = DateTime.fromISO(promiseDate).toLocaleString()
    } else {
      promiseDate = DateTime.fromJSDate(promiseDate).toLocaleString()
    }

    return (
      <div
        className="flex items-center px-6 py-3 text-base text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <Link
          to={`/loans/${
            schedules[index].loan.id
          }?${buildQueryStringFromSearchParams(searchParams)}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 80 }}
        >
          <div>{schedules[index].loan.loanNum}</div>
        </Link>

        <Link
          to={`/clients/${
            schedules[index].loan.client.id
          }?${buildQueryStringFromSearchParams(searchParams)}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 250 }}
        >
          <div>{schedules[index].loan.client.name}</div>
        </Link>

        <div style={{ width: 80 }} className="text-center ">
          {getPaymentNum(schedules[index])}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {dueDate}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {`$${schedules[index].amount.toLocaleString('en-US')}`}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {getIsPaid(schedules[index])}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {getIsCalled(schedules[index])}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {promiseDate}
        </div>

        <div style={{ width: 164 }} className="flex justify-end pl-4 ">
          <div className="w-1/2">
            <Link
              to={`/loans/scheduled-payments/${
                schedules[index].id
              }/calls?${buildQueryStringFromSearchParams(searchParams)}`}
              className="relative inline-flex items-center justify-center p-0.5  overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-600 hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <button className="relative w-full px-3 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 hover:bg-opacity-0">
                call log
              </button>
            </Link>
          </div>
          {showPaymentsBtn && (
            <div className="w-1/2">
              <Link
                to={`/loans/${
                  schedules[index].loanId
                }/payments?${buildQueryStringFromSearchParams(searchParams)}`}
                className="relative inline-flex items-center justify-center p-0.5  overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-600 hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
              >
                <button className="relative w-full px-3 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 hover:bg-opacity-0">
                  payments
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const totalWidth = 48 + 80 + 250 + 80 + 100 + 100 + 100 + 100 + 100 + 164

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 80 }}>Loan #</div>
        <div style={{ width: 250 }}>Client Name</div>
        <div className="text-center" style={{ width: 80 }}>
          Pmt #
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Due Date
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Due Amt
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Paid?
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Called?
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Promised For
        </div>
        <div className="text-center" style={{ width: 164 }}></div>
      </div>

      <List
        height={400}
        itemCount={schedules.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default ScheduledPaymentList

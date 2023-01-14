import { Link, useSearchParams } from '@remix-run/react'

import { FixedSizeList as List } from 'react-window'
import React, { useMemo } from 'react'
import { buildQueryStringFromSearchParams } from '../util/query-string'
import type { ExpandedLoan } from '~/routes/loans/index'
import { DateTime } from 'luxon'
import { LoanStatus } from '@prisma/client'

interface Props {
  loans: ExpandedLoan[]
}

const LoanList: React.FC<Props> = ({ loans: lns }) => {
  const [searchParams] = useSearchParams()

  const loanSortBy = searchParams.get('loanSortBy')
  const loanSortDir = searchParams.get('loanSortDir')

  const sortReturnValue = loanSortDir === 'desc' ? 1 : -1

  const loans = useMemo(() => {
    if (loanSortBy === 'name') {
      lns.sort((a, b) => {
        if (a.client.name.toLowerCase() < b.client.name.toLowerCase())
          return sortReturnValue
        if (a.client.name.toLowerCase() > b.client.name.toLowerCase())
          return sortReturnValue * -1
        return 0
      })
    } else if (loanSortBy === 'loanNum') {
      lns.sort((a, b) => {
        if (a.loanNum < b.loanNum) return sortReturnValue
        if (a.loanNum > b.loanNum) return sortReturnValue * -1
        return 0
      })
    } else if (loanSortBy === 'loanStartDate') {
      lns.sort((a, b) => {
        if (a.loanStartDate < b.loanStartDate) return sortReturnValue
        if (a.loanStartDate > b.loanStartDate) return sortReturnValue * -1
        return 0
      })
    } else if (loanSortBy === 'amount') {
      lns.sort((a, b) => {
        if (a.amount < b.amount) return sortReturnValue
        if (a.amount > b.amount) return sortReturnValue * -1
        return 0
      })
    } else if (loanSortBy === 'status') {
      lns.sort((a, b) => {
        if (a.status < b.status) return sortReturnValue
        if (a.status > b.status) return sortReturnValue * -1
        return 0
      })
    }

    return [...lns]
  }, [loanSortBy, lns, sortReturnValue])

  const getTimesLate = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    const duesDateAndPaymentReceipts = scheduledPayments
      .map((scheduledPayment) => {
        return {
          dueDate: scheduledPayment.dueDate,
          amountExpected: scheduledPayment.amount,
          ...scheduledPayment.paymentReceipts
            .map((paymentReceipt) => {
              return {
                receiptDate: paymentReceipt.receipt.receiptDate,
                amount: paymentReceipt.amount,
              }
            })
            .reduce(
              (acc: any, curr) => {
                const dte =
                  acc.receiptDate < curr.receiptDate
                    ? curr.receiptDate
                    : acc.receiptDate
                const amt = acc.totalAmountPaid + curr.amount
                return {
                  latestReceiptDate: dte,
                  totalAmountPaid: amt,
                }
              },
              { latestReceiptDate: null, totalAmountPaid: 0 }
            ),
        }
      })
      .map((dueDateAndPaymentReceipts) => {
        const { dueDate, amountExpected, latestReceiptDate, totalAmountPaid } =
          dueDateAndPaymentReceipts

        let isLate = false

        const dueDateIsInPast =
          DateTime.fromISO(dueDate).toMillis() < Date.now()

        if (dueDateIsInPast) {
          const amountOutStanding = amountExpected - totalAmountPaid > 0
          if (amountOutStanding) {
            isLate = true
          } else {
            if (latestReceiptDate) {
              if (
                DateTime.fromISO(latestReceiptDate).toMillis() >
                DateTime.fromISO(dueDate).toMillis()
              ) {
                isLate = true
              }
            }
          }
        }

        return {
          dueDate,
          amountExpected,
          latestReceiptDate,
          totalAmountPaid,
          isLate,
        }
      })

    return duesDateAndPaymentReceipts.filter((dueDateAndPaymentReceipts) => {
      return dueDateAndPaymentReceipts.isLate
    }).length
  }

  const getLastPaymentNum = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    let paymentNum = 0
    const numPaymantes = loan.numPayments

    const paymentReceipts = scheduledPayments
      .map((scheduledPayment) => scheduledPayment.paymentReceipts)
      .flat()

    const receipts = paymentReceipts.map(
      (paymentReceipt) => paymentReceipt.receipt
    )

    const lastReceipt = receipts.sort((a, b) => {
      if (a.receiptDate < b.receiptDate) return 1
      if (a.receiptDate > b.receiptDate) return -1
      return 0
    })[0]

    if (lastReceipt) {
      const lastPaymentReceipt = paymentReceipts
        .filter((paymentReceipt) => paymentReceipt.receiptId === lastReceipt.id)
        .sort((a, b) => {
          if (a.createdAt < b.createdAt) return 1
          if (a.createdAt > b.createdAt) return -1
          return 0
        })[0]

      if (lastPaymentReceipt) {
        const lastScheduledPayment = scheduledPayments.filter(
          (scheduledPayment) =>
            scheduledPayment.id === lastPaymentReceipt.scheduledPaymentId
        )[0]

        if (lastScheduledPayment) {
          paymentNum = lastScheduledPayment.paymentNumber
        }
      }
    }

    return `${paymentNum}/${numPaymantes}`
  }

  const getAmountOutstanding = (loan: ExpandedLoan) => {
    const scheduledPayments = loan.scheduledPayments

    const allPayments = scheduledPayments
      .map((scheduledPayment) => scheduledPayment.paymentReceipts)
      .flat()

    const totalAmountPaid = allPayments.reduce((acc, curr) => {
      return acc + curr.amount
    }, 0)

    const totalAmountExpected = scheduledPayments.reduce((acc, curr) => {
      return acc + curr.amount
    }, 0)

    return totalAmountExpected - totalAmountPaid
  }

  const Cell = ({ index, style }: { index: number; style: any }) => {
    let loanStartDate: Date | string = loans[index].loanStartDate
    if (typeof loanStartDate === 'string') {
      loanStartDate = DateTime.fromISO(loanStartDate).toLocaleString()
    } else {
      loanStartDate = DateTime.fromJSDate(loanStartDate).toLocaleString()
    }

    return (
      <div
        className="flex items-center px-6 py-3 text-base text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <Link
          to={`/loans/${loans[index].id}?${buildQueryStringFromSearchParams(
            searchParams
          )}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 80 }}
        >
          <div>{loans[index].loanNum}</div>
        </Link>

        <Link
          to={`/clients/${
            loans[index].clientId
          }?${buildQueryStringFromSearchParams(searchParams)}`}
          className="font-semibold text-blue-500 cursor-pointer"
          style={{ width: 250 }}
        >
          <div>{loans[index].client.name}</div>
        </Link>

        <div style={{ width: 100 }} className="text-center ">
          {`$${loans[index].amount.toLocaleString('en-US')}`}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {loanStartDate}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {`$${loans[index].dueMonthly.toLocaleString('en-US')}`}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {loans[index].status}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {getLastPaymentNum(loans[index])}
        </div>

        <div style={{ width: 80 }} className="text-center ">
          {getTimesLate(loans[index])}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {loans[index].status === LoanStatus.UNDISBURSED
            ? '-'
            : `$${getAmountOutstanding(loans[index]).toLocaleString('en-US')}`}
        </div>

        <div style={{ width: 80 }} className="text-center ">
          {loans[index].status === LoanStatus.UNDISBURSED && (
            <Link
              to={`/loans/${
                loans[index].id
              }/disburse?${buildQueryStringFromSearchParams(searchParams)}`}
              className="relative inline-flex items-center justify-center p-0.5  overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-600 hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <button className="relative w-full px-3 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 hover:bg-opacity-0">
                disburse
              </button>
            </Link>
          )}

          {loans[index].status === LoanStatus.ACTIVE && (
            <Link
              to={`/loans/${
                loans[index].id
              }/payments?${buildQueryStringFromSearchParams(searchParams)}`}
              className="relative inline-flex items-center justify-center p-0.5  overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-600 hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <button className="relative w-full px-3 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 hover:bg-opacity-0">
                payments
              </button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  const totalWidth = 48 + 80 + 250 + 100 + 100 + 100 + 100 + 100 + 80 + 100 + 80

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 80 }}>Loan #</div>
        <div style={{ width: 250 }}>Client Name</div>
        <div className="text-center" style={{ width: 100 }}>
          Loan Amt
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Loan Date
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Monthly Pmt
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Status
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Last Pmt #
        </div>
        <div className="text-center" style={{ width: 80 }}>
          Times Late
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Balance
        </div>
        <div className="text-center" style={{ width: 80 }}></div>
      </div>

      <List
        height={300}
        itemCount={loans.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default LoanList

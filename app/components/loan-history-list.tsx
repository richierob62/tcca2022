import { Link, useSearchParams } from '@remix-run/react'

import { FixedSizeList as List } from 'react-window'
import React from 'react'
import { buildQueryStringFromSearchParams } from '../util/query-string'
import type { ExpandedLoan } from '../routes/clients/$clientId'
import { DateTime } from 'luxon'
import { LoanStatus } from '@prisma/client'

interface Props {
  loans: ExpandedLoan[]
}

const LoanHistoryList: React.FC<Props> = ({ loans }) => {
  const [searchParams] = useSearchParams()

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
          style={{ width: 100 }}
        >
          <div>{loans[index].loanNum}</div>
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

        <div style={{ width: 100 }} className="text-center ">
          {getTimesLate(loans[index])}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {loans[index].status === LoanStatus.UNDISBURSED
            ? '-'
            : `$${getAmountOutstanding(loans[index]).toLocaleString('en-US')}`}
        </div>
      </div>
    )
  }

  const totalWidth = 48 + 100 + 100 + 100 + 100 + 100 + 100 + 100 + 100

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 100 }}>Loan #</div>
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
        <div className="text-center" style={{ width: 100 }}>
          Times Late
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Balance Outstanding
        </div>
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

export default LoanHistoryList

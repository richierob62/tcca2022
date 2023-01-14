import { Link, useSearchParams } from '@remix-run/react'
import type { LoanAdjustment, Receipt } from '@prisma/client'

import { DateTime } from 'luxon'
import type { ExpandedTransaction } from '~/routes/loans/$loanId/index'
import { FixedSizeList as List } from 'react-window'
import React from 'react'
import { TransactionType } from '@prisma/client'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  transactions: ExpandedTransaction[]
  receipts: Receipt[]
  adjustments: LoanAdjustment[]
  loanId: string
}

const LoanDetailsTable: React.FC<Props> = ({
  transactions,
  receipts,
  adjustments,
  loanId,
}) => {
  const [searchParams] = useSearchParams()

  const Cell = ({ index, style }: { index: number; style: any }) => {
    let activityDate: Date | string = transactions[index].date
    if (typeof activityDate === 'string') {
      activityDate = DateTime.fromISO(activityDate).toLocaleString()
    } else {
      activityDate = DateTime.fromJSDate(activityDate).toLocaleString()
    }

    let itemUrl = ''
    let linkLabel = ''
    let showLink = false

    if (transactions[index].activityType === TransactionType.RECEIPT) {
      const receipt = receipts.find(
        (receipt) => receipt.id === transactions[index].activityId
      )

      if (receipt) {
        itemUrl = `/loans/${loanId}/payments/${
          receipt.id
        }?${buildQueryStringFromSearchParams(searchParams)}`
        linkLabel = receipt.receiptNum
        showLink = true
      }
    }

    if (transactions[index].activityType === TransactionType.ADJUSTMENT) {
      const adjustment = adjustments.find(
        (adjustment) => adjustment.id === transactions[index].activityId
      )

      if (adjustment) {
        itemUrl = `/loans/${loanId}/adjustments/${
          adjustment.id
        }?${buildQueryStringFromSearchParams(searchParams)}`
        linkLabel = adjustment.adjustmentNum
        showLink = true
      }
    }

    return (
      <div
        className="flex items-center px-6 py-3 text-xs text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <div style={{ width: 100 }} className="">
          {transactions[index].activityType}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {activityDate}
        </div>

        <div style={{ width: 100 }} className="pr-3 text-right ">
          {`$${transactions[index].amount.toLocaleString('en-US')}`}
        </div>

        <div style={{ width: 100 }} className="pl-3 text-left ">
          {transactions[index].debitAccount!.name}
        </div>

        <div style={{ width: 100 }} className="pl-3 text-left ">
          {transactions[index].creditAccount!.name}
        </div>

        {showLink && (
          <Link
            to={itemUrl}
            className="font-semibold text-center text-blue-500 cursor-pointer"
            style={{ width: 80 }}
          >
            <div>{linkLabel}</div>
          </Link>
        )}
      </div>
    )
  }

  const totalWidth = 48 + 100 + 100 + 100 + 100 + 100 + 80

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 100 }}>Activity</div>
        <div className="text-center" style={{ width: 100 }}>
          Date
        </div>
        <div className="pr-3 text-right" style={{ width: 100 }}>
          Amount
        </div>
        <div className="pl-3 text-left" style={{ width: 100 }}>
          Debit
        </div>
        <div className="pl-3 text-left" style={{ width: 100 }}>
          Credit
        </div>
        <div className="text-center" style={{ width: 80 }}>
          Item #
        </div>
      </div>

      <List
        height={300}
        itemCount={transactions.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default LoanDetailsTable

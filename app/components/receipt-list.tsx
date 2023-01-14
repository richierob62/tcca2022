import { Link, useSearchParams } from '@remix-run/react'

import { DateTime } from 'luxon'
import type { ExpandedReceipt } from '../routes/loans/$loanId/payments'
import { FixedSizeList as List } from 'react-window'
import React from 'react'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  receipts: ExpandedReceipt[]
}

const ReceiptList: React.FC<Props> = ({ receipts }) => {
  const [searchParams] = useSearchParams()

  const Cell = ({ index, style }: { index: number; style: any }) => {
    let receiptDate: Date | string = receipts[index].receiptDate
    if (typeof receiptDate === 'string') {
      receiptDate = DateTime.fromISO(receiptDate).toLocaleString()
    } else {
      receiptDate = DateTime.fromJSDate(receiptDate).toLocaleString()
    }

    return (
      <div
        className="flex items-center px-6 py-3 text-sm text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <div style={{ width: 80 }} className="text-center ">
          {receipts[index].receiptNum}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {receiptDate}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {`$${receipts[index].amount.toLocaleString('en-US')}`}
        </div>

        <div style={{ width: 100 }} className="text-center ">
          {receipts[index].receivedBy.name}
        </div>

        <Link
          to={`${receipts[index].id}?${buildQueryStringFromSearchParams(
            searchParams
          )}`}
          style={{ width: 80 }}
          className="relative inline-flex items-center justify-center p-0.5  overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-600 hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
        >
          <button className="relative w-full px-3 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 hover:bg-opacity-0">
            print
          </button>
        </Link>
      </div>
    )
  }

  const totalWidth = 48 + 80 + 100 + 100 + 100 + 80

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 80 }}>Recpt #</div>
        <div className="text-center" style={{ width: 100 }}>
          Date
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Amt
        </div>
        <div className="text-center" style={{ width: 100 }}>
          Recvd By
        </div>
        <div className="" style={{ width: 80 }}></div>
      </div>

      <List
        height={300}
        itemCount={receipts.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default ReceiptList

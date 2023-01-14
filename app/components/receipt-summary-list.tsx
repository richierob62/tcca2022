import { Form, Link, useSearchParams } from '@remix-run/react'
import React, { useMemo } from 'react'

import { DateTime } from 'luxon'
import { FixedSizeList as List } from 'react-window'
import type { ReceiptSummary } from '../routes/reconciliation/index'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  receiptSummaries: ReceiptSummary[]
}

const ReceiptSummaryList: React.FC<Props> = ({
  receiptSummaries: rSummaries,
}) => {
  const [searchParams] = useSearchParams()

  const reconciliationSortBy = searchParams.get('reconciliationSortBy')
  const reconciliationSortDir = searchParams.get('reconciliationSortDir')

  const sortReturnValue = reconciliationSortDir === 'desc' ? 1 : -1

  const reconciliations = useMemo(() => {
    if (reconciliationSortBy === 'name') {
      rSummaries.sort((a, b) => {
        if (a.receiver.name.toLowerCase() < b.receiver.name.toLowerCase())
          return sortReturnValue
        if (a.receiver.name.toLowerCase() > b.receiver.name.toLowerCase())
          return sortReturnValue * -1
        return 0
      })
    } else {
      rSummaries.sort((a, b) => {
        if (a.date < b.date) return sortReturnValue
        if (a.date > b.date) return sortReturnValue * -1
        return 0
      })
    }

    return [...rSummaries]
  }, [reconciliationSortBy, rSummaries, sortReturnValue])

  const Cell = ({ index, style }: { index: number; style: any }) => {
    const summary = reconciliations[index]

    let receiptDate: Date | string = summary.date
    if (typeof receiptDate === 'string') {
      receiptDate = DateTime.fromISO(receiptDate).toLocaleString()
    } else {
      receiptDate = DateTime.fromJSDate(receiptDate).toLocaleString()
    }

    const isReconciled = summary.reconciled > 0

    return (
      <div
        className="flex items-center px-6 py-3 text-sm text-left text-gray-500 bg-white border-b group hover:bg-slate-200 "
        style={style}
      >
        <div style={{ width: 100 }} className="">
          {receiptDate}
        </div>

        <div style={{ width: 150 }} className="">
          {summary.receiver.name}
        </div>

        <Link
          to={`/reconciliation/receipts?${buildQueryStringFromSearchParams(
            searchParams
          )}date=${summary.date}&receiverId=${summary.receiver.id}`}
          className="font-semibold text-center text-blue-500 cursor-pointer"
          style={{ width: 100 }}
        >
          <div>{summary.count}</div>
        </Link>

        <div style={{ width: 100 }} className="text-right ">
          {`$${summary.total.toLocaleString('en-US')}`}
        </div>

        {isReconciled ? (
          <>
            <div style={{ width: 100 }} className="text-right ">
              {`$${summary.reconciled.toLocaleString('en-US')}`}
            </div>

            <div style={{ width: 100 }} className="text-right ">
              {summary.reconciled - summary.total === 0
                ? ''
                : summary.reconciled - summary.total < 0
                ? `-$${(summary.total - summary.reconciled).toLocaleString(
                    'en-US'
                  )}`
                : `$${(summary.reconciled - summary.total).toLocaleString(
                    'en-US'
                  )}`}
            </div>

            <div style={{ width: 250 }} className="pl-4 text-left">
              {summary.notes}
            </div>
          </>
        ) : (
          <Form className="flex" method="post">
            <div style={{ width: 100 }} className="pl-4 text-right">
              <input
                name={'amtReceived'}
                className="w-full border-2 border-red-100 rounded-md"
              />
              <input type="hidden" name={'date'} defaultValue={summary.date} />
              <input
                type="hidden"
                name={'receiverId'}
                defaultValue={summary.receiver.id}
              />
            </div>

            <div style={{ width: 100 }} className="text-right "></div>

            <div style={{ width: 250 }} className="pl-4 text-left ">
              <input
                name={'notes'}
                className="w-full border-2 border-red-100 rounded-md"
              />
            </div>

            <div style={{ width: 80 }} className="pl-4">
              <div className="flex items-center justify-center p-0.5  overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-600 hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
                <button
                  type="submit"
                  className="relative w-full px-2 py-1 transition-all duration-75 ease-in bg-white rounded-md hover:bg-opacity-0"
                >
                  close
                </button>
              </div>
            </div>
          </Form>
        )}
      </div>
    )
  }

  const totalWidth = 48 + 100 + 150 + 100 + 100 + 100 + 100 + 250 + 80

  return (
    <div className="relative overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div className="" style={{ width: 100 }}>
          Date
        </div>

        <div style={{ width: 150 }}>Received By</div>

        <div style={{ width: 100 }} className="text-center">
          # Receipts
        </div>

        <div className="text-right" style={{ width: 100 }}>
          Total Receipts
        </div>

        <div className="text-right" style={{ width: 100 }}>
          Amt Recvd
        </div>

        <div className="text-right" style={{ width: 100 }}>
          Variance
        </div>

        <div className="pl-4 text-left" style={{ width: 250 }}>
          Notes
        </div>

        <div className="text-center" style={{ width: 80 }}></div>
      </div>

      <List
        height={300}
        itemCount={reconciliations.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default ReceiptSummaryList

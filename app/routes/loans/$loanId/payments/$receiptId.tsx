import type { Client, Loan, User } from '@prisma/client'
import React, { useRef } from 'react'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'
import { useLoaderData, useSearchParams } from '@remix-run/react'

import { DateTime } from 'luxon'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import ReactToPrint from 'react-to-print'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { useNavigate } from '@remix-run/react'

type ExpandedReceipt = Awaited<ReturnType<typeof prisma.receipt.findUnique>> & {
  receivedBy: User
  client: Client
  paymentReceipts: ExpandedPaymentReceipt[]
}

type ExpandedPaymentReceipt = Awaited<
  ReturnType<typeof prisma.paymentReceipt.findUnique>
> & {
  scheduledPayment: ExpandedScheduledPayment
}

export type ExpandedScheduledPayment = Awaited<
  ReturnType<typeof prisma.scheduledPayment.findUnique>
> & {
  loan: Loan
}

interface LoaderData {
  loggedInUser: User
  receipt: ExpandedReceipt
  loanId: string
  nextPaymentDate: string | null
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.RECEIPT_VIEW]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const receiptId = params.receiptId
  const loanId = params.loanId

  if (!receiptId || !loanId)
    return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const receipt = await prisma.receipt.findUnique({
    where: {
      id: receiptId,
    },
    include: {
      client: true,
      receivedBy: true,
      paymentReceipts: {
        include: {
          scheduledPayment: {
            include: {
              loan: true,
            },
          },
        },
      },
    },
  })

  if (!receipt)
    return redirect(
      `/loans/${loanId}/payments?${buildQueryStringFromRequest(request)}`
    )

  const loan = await prisma.loan.findUnique({
    where: {
      id: loanId,
    },
    include: {
      scheduledPayments: {
        include: {
          paymentReceipts: true,
        },
      },
    },
  })

  const balanceByScheduledPayment = loan!.scheduledPayments.map(
    (scheduledPayment) => {
      const paymentReceipts = scheduledPayment.paymentReceipts

      const totalPaid = paymentReceipts.reduce((acc, curr) => {
        return acc + curr.amount
      }, 0)

      return {
        scheduledPayment,
        balance: scheduledPayment.amount - totalPaid,
      }
    }
  )

  const nextDueDate = balanceByScheduledPayment.filter(
    (scheduledPayment) => scheduledPayment.balance > 0
  )[0]?.scheduledPayment?.dueDate

  const nextPaymentDate = !nextDueDate
    ? null
    : typeof nextDueDate === 'string'
    ? DateTime.fromISO(nextDueDate).toLocaleString()
    : DateTime.fromJSDate(nextDueDate).toLocaleString()

  return json<LoaderData>({ loggedInUser, receipt, loanId, nextPaymentDate })
}

const Receipt = () => {
  const { loanId, receipt: r, nextPaymentDate } = useLoaderData<LoaderData>()

  const receipt = r as unknown as ExpandedReceipt

  const componentRef = useRef<any | null>(null)
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  const returnPath = `/loans/${loanId}/payments?${buildQueryStringFromSearchParams(
    searchParams
  )}`

  return (
    <div className="flex max-w-md mx-auto mt-4">
      <ReactToPrint
        trigger={() => (
          <div>
            <button className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
              <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Print
              </span>
            </button>
          </div>
        )}
        content={() => componentRef.current}
        onAfterPrint={() => navigate(returnPath)}
      />
      <PrintableReceipt
        ref={componentRef}
        receipt={receipt}
        nextPaymentDate={nextPaymentDate}
      />
    </div>
  )
}

const PrintableReceipt = React.forwardRef(
  (
    props: { receipt: ExpandedReceipt; nextPaymentDate: string | null },
    ref: any
  ) => {
    const { receipt, nextPaymentDate } = props
    return (
      <div ref={ref} className="flex flex-col w-full mx-2 bg-white ">
        <h1 className="w-full pt-4 mb-4 text-3xl font-extrabold leading-none tracking-tight text-center text-gray-900">
          The Central Cash Advance 2022 Limited
        </h1>
        <h2 className="w-full mb-8 text-2xl font-extrabold text-center dark:text-white">
          Payment Receipt
        </h2>
        <div className="flex flex-col items-center justify-center w-full pl-2 pr-4 space-y-2">
          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Customer No:</div>
            <div className="w-1/2 font-bold text-right">
              {receipt.client.clientNum}
            </div>
          </div>
          <div className="flex flex-col w-full text-md ">
            <div className="">Customer Name:</div>
            <div className="mb-4 font-bold">{receipt.client.name}</div>
          </div>

          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Receipt No:</div>
            <div className="w-1/2 font-bold text-right">
              {receipt.receiptNum}
            </div>
          </div>
          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Receipt Date:</div>
            <div className="w-1/2 font-bold text-right">
              {DateTime.fromJSDate(
                new Date(receipt.receiptDate)
              ).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Loan No:</div>
            <div className="w-1/2 font-bold text-right">
              {receipt.paymentReceipts[0].scheduledPayment.loan.loanNum}
            </div>
          </div>

          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Payment Amt:</div>
            <div className="w-1/2 font-bold text-right">
              {`$${receipt.amount.toLocaleString('en-US')}`}
            </div>
          </div>
          <div className="flex flex-col w-full text-md ">
            <div className="mt-4">Received By:</div>
            <div className="font-bold">{receipt.receivedBy.name}</div>
          </div>
          {nextPaymentDate && (
            <div className="flex flex-row w-full text-md">
              <div className="w-1/2 mt-12 ">Next Payment Date:</div>
              <div className="w-1/2 mt-12 font-bold text-right">
                {nextPaymentDate}
              </div>
            </div>
          )}
          <div className="flex flex-row w-full text-md">
            <div className="w-full mb-20 text-lg font-bold text-center mt-14">
              Thank you for your payment
            </div>
          </div>
        </div>
      </div>
    )
  }
)

export default Receipt

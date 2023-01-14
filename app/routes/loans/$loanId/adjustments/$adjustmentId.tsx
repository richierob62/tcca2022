import type { Client, User } from '@prisma/client'
import React, { useRef } from 'react'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'
import { useLoaderData, useSearchParams } from '@remix-run/react'

import { DateTime } from 'luxon'
import type { ExpandedAdjustment } from '.'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import ReactToPrint from 'react-to-print'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { useNavigate } from '@remix-run/react'

type ExpandedLoan = Awaited<ReturnType<typeof prisma.loan.findUnique>> & {
  client: Client
}

interface LoaderData {
  loggedInUser: User
  adjustment: ExpandedAdjustment
  loan: ExpandedLoan
}

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.RECEIPT_VIEW]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const adjustmentId = params.adjustmentId
  const loanId = params.loanId

  if (!adjustmentId || !loanId)
    return redirect(`/loans?${buildQueryStringFromRequest(request)}`)

  const adjustment = await prisma.loanAdjustment.findUnique({
    where: {
      id: adjustmentId,
    },
    include: {
      createdBy: true,
    },
  })

  if (!adjustment)
    return redirect(
      `/loans/${loanId}/adjustments?${buildQueryStringFromRequest(request)}`
    )

  const loan = await prisma.loan.findUnique({
    where: {
      id: loanId,
    },
    include: {
      client: true,
    },
  })

  if (!loan)
    return redirect(
      `/loans/${loanId}/adjustments?${buildQueryStringFromRequest(request)}`
    )

  return json<LoaderData>({ loggedInUser, adjustment, loan })
}

const Adjustment = () => {
  const { loan: l, adjustment: a } = useLoaderData<LoaderData>()

  const loan = l as unknown as ExpandedLoan
  const adjustment = a as unknown as ExpandedAdjustment

  const componentRef = useRef<any | null>(null)
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()

  const returnPath = `/loans/${
    loan.id
  }/adjustments?${buildQueryStringFromSearchParams(searchParams)}`

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
      <PrintableAdjustment
        ref={componentRef}
        adjustment={adjustment}
        loan={loan}
      />
    </div>
  )
}

const PrintableAdjustment = React.forwardRef(
  (props: { adjustment: ExpandedAdjustment; loan: ExpandedLoan }, ref: any) => {
    const { adjustment, loan } = props
    return (
      <div ref={ref} className="flex flex-col w-full mx-2 bg-white ">
        <h1 className="w-full pt-4 mb-4 text-3xl font-extrabold leading-none tracking-tight text-center text-gray-900">
          The Central Cash Advance 2022 Limited
        </h1>
        <h2 className="w-full mb-8 text-2xl font-extrabold text-center dark:text-white">
          Loan Adjustment
        </h2>
        <div className="flex flex-col items-center justify-center w-full pl-2 pr-4 mb-6 space-y-2">
          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Customer No:</div>
            <div className="w-1/2 font-bold text-right">
              {loan.client.clientNum}
            </div>
          </div>
          <div className="flex flex-col w-full text-md ">
            <div className="">Customer Name:</div>
            <div className="mb-4 font-bold">{loan.client.name}</div>
          </div>

          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Adjustment No:</div>
            <div className="w-1/2 font-bold text-right">
              {adjustment.adjustmentNum}
            </div>
          </div>
          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Adjustment Date:</div>
            <div className="w-1/2 font-bold text-right">
              {DateTime.fromJSDate(
                new Date(adjustment.createdAt)
              ).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Loan No:</div>
            <div className="w-1/2 font-bold text-right">{loan.loanNum}</div>
          </div>

          <div className="flex flex-row w-full text-md ">
            <div className="w-1/2 ">Adjustment Amt:</div>
            <div className="w-1/2 font-bold text-right">
              {`-$${adjustment.amount.toLocaleString('en-US')}`}
            </div>
          </div>
          <div className="flex flex-col w-full text-md ">
            <div className="mt-4">Issued By:</div>
            <div className="font-bold">{adjustment.createdBy.name}</div>
          </div>
        </div>
      </div>
    )
  }
)

export default Adjustment

import type {
  ExpandedLoan,
  ExpandedScheduledPayment,
} from '../routes/loans/$loanId/payments'
import React, { useCallback, useEffect } from 'react'

import { DateTime } from 'luxon'
import Input from './form/input'
import { Permission } from '@prisma/client'
import type { User } from '@prisma/client'
import { ValidatedForm } from 'remix-validated-form'
import { queryStringOptions } from '../util/query-string'
import { useSearchParams } from '@remix-run/react'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

interface Props {
  loan: ExpandedLoan
  loggedInUser: User
  unearnedInterest: number
  principalBalance: number
}

const schema = z.object({
  amount: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Please enter a valid amount',
    }),
})

export const clientValidator = withZod(schema)

const AdjustmentEntryWithPaymentScheduleTable: React.FC<Props> = ({
  loan,
  loggedInUser,
  unearnedInterest,
  principalBalance,
}) => {
  const [searchParams] = useSearchParams()

  const [unearnedInterestAllocation, setUnearnedInterestAllocation] =
    React.useState(0)

  const [badDebtAllocation, setBadDebtAllocation] = React.useState(0)

  const calculateAllocation = useCallback(
    (amount: number) => {
      setUnearnedInterestAllocation(Math.min(amount, unearnedInterest))
      const bal = amount - unearnedInterest
      setBadDebtAllocation(Math.max(0, bal))
    },
    [unearnedInterest]
  )

  const canEnterPayment = loggedInUser.permissions.includes(
    Permission.RECEIPT_CREATE
  )

  const paymentNumber = (payment: ExpandedScheduledPayment) => {
    const numPaymantes = loan.numPayments
    return `${payment.paymentNumber}/${numPaymantes}`
  }

  const amountOutstanding = (payment: ExpandedScheduledPayment) => {
    const totalAmountPaid = payment.paymentReceipts.reduce((acc, curr) => {
      return acc + curr.amount
    }, 0)

    return payment.amount - totalAmountPaid
  }

  interface RowProps {
    payment: ExpandedScheduledPayment
  }

  const Row: React.FC<RowProps> = ({ payment }) => {
    return (
      <tr className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
        <th
          scope="row"
          className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white"
        >
          {paymentNumber(payment)}
        </th>
        <td className="px-6 py-4">
          {DateTime.fromJSDate(new Date(payment.dueDate)).toLocaleString()}
        </td>
        <td className="px-6 py-4">
          {`$${amountOutstanding(payment).toLocaleString('en-US')}`}
        </td>
      </tr>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {canEnterPayment && (
        <div className="flex w-full p-1">
          <ValidatedForm
            className="w-full"
            method="post"
            validator={clientValidator}
            resetAfterSubmit={true}
          >
            <div className="flex flex-col items-center w-full rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              <div className="w-full mb-2 text-center">
                <Input
                  name={'amount'}
                  label={'Adjustment Amount'}
                  type={'number'}
                  onChange={(e) => calculateAllocation(Number(e.target.value))}
                />
              </div>

              <div className="w-full mb-4">
                <div className="flex justify-end">Allocation</div>
                <div className="flex justify-between ">
                  <div>{`Unearned Interest ($${unearnedInterest.toLocaleString(
                    'en-US'
                  )})`}</div>
                  <div>{`$${unearnedInterestAllocation.toLocaleString(
                    'en-US'
                  )}`}</div>
                </div>
                <div className="flex justify-between ">
                  <div>{`Bad Debt / Int Adj ($${principalBalance.toLocaleString(
                    'en-US'
                  )})`}</div>
                  <div>{`$${badDebtAllocation.toLocaleString('en-US')}`}</div>
                </div>
              </div>

              <div className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
                <button
                  type="submit"
                  name="action"
                  value="adjustment"
                  className="relative w-full px-5 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0"
                >
                  Record Adjustment
                </button>
              </div>
            </div>

            {queryStringOptions.map((option, idx) => {
              return (
                <input
                  type="hidden"
                  key={idx}
                  name={option}
                  value={searchParams.get(option) || undefined}
                  readOnly
                  aria-hidden
                />
              )
            })}
          </ValidatedForm>
        </div>
      )}

      <h1 className="w-full mt-8 mb-2 text-center">Scheduled Payments</h1>

      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th scope="col" className="px-6 py-3">
              Pmt #
            </th>
            <th scope="col" className="px-6 py-3">
              Due
            </th>
            <th scope="col" className="px-6 py-3">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {loan.scheduledPayments
            .sort((a, b) => a.paymentNumber - b.paymentNumber)
            .map((sp) => (
              <Row key={sp.id} payment={sp} />
            ))}
        </tbody>
      </table>
    </div>
  )
}

export default AdjustmentEntryWithPaymentScheduleTable

import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import type { Client, User } from '@prisma/client'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import CallHistory from '~/components/call-history'
import { DateTime } from 'luxon'
import Input from '~/components/form/input'
import { Permission } from '@prisma/client'
import TextArea from '~/components/form/textarea'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

export type ExpandedCallHistory = Awaited<
  ReturnType<typeof prisma.callHistory.findUnique>
> & {
  calledBy: User
}

type ExpandedScheduledPayment = Awaited<
  ReturnType<typeof prisma.scheduledPayment.findUnique>
> & {
  loan: ExpandedLoan
  callHistory: ExpandedCallHistory[]
}

export type ExpandedLoan = Awaited<
  ReturnType<typeof prisma.loan.findUnique>
> & {
  approvedBy: User
  client: Client
}
interface LoaderData {
  loggedInUser: User
  scheduledPayment: ExpandedScheduledPayment
}

const schema = z.object({
  note: z.string().min(1, { message: 'Please write something!' }),
  promiseDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Please enter a valid date',
    }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [Permission.RECEIPT_VIEW]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const scheduledPaymentId = params.scheduledPaymentId

  if (!scheduledPaymentId)
    return redirect(
      `/loans/scheduled-payments?${buildQueryStringFromRequest(request)}`
    )

  const scheduledPayment = await prisma.scheduledPayment.findUnique({
    where: {
      id: scheduledPaymentId,
    },
    include: {
      loan: {
        include: {
          approvedBy: true,
          client: true,
        },
      },
      callHistory: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          calledBy: true,
        },
      },
    },
  })

  if (!scheduledPayment)
    return redirect(
      `/loans/scheduled-payments?${buildQueryStringFromRequest(request)}`
    )

  return json<LoaderData>({ loggedInUser, scheduledPayment })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.CALL_LOG]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(schema)

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    return validationError(data.error)
  }

  const scheduledPaymentId = params.scheduledPaymentId

  const { note: n, promiseDate: promD } = data.data

  let promiseDate: Date | null = null
  if (promD) {
    const pd = new Date(promD)
    const offset = pd.getTimezoneOffset()
    promiseDate = new Date(pd.getTime() + offset * 60 * 1000)
  }

  const note =
    n.trim() +
    ` (Promised Date set to ${
      promiseDate ? DateTime.fromJSDate(promiseDate).toLocaleString() : 'none'
    })`

  await prisma.scheduledPayment.update({
    where: {
      id: scheduledPaymentId,
    },
    data: {
      promiseDate,
      callHistory: {
        create: {
          note,
          calledBy: {
            connect: {
              id: loggedInUser.id,
            },
          },
        },
      },
    },
  })

  return redirect(
    `/loans/scheduled-payments?${buildQueryStringFromRequest(request)}`
  )
}

const ScheduledPaymentDetails = () => {
  const { scheduledPayment: sp, loggedInUser } = useLoaderData<LoaderData>()

  const scheduledPayment = sp as unknown as ExpandedScheduledPayment

  const callHistory = scheduledPayment.callHistory

  const [searchParams] = useSearchParams()

  const getPaymentNum = (scheduledPayment: ExpandedScheduledPayment) => {
    const numPaymantes = scheduledPayment.loan.numPayments

    return `${scheduledPayment.paymentNumber}/${numPaymantes}`
  }

  const dueDate = (scheduledPayment: ExpandedScheduledPayment) => {
    const dd = scheduledPayment.dueDate

    return typeof dd === 'string'
      ? DateTime.fromISO(dd).toLocaleString()
      : DateTime.fromJSDate(dd).toLocaleString()
  }

  const promiseDateString = scheduledPayment.promiseDate
    ? DateTime.fromJSDate(new Date(scheduledPayment.promiseDate)).toFormat(
        'yyyy-MM-dd'
      )
    : ''

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full space-x-6">
        <div className="w-5/12 text-sm">
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Name</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/clients/${
                  scheduledPayment.loan.client.id
                }?${buildQueryStringFromSearchParams(searchParams)}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{scheduledPayment.loan.client.name}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Number</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/clients/${
                  scheduledPayment.loan.client.id
                }?${buildQueryStringFromSearchParams(searchParams)}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{scheduledPayment.loan.client.clientNum}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Phone #</div>
            <div className="w-2/3 font-semibold">
              {scheduledPayment.loan.client.phone}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Loan Number</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/loans/${
                  scheduledPayment.loan.id
                }?${buildQueryStringFromSearchParams(searchParams)}`}
                className="font-semibold text-blue-500 cursor-pointer"
              >
                <div>{scheduledPayment.loan.loanNum}</div>
              </Link>
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Payment #</div>
            <div className="w-2/3 font-semibold">
              {getPaymentNum(scheduledPayment)}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Payment Amount</div>
            <div className="w-2/3 font-semibold">
              {`$${scheduledPayment.amount.toLocaleString('en-US')}`}
            </div>
          </div>

          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Due Date</div>
            <div className="w-2/3 font-semibold">
              {dueDate(scheduledPayment)}
            </div>
          </div>
        </div>

        <div className="flex-col w-7/12 text-sm">
          <div className="flex w-full p-1">
            <ValidatedForm
              className="w-full"
              method="post"
              validator={clientValidator}
              defaultValues={{ note: '', promiseDate: promiseDateString }}
              resetAfterSubmit={true}
            >
              <div className="w-full rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                <div className="mb-2 w-36">
                  <Input
                    name={'promiseDate'}
                    label={'Promised Date'}
                    type={'date'}
                  />
                </div>

                <div className="px-4 py-2 mb-2 bg-white border-2 rounded-t-lg border-slate-200 dark:bg-gray-800">
                  <TextArea
                    name={'note'}
                    label={'Enter notes from call here...'}
                  ></TextArea>
                </div>

                <div className="relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-xs font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800">
                  <button
                    type="submit"
                    className="relative w-full px-5 py-1 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0"
                  >
                    Save Note
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
          <div className="flex flex-col w-full border-2 rounded-t-lg border-slate-200">
            <CallHistory callHistory={callHistory} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScheduledPaymentDetails

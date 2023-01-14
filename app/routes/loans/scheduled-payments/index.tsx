import type { Client, Receipt, User } from '@prisma/client'
import { json, redirect } from '@remix-run/node'

import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import ScheduledPaymentList from '~/components/scheduled-payment-list'
import ScheduledPaymentSearch from '~/components/scheduled-payment-search'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

type ExpandedPaymentReceipt = Awaited<
  ReturnType<typeof prisma.paymentReceipt.findUnique>
> & {
  receipt: Receipt
}

type ExpandedCallHistory = Awaited<
  ReturnType<typeof prisma.callHistory.findUnique>
> & {
  calledBy: User
}

export type ExpandedScheduledPayment = Awaited<
  ReturnType<typeof prisma.scheduledPayment.findUnique>
> & {
  loan: ExpandedLoan
  paymentReceipts: ExpandedPaymentReceipt[]
  callHistory: ExpandedCallHistory[]
}

export type ExpandedLoan = Awaited<
  ReturnType<typeof prisma.loan.findUnique>
> & {
  client: Client
}

interface LoaderData {
  loggedInUser: User
  scheduledPayments: ExpandedScheduledPayment[]
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.CALL_LOG]
  const loggedInUser = await authenticatedUser(request, permissions)

  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)

  const scheduledPaymentFilter = url.searchParams.get('scheduledPaymentFilter')
  const scheduledPaymentFilterStartDate = url.searchParams.get(
    'scheduledPaymentFilterStartDate'
  )
  const scheduledPaymentFilterEndDate = url.searchParams.get(
    'scheduledPaymentFilterEndDate'
  )

  let filter = {}

  if (
    scheduledPaymentFilter &&
    scheduledPaymentFilter !== 'undefined' &&
    scheduledPaymentFilter !== 'null'
  )
    filter = {
      ...filter,
      loan: {
        OR: [
          {
            client: {
              name: {
                contains: scheduledPaymentFilter,
                mode: 'insensitive',
              },
            },
          },
          {
            loanNum: {
              contains: scheduledPaymentFilter,
              mode: 'insensitive',
            },
          },
        ],
      },
    }

  if (
    scheduledPaymentFilterStartDate &&
    scheduledPaymentFilterStartDate !== 'undefined' &&
    scheduledPaymentFilterEndDate &&
    scheduledPaymentFilterEndDate !== 'undefined'
  ) {
    const st = new Date(scheduledPaymentFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    const et = new Date(`${scheduledPaymentFilterEndDate}T23:59:59.999Z`)
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      dueDate: {
        gte: st2,
        lte: et2,
      },
    }
  } else if (
    scheduledPaymentFilterStartDate &&
    scheduledPaymentFilterStartDate !== 'undefined'
  ) {
    const st = new Date(scheduledPaymentFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      dueDate: { gte: st2 },
    }
  } else if (
    scheduledPaymentFilterEndDate &&
    scheduledPaymentFilterEndDate !== 'undefined'
  ) {
    const et = new Date(`${scheduledPaymentFilterEndDate}T23:59:59.999Z`)
    const offset = et.getTimezoneOffset()
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      dueDate: { lte: et2 },
    }
  }

  const scheduledPayments = await prisma.scheduledPayment.findMany({
    where: filter as any,
    include: {
      loan: {
        include: {
          client: true,
        },
      },
      paymentReceipts: {
        include: {
          receipt: true,
        },
      },
      callHistory: {
        include: {
          calledBy: true,
        },
      },
    },
  })

  return json<LoaderData>({ scheduledPayments, loggedInUser })
}

export default function ScheduledPaymentRoute() {
  const { scheduledPayments, loggedInUser } =
    useLoaderData() as unknown as LoaderData

  return (
    <div>
      <div className="mt-6 mb-6">
        <ScheduledPaymentSearch />
      </div>
      <ScheduledPaymentList
        scheduledPayments={scheduledPayments}
        loggedInUser={loggedInUser}
      />
    </div>
  )
}

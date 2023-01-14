import { ActionFunction, json, redirect } from '@remix-run/node'
import type { Client, Loan, LoanApplication, User } from '@prisma/client'

import ApplicationList from '~/components/application-list'
import ApplicationSearch from '~/components/application-search'
import type { LoaderFunction } from '@remix-run/node'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { buildQueryStringFromSearchParams } from '../../../util/query-string'
import { prisma } from '~/util/prisma.server'
import { useLoaderData } from '@remix-run/react'

export interface ExpandedAppication extends LoanApplication {
  client: Client
  createdBy: User
  loan?: Partial<Loan> | null
}

type LoaderData = {
  applications: ExpandedAppication[]
}

export const loader: LoaderFunction = async ({ request }) => {
  const permissions = [Permission.APPLICATION_LIST]
  const loggedInUser = await authenticatedUser(request, permissions)

  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const url = new URL(request.url)

  const applicationFilter = url.searchParams.get('applicationFilter')
  const applicationFilterStartDate = url.searchParams.get(
    'applicationFilterStartDate'
  )
  const applicationFilterEndDate = url.searchParams.get(
    'applicationFilterEndDate'
  )
  const applicationFilterStatus = url.searchParams.get(
    'applicationFilterStatus'
  )

  let filter = {}

  if (
    applicationFilter &&
    applicationFilter !== 'undefined' &&
    applicationFilter !== 'null'
  )
    filter = {
      ...filter,
      OR: [
        {
          client: {
            name: {
              contains: applicationFilter,
              mode: 'insensitive',
            },
          },
        },
        {
          client: {
            clientNum: {
              contains: applicationFilter,
              mode: 'insensitive',
            },
          },
        },
        {
          applicationNum: {
            contains: applicationFilter,
            mode: 'insensitive',
          },
        },
        {
          loan: {
            loanNum: {
              contains: applicationFilter,
              mode: 'insensitive',
            },
          },
        },
      ],
    }

  if (
    applicationFilterStartDate &&
    applicationFilterStartDate !== 'undefined' &&
    applicationFilterEndDate &&
    applicationFilterEndDate !== 'undefined'
  ) {
    const st = new Date(applicationFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    const et = new Date(`${applicationFilterEndDate}T23:59:59.999Z`)
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      applicationDate: {
        gte: st2,
        lte: et2,
      },
    }
  } else if (
    applicationFilterStartDate &&
    applicationFilterStartDate !== 'undefined'
  ) {
    const st = new Date(applicationFilterStartDate)
    const offset = st.getTimezoneOffset()
    const st2 = new Date(st.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      applicationDate: {
        gte: st2,
      },
    }
  } else if (
    applicationFilterEndDate &&
    applicationFilterEndDate !== 'undefined'
  ) {
    const et = new Date(`${applicationFilterEndDate}T23:59:59.999Z`)
    const offset = et.getTimezoneOffset()
    const et2 = new Date(et.getTime() + offset * 60 * 1000)

    filter = {
      ...filter,
      applicationDate: {
        lte: et2,
      },
    }
  }

  if (
    applicationFilterStatus &&
    applicationFilterStatus !== 'undefined' &&
    applicationFilterStatus !== 'null' &&
    applicationFilterStatus !== 'All'
  )
    filter = {
      ...filter,
      status: applicationFilterStatus,
    }

  const applications = await prisma.loanApplication.findMany({
    where: filter as any,
    include: {
      client: true,
      createdBy: true,
      loan: true,
    },
  })

  return json<LoaderData>({ applications })
}

export default function ApplicationRoute() {
  const { applications } = useLoaderData() as unknown as LoaderData

  return (
    <div>
      <div className="mt-6 mb-6">
        <ApplicationSearch />
      </div>
      <ApplicationList applications={applications} />
    </div>
  )
}

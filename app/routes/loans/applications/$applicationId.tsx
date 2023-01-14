import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import type { Client, Loan, User } from '@prisma/client'
import { Form, Link, useLoaderData, useSearchParams } from '@remix-run/react'
import React, { useState } from 'react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
  queryStringOptions,
} from '~/util/query-string'

import { DateTime } from 'luxon'
import Input from '~/components/form/input'
import { LoanApplicationStatus } from '@prisma/client'
import { LoanStatus } from '@prisma/client'
import { Permission } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

type ExpandedLoanApplication = Awaited<
  ReturnType<typeof prisma.loanApplication.findUnique>
> & {
  loan:
    | (Loan & {
        approvedBy: User
      })
    | null
  client: Client
}
interface LoaderData {
  loggedInUser: User
  application: ExpandedLoanApplication
}

const schema = z.object({
  loanStartDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Start date required',
  }),
  amount: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Please enter a valid amount',
    }),
  interestRate: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Please enter a valid amount',
    }),
  numPayments: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Please enter a valid amount',
    }),
  action: z.string(),
})

export const approvalClientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [
    Permission.APPLICATION_DECISION,
    Permission.APPLICATION_CREATE,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const applicationId = params.applicationId

  if (!applicationId)
    return redirect(
      `/loans/applications?${buildQueryStringFromRequest(request)}`
    )

  const application = await prisma.loanApplication.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      loan: {
        include: {
          approvedBy: true,
        },
      },
      client: true,
    },
  })

  if (!application)
    return redirect(
      `/loans/applications?${buildQueryStringFromRequest(request)}`
    )

  return json<LoaderData>({ loggedInUser, application })
}

export const action: ActionFunction = async ({ request, params }) => {
  const permissions = [Permission.APPLICATION_CREATE]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const applicationId = params.applicationId

  if (!applicationId)
    return redirect(
      `/loans/applications?${buildQueryStringFromRequest(request)}`
    )

  const fd = await request.formData()

  const formAction = fd.get('action')

  if (formAction === 'deny') {
    await prisma.loanApplication.update({
      where: {
        id: applicationId,
      },
      data: {
        status: LoanApplicationStatus.DENIED,
      },
    })

    return redirect(
      `/loans/applications?${buildQueryStringFromRequest(request)}`
    )
  }

  const serverValidator = withZod(schema)

  const data = await serverValidator.validate(fd)

  if (data.error) {
    return validationError(data.error)
  }

  const application = await prisma.loanApplication.findUnique({
    where: {
      id: applicationId,
    },
    include: {
      client: true,
    },
  })

  const {
    loanStartDate: lsd,
    amount: a,
    interestRate: ir,
    numPayments: np,
  } = data.data

  const lsd2 = new Date(lsd)
  const offset = lsd2.getTimezoneOffset()
  const loanStartDate = new Date(lsd2.getTime() + offset * 60 * 1000)

  const amount = Number(a)
  const interestRate = Number(ir)
  const numPayments = Number(np)

  let totalInterest = amount * (interestRate / 100) * numPayments
  let totalPayments = amount + totalInterest
  const monthlyPayment = Math.ceil(totalPayments / numPayments)
  totalPayments = monthlyPayment * numPayments
  totalInterest = totalPayments - amount

  const getNextLoanNumber = async () => {
    const lastLoan = await prisma.loan.findFirst({
      orderBy: {
        loanNum: 'desc',
      },
    })
    if (!lastLoan) return '10000'
    return `${parseInt(lastLoan.loanNum, 10) + 1}`
  }

  await prisma.loanApplication.update({
    where: {
      id: applicationId,
    },
    data: {
      status: LoanApplicationStatus.APPROVED,
    },
  })

  const newLoan = await prisma.loan.create({
    data: {
      loanNum: await getNextLoanNumber(),
      loanStartDate,
      amount,
      interestRate,
      numPayments,
      initialUnearnedInterest: totalInterest,
      dueMonthly: monthlyPayment,
      status: LoanStatus.UNDISBURSED,
      loanApplication: {
        connect: {
          id: applicationId,
        },
      },
      client: {
        connect: {
          id: application!.client.id,
        },
      },
      approvedBy: {
        connect: {
          id: loggedInUser.id,
        },
      },
    },
  })

  // calculate scheduled payment dates
  const paymentDates = []
  for (let i = 0; i < numPayments; i++) {
    const payDate = DateTime.fromJSDate(loanStartDate)
      .plus({
        months: i + 1,
      })
      .toISO()
    paymentDates.push(payDate)
  }

  const loanPaymentData = paymentDates.map((date, idx) => ({
    dueDate: new Date(date),
    paymentNumber: idx + 1,
    amount: monthlyPayment,
    loanId: newLoan.id,
  }))

  await prisma.scheduledPayment.createMany({
    data: loanPaymentData,
  })

  return redirect(
    `/loans/applications/?${buildQueryStringFromRequest(request)}`
  )
}

const ApplicationDetails = () => {
  const { application: appl, loggedInUser } = useLoaderData<LoaderData>()

  const application = appl as unknown as ExpandedLoanApplication
  const client = application.client!

  const canApproveApplication = loggedInUser.permissions.includes(
    Permission.APPLICATION_DECISION
  )

  const [searchParams] = useSearchParams()

  return (
    <div className="flex flex-col w-full p-4 mt-10 space-y-6 border border-gray-200 rounded-lg shadow-md bg-slate-50 sm:p-6 md:p-8 text-slate-900">
      <div className="flex w-full space-x-6">
        <div className="w-5/12 text-sm">
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Name</div>
            <div className="w-2/3 font-semibold">
              <Link
                to={`/clients/${client.id}?${buildQueryStringFromSearchParams(
                  searchParams
                )}`}
                className="font-semibold text-blue-500 cursor-pointer"
                style={{ width: 100 }}
              >
                <div>{client.name}</div>
              </Link>
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Client Number</div>
            <div className="w-2/3 font-semibold">{client.clientNum}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Date Birth</div>
            <div className="w-2/3 font-semibold">
              {typeof client.dateBirth === 'string'
                ? DateTime.fromISO(client.dateBirth).toLocaleString()
                : DateTime.fromJSDate(client.dateBirth).toLocaleString()}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Occupation</div>
            <div className="w-2/3 font-semibold">{client.occupation}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Address</div>
            <div className="w-2/3 font-semibold">
              {[
                client.address.street,
                client.address.town,
                client.address.parish,
              ].join(', ')}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Phone</div>
            <div className="w-2/3 font-semibold">{client.phone}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">License / TRN</div>
            <div className="w-2/3 font-semibold">{client.driverTrn}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">2nd ID Type</div>
            <div className="w-2/3 font-semibold">{client.secondIdType}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">2nd ID Number</div>
            <div className="w-2/3 font-semibold">{client.secondIdNumber}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Emergency Contact</div>
            <div className="w-2/3 font-semibold">{client.otherContactName}</div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Contact Relationship</div>
            <div className="w-2/3 font-semibold">
              {client.otherContactRelation}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Contact Phone</div>
            <div className="w-2/3 font-semibold">
              {client.otherContactPhone}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Max Loan Amount</div>
            <div className="w-2/3 font-semibold">
              {`$${client.maxLoanAmount.toLocaleString('en-US')}`}
            </div>
          </div>
          <div className="flex w-full p-1">
            <div className="w-1/3 mr-4 text-right">Max Concurrent Loans</div>
            <div className="w-2/3 font-semibold">{client.maxActiveLoans}</div>
          </div>
        </div>

        <div className="w-7/12 text-sm">
          <div className="flex flex-col w-full p-4 mb-4 bg-white rounded-lg shadow-md">
            <div className="flex w-full p-1">
              <div className="w-1/3 mr-4 text-right">Application Date</div>
              <div className="w-2/3 font-semibold">
                {typeof application.applicationDate === 'string'
                  ? DateTime.fromISO(
                      application.applicationDate
                    ).toLocaleString()
                  : DateTime.fromJSDate(
                      application.applicationDate
                    ).toLocaleString()}
              </div>
            </div>
            <div className="flex w-full p-1">
              <div className="w-1/3 mr-4 text-right">Requested Start Date</div>
              <div className="w-2/3 font-semibold">
                {typeof application.requestedDisbursementDate === 'string'
                  ? DateTime.fromISO(
                      application.requestedDisbursementDate
                    ).toLocaleString()
                  : DateTime.fromJSDate(
                      application.requestedDisbursementDate
                    ).toLocaleString()}
              </div>
            </div>
            <div className="flex w-full p-1">
              <div className="w-1/3 mr-4 text-right">Requested Loan Amount</div>
              <div className="w-2/3 font-semibold">
                {`$${application.requestedAmount.toLocaleString('en-US')}`}
              </div>
            </div>
            <div className="flex w-full p-1">
              <div className="w-1/3 mr-4 text-right">
                Requested Term (months)
              </div>
              <div className="w-2/3 font-semibold">
                {application.requestedTerm}
              </div>
            </div>
            <div className="flex w-full p-1">
              <div className="w-1/3 mr-4 text-right">Purpose of Loan</div>
              <div className="w-2/3 font-semibold">{application.purpose}</div>
            </div>
          </div>

          <div className="flex w-full space-x-2">
            {application.status !== LoanApplicationStatus.PENDING ? (
              <ExistingDetails
                application={application}
                searchParams={searchParams}
              />
            ) : canApproveApplication ? (
              <>
                <ApprovalForm
                  application={application}
                  searchParams={searchParams}
                />
                <DenialForm
                  application={application}
                  searchParams={searchParams}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApplicationDetails

interface ExistingDetailsProps {
  application: ExpandedLoanApplication
  searchParams: URLSearchParams
}

const ExistingDetails: React.FC<ExistingDetailsProps> = ({
  application,
  searchParams,
}) => {
  if (application.status === LoanApplicationStatus.DENIED)
    return (
      <div className="flex flex-col w-full p-4 mb-4 text-red-400 bg-white rounded-lg shadow-md">
        {`This application was denied on ${
          typeof application.updatedAt === 'string'
            ? DateTime.fromISO(application.updatedAt).toLocaleString()
            : DateTime.fromJSDate(application.updatedAt).toLocaleString()
        }`}
      </div>
    )

  const loan = application.loan

  return (
    <div className="flex flex-col items-start w-full p-4 mb-4 bg-white rounded-lg shadow-md">
      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Status</div>
        <div className="w-2/3 font-semibold">{application.status}</div>
      </div>

      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Approved By</div>
        <div className="w-2/3 font-semibold">
          {`${application.loan?.approvedBy.name} on ${
            typeof application.loan?.createdAt === 'string'
              ? DateTime.fromISO(application.loan?.createdAt).toLocaleString()
              : DateTime.fromJSDate(
                  application.loan!.createdAt
                ).toLocaleString()
          }`}
        </div>
      </div>

      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Loan</div>
        <div className="w-2/3 font-semibold">
          <Link
            to={`/loans/${
              application.loan?.id
            }?${buildQueryStringFromSearchParams(searchParams)}`}
            className="font-semibold text-blue-500 cursor-pointer"
          >
            <div>{application.loan?.loanNum}</div>
          </Link>
        </div>
      </div>

      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Monthly Payment</div>
        <div className="w-2/3 font-semibold">
          {`$${loan?.dueMonthly.toLocaleString('en-US')}`}
        </div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right"># Payments</div>
        <div className="w-2/3 font-semibold">{loan?.numPayments}</div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Principal</div>
        <div className="w-2/3 font-semibold">
          {`$${loan?.amount.toLocaleString('en-US')}`}
        </div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Total Interest</div>
        <div className="w-2/3 font-semibold">
          {`$${loan?.initialUnearnedInterest.toLocaleString('en-US')}`}
        </div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/3 mr-4 text-right">Total Payments</div>
        <div className="w-2/3 font-semibold">
          {`$${(
            (loan?.initialUnearnedInterest || 0) + (loan?.amount || 0)
          ).toLocaleString('en-US')}`}
        </div>
      </div>
    </div>
  )
}

interface ApprovalFormProps {
  application: ExpandedLoanApplication
  searchParams: URLSearchParams
}

const ApprovalForm: React.FC<ApprovalFormProps> = ({ searchParams }) => {
  const [values, setValues] = useState({})

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues({
      ...values,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="flex w-full p-4 mb-4 bg-white rounded-lg shadow-md">
      <div className="flex w-5/12 p-1">
        <ValidatedForm
          className="w-full max-w-md space-y-4"
          method="post"
          validator={approvalClientValidator}
        >
          <Input
            onChange={onChange}
            name={'loanStartDate'}
            label={'Approved Start Date'}
            type={'date'}
          />
          <Input
            onChange={onChange}
            name={'amount'}
            label={'Approved Amount'}
            type="number"
          />
          <Input
            onChange={onChange}
            name={'numPayments'}
            label={'Approved Term'}
            type="number"
          />
          <Input
            onChange={onChange}
            name={'interestRate'}
            label={'Monthly Interest Rate'}
          />

          <div className="flex justify-between pt-4 rounded-md shadow-sm">
            <button
              type="submit"
              name="action"
              value="approve"
              className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
            >
              <span className="relative w-full px-2 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
                Appove Loan
              </span>
            </button>
          </div>

          {/* insert hidden inputs for search params */}
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

      <div className="flex w-7/12 p-1">
        <LoanCalculations proposed={{ ...values }} />
      </div>
    </div>
  )
}

interface LoanCalculationsProps {
  proposed: {
    loanStartDate?: any
    amount?: any
    interestRate?: any
    numPayments?: any
  }
}

const LoanCalculations: React.FC<LoanCalculationsProps> = ({ proposed }) => {
  const {
    loanStartDate: lsd,
    amount: a,
    interestRate: ir,
    numPayments: np,
  } = proposed

  const loanStartDate = new Date(`${lsd}, 00:00:00`)
  const amount = Number(a)
  const interestRate = Number(ir)
  const numPayments = Number(np)

  if (
    !loanStartDate ||
    isNaN(Date.parse(lsd)) ||
    !amount ||
    !interestRate ||
    !numPayments
  )
    return null

  let totalInterest = amount * (interestRate / 100) * numPayments
  let totalPayments = amount + totalInterest
  const monthlyPayment = Math.ceil(totalPayments / numPayments)
  totalPayments = monthlyPayment * numPayments
  totalInterest = totalPayments - amount

  const maturityDate = DateTime.fromJSDate(loanStartDate)
    .plus({
      months: numPayments,
    })
    .toISO()

  return (
    <div className="flex flex-col w-full p-4 ">
      <h5 className="mb-4 text-lg font-medium text-center text-gray-900 dark:text-white">
        Calculated
      </h5>
      <div className="flex w-full p-1">
        <div className="w-1/2 mr-4 text-right">Monthly Payment</div>
        <div className="w-1/2 font-semibold">
          {`$${monthlyPayment.toLocaleString('en-US')}`}
        </div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/2 mr-4 text-right">Total Payments</div>
        <div className="w-1/2 font-semibold">
          {`$${totalPayments.toLocaleString('en-US')}`}
        </div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/2 mr-4 text-right">Interest</div>
        <div className="w-1/2 font-semibold">
          {`$${totalInterest.toLocaleString('en-US')}`}
        </div>
      </div>
      <div className="flex w-full p-1">
        <div className="w-1/2 mr-4 text-right">Maturity Date</div>
        <div className="w-1/2 font-semibold">
          {typeof maturityDate === 'string'
            ? DateTime.fromISO(maturityDate).toLocaleString()
            : DateTime.fromJSDate(maturityDate).toLocaleString()}
        </div>
      </div>
    </div>
  )
}

const DenialForm: React.FC<ApprovalFormProps> = ({ searchParams }) => {
  return (
    <div className="">
      <Form className="w-full max-w-md space-y-4" method="post">
        <div className="flex justify-between pt-4 rounded-md shadow-sm">
          <button
            type="submit"
            name="action"
            value="deny"
            className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-pink-500 to-orange-400 group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800"
          >
            <span className="relative w-full px-2 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Deny Loan
            </span>
          </button>
        </div>

        {/* insert hidden inputs for search params */}
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
      </Form>
    </div>
  )
}

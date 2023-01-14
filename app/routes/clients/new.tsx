import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { IdType, Permission } from '@prisma/client'
import { Link, useSearchParams } from '@remix-run/react'
import { ValidatedForm, validationError } from 'remix-validated-form'
import {
  buildQueryStringFromRequest,
  buildQueryStringFromSearchParams,
} from '~/util/query-string'

import { DEFAULT_MAXIMUM_LOAN_AMOUNT } from '~/util/constants'
import Input from '~/components/form/input'
import React from 'react'
import Select from '../../components/form/select'
import type { User } from '@prisma/client'
import { authenticatedUser } from '~/services/server_side/user_services.server'
import { json } from '@remix-run/node'
import { prisma } from '~/util/prisma.server'
import { redirect } from '@remix-run/node'
import { withZod } from '@remix-validated-form/with-zod'
import { z } from 'zod'

interface LoaderData {
  loggedInUser: User
}

const schema = z.object({
  name: z.string().min(1, { message: "Please enter the client's name" }),
  dateBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Please enter a valid date',
  }),
  occupation: z
    .string()
    .min(1, { message: "Please enter the client's occupation" }),
  street: z.string().min(1, { message: 'Street address is required' }),
  town: z.string().min(1, { message: 'City/town/district is required' }),
  parish: z.string().min(1, { message: 'Parish is required' }),
  phone: z.string().min(1, { message: 'Phone number is required' }),
  driverTrn: z
    .string()
    .min(1, { message: "Driver's License / TRN number is required" }),
  secondIdType: z.nativeEnum(IdType, {
    errorMap: (issue, ctx) => {
      return { message: 'Please select a valid ID type' }
    },
  }),
  secondIdNumber: z.string().min(1, { message: '2nd ID is required' }),
  otherContactName: z
    .string()
    .min(1, { message: 'Provide the name of a 2nd Contact' }),
  otherContactRelation: z.string().min(1, {
    message: "What is the client's relationship to the 2nd Contact?",
  }),
  otherContactPhone: z
    .string()
    .min(1, { message: 'Provide the phone # of the 2nd Contact' }),
})

export const clientValidator = withZod(schema)

export const loader: LoaderFunction = async ({ request, params }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  return json<LoaderData>({ loggedInUser })
}

export const action: ActionFunction = async ({ request }) => {
  const permissions = [
    Permission.CLIENT_UPDATE_BASIC,
    Permission.CLIENT_UPDATE_ADVANCED,
  ]
  const loggedInUser = await authenticatedUser(request, permissions)
  if (typeof loggedInUser === 'string') return redirect(loggedInUser)

  const serverValidator = withZod(
    schema.refine(
      async (data) => {
        const foundClient = await prisma.client.findFirst({
          where: {
            OR: [{ name: data.name }, { driverTrn: data.driverTrn }],
          },
        })
        return !foundClient
      },
      {
        message: 'That name or TRN has already been used',
        path: ['driverTrn'],
      }
    )
  )

  const data = await serverValidator.validate(await request.formData())

  if (data.error) {
    data.error.fieldErrors = {
      ...data.error.fieldErrors,
      name: 'That name or TRN has already been used',
    }
    return validationError(data.error)
  }

  const {
    name,
    dateBirth,
    occupation,
    street,
    town,
    parish,
    phone,
    driverTrn,
    secondIdType,
    secondIdNumber,
    otherContactName,
    otherContactRelation,
    otherContactPhone,
  } = data.data

  const getNextClientNumber = async () => {
    const lastClient = await prisma.client.findFirst({
      orderBy: {
        clientNum: 'desc',
      },
    })
    if (!lastClient) return '100'
    return `${parseInt(lastClient.clientNum, 10) + 1}`
  }

  const db = new Date(dateBirth)
  const offset = db.getTimezoneOffset()
  const db2 = new Date(db.getTime() + offset * 60 * 1000)

  const client = await prisma.client.create({
    data: {
      name,
      clientNum: await getNextClientNumber(),
      maxLoanAmount: DEFAULT_MAXIMUM_LOAN_AMOUNT,
      maxActiveLoans: 1,
      dateBirth: db2,
      occupation,
      address: {
        street,
        town,
        parish,
      },
      phone,
      driverTrn,
      secondIdType,
      secondIdNumber,
      otherContactName,
      otherContactRelation,
      otherContactPhone,
    },
  })

  return redirect(
    `/clients/${client.id}?${buildQueryStringFromRequest(request)}`
  )
}

const CreateClient = () => {
  const [searchParams] = useSearchParams()

  const options = [
    { value: '', label: 'Please select one...' },
    { value: IdType.PASSPORT, label: 'Passport' },
    { value: IdType.NATIONAL_ID, label: 'National ID' },
    { value: IdType.OTHER, label: 'Other' },
  ]

  return (
    <ValidatedForm method="post" validator={clientValidator}>
      <div className="flex flex-col w-full p-4 mt-10 border border-gray-200 rounded-lg shadow-md bg-slate-300 sm:p-6 md:p-8">
        <h3 className="mb-6 grow-down">New Client...</h3>
        <div className="flex w-full space-x-12">
          <div className="w-1/3 space-y-4">
            <Input name={'name'} label={'Name'} />
            <Input name={'dateBirth'} label={'Date of Birth'} type={'date'} />
            <Input name={'occupation'} label={'Occupation'} />
            <Input name={'street'} label={'Street'} />
            <Input name={'town'} label={'Town'} />
            <Input name={'parish'} label={'Parish'} />
          </div>

          <div className="w-1/3 space-y-4">
            <Input name={'phone'} label={'Phone'} />
            <Input name={'driverTrn'} label={"Driver's License / TRN #"} />
            <Select
              name={'secondIdType'}
              label={'2nd ID Type'}
              options={options}
            />
            <Input name={'secondIdNumber'} label={'2nd ID #'} />
          </div>

          <div className="w-1/3 space-y-4">
            <Input
              name={'otherContactName'}
              label={'Name of Emergency Contact Person'}
            />
            <Input
              name={'otherContactRelation'}
              label={'Relationship to Emergency Contact'}
            />
            <Input
              name={'otherContactPhone'}
              label={'Phone # of Emergency Contact'}
            />
          </div>
        </div>

        <div className="mt-12 ml-auto space-x-6 rounded-md shadow-sm">
          <button
            type="submit"
            className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
          >
            <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Save
            </span>
          </button>

          <Link
            to={`/clients?${buildQueryStringFromSearchParams(searchParams)}`}
            className="relative inline-flex items-center justify-center p-0.5 mb-2 overflow-hidden text-sm font-medium text-gray-900 rounded-lg group bg-gradient-to-br from-pink-500 to-orange-400 group-hover:from-pink-500 group-hover:to-orange-400 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800"
          >
            <span className="relative w-full px-5 py-1.5 transition-all duration-75 ease-in bg-white rounded-md dark:bg-gray-900 group-hover:bg-opacity-0">
              Cancel
            </span>
          </Link>
        </div>
      </div>

      {/* insert hidden inputs for search params */}
      {Object.entries(searchParams).map(([key, value]) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={value}
          readOnly
          aria-hidden
        />
      ))}
    </ValidatedForm>
  )
}

export default CreateClient

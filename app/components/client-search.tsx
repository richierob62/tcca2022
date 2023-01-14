import { Form, useSearchParams, useSubmit } from '@remix-run/react'

import React from 'react'
import { queryStringOptions } from '../util/query-string'

const ClientSearch = () => {
  const [searchParams] = useSearchParams()
  let clientFilter = searchParams.get('clientFilter') || ''
  if (clientFilter === 'undefined' || clientFilter === 'null') clientFilter = ''

  const clientSortBy = searchParams.get('clientSortBy') || 'name'

  const submit = useSubmit()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    submit(e.currentTarget.form)
  }

  return (
    <div>
      <Form className="flex items-center" method="get">
        <div className="flex w-full">
          <div className="w-1/2">
            <label htmlFor="clientFilter" className="sr-only">
              Search
            </label>
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 text-gray-500 dark:text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  ></path>
                </svg>
              </div>
              <input
                type="text"
                id="clientFilter"
                name="clientFilter"
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Search"
                onChange={(e) => handleChange(e)}
                defaultValue={clientFilter}
              />
            </div>
          </div>

          <div className="flex items-center w-1/2">
            <label
              htmlFor="clientSortBy"
              className="pl-6 pr-1 text-sm font-medium text-slate-100 flex-end dark:text-white"
            >
              Sort by
            </label>
            <select
              id="clientSortBy"
              name="clientSortBy"
              className="flex-1 p-2 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              defaultValue={clientSortBy}
              onChange={(e) => handleChange(e)}
            >
              <option value="clientNum">Client #</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* insert hidden inputs for search params */}
        {queryStringOptions.map((option, idx) => {
          if (['clientFilter', 'clientSortBy'].includes(option)) return null

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

export default ClientSearch

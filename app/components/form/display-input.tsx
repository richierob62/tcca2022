import React from 'react'

interface Props {
  name: string
  label: any
  value: string
  type?: string
  checked?: boolean
}

const DisplayInput: React.FC<Props> = (props) => {
  const { name, label, value, type, checked } = props

  if (type === 'checkbox')
    return (
      <div className="flex items-center pl-3">
        <input
          readOnly
          id={value}
          type="checkbox"
          value={value}
          checked={checked}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-700 focus:ring-2 dark:bg-gray-600 dark:border-gray-500"
        />
        <label
          htmlFor={name}
          className="w-full py-2 ml-2 text-xs font-medium text-gray-900 dark:text-gray-300"
        >
          {label}
        </label>
      </div>
    )

  return (
    <div className="w-full">
      <label
        htmlFor={name}
        className="block mb-0 text-sm font-medium text-gray-900 dark:text-white"
      >
        {label}
      </label>
      <input
        readOnly
        value={value}
        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
      />
    </div>
  )
}

export default DisplayInput

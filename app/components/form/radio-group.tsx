import React from 'react'

interface Props {
  name: string
  value: string
  options: { optionLabel: string; value: string }[]
  label: any
}

const RadioGroup: React.FC<Props> = (props) => {
  const { name, value, options, label } = props

  return (
    <div className="">
      <label
        htmlFor="status"
        className="block mb-0 text-sm font-medium text-gray-900 dark:text-white"
      >
        {label}
      </label>

      <div className="flex bg-white border border-gray-300 text-gray-900 text-sm rounded-lg w-full p-2.5 space-x-6">
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <input
              defaultChecked={value === option.value}
              id={option.value}
              type="radio"
              value={option.value}
              name={name}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              htmlFor={option.value}
              className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
            >
              {option.optionLabel}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RadioGroup

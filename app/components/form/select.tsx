import React from 'react'
import { useField } from 'remix-validated-form'

interface Props {
  name: string
  label: any
  value?: string
  options: { value: string; label: string }[]
}

const Select: React.FC<Props> = (props) => {
  const { name, label, value, options } = props

  const { error, getInputProps } = useField(name)

  return (
    <div>
      <label
        htmlFor={name}
        className="block mt-0 text-sm font-medium text-gray-900 dark:text-white"
      >
        {label}
      </label>
      <select
        {...getInputProps({ id: name, value })}
        name={name}
        className="bg-gray-50 border mt-0 border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 "
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="relative mt-0 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  )
}

export default Select

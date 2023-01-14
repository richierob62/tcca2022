import DisplayInput from './display-input'
import Input from './input'
import React from 'react'

interface Props {
  label: any
  displayOnly?: boolean
  checkboxes: {
    name: string
    value: string
    label: any
    checked?: boolean
  }[]
}

const CheckboxGroup: React.FC<Props> = (props) => {
  const { checkboxes, label, displayOnly } = props

  return (
    <div className="">
      <h3 className="mb-2 text-xs font-semibold text-gray-900 uppercase dark:text-white">
        {label}
      </h3>
      <ul className="w-full text-xs font-medium text-gray-900 bg-white border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
        {checkboxes.map((cb) => (
          <li
            key={cb.name}
            className="flex items-center w-full border-b border-gray-200 rounded-t-lg"
          >
            {displayOnly ? (
              <DisplayInput
                name={cb.name}
                type={'checkbox'}
                label={cb.label}
                value={cb.value}
                checked={cb.checked}
              />
            ) : (
              <Input
                name={cb.name}
                type={'checkbox'}
                label={cb.label}
                value={cb.value}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default CheckboxGroup

import { DateTime } from 'luxon'
import React from 'react'
import { useField } from 'remix-validated-form'

interface Props {
  name: string
  label: any
  value?: string
}

const TextArea: React.FC<Props> = (props) => {
  const { name, label, value } = props

  const { error, getInputProps } = useField(name)

  return (
    <div className="w-full">
      <>
        <textarea
          {...getInputProps({ value })}
          id={name}
          name={name}
          rows={4}
          className="w-full px-0 text-sm text-gray-900 bg-white border-0 dark:bg-gray-800 focus:ring-0 dark:text-white dark:placeholder-gray-400"
          placeholder={label}
        ></textarea>
        {error ? (
          <p className="relative mt-0 text-xs text-red-600">{error}</p>
        ) : null}
      </>
    </div>
  )
}

export default TextArea

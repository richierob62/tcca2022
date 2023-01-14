import React, { useState } from 'react'

interface ImageUploaderProps {
  onChange: (file: File) => any
  imageUrl?: string
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onChange,
  imageUrl,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const preventDefaults = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      onChange(file)
    }
  }

  const backgroundImageStyling = {
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    ...(imageUrl
      ? { backgroundImage: `url(${imageUrl})` }
      : { backgroundColor: 'white' }),
  }

  return (
    <div
      className="relative flex justify-center w-64 h-64 m-auto group"
      style={backgroundImageStyling}
      onClick={() => fileInputRef.current?.click()}
    >
      <p className="flex items-center justify-center text-4xl font-extrabold text-gray-200 transition duration-300 ease-in-out cursor-pointer select-none">
        Click here
      </p>
      <input
        ref={fileInputRef}
        name="imageUrl"
        type="file"
        onChange={handleChange}
        className={'hidden'}
      />
    </div>
  )
}

import Nav from './nav'
import React from 'react'
import type { User } from '@prisma/client'

interface Props {
  children: React.ReactNode
  user?: User | null
}

const Layout: React.FC<Props> = ({ user, children }) => {
  return (
    <div className="bg-blue-400 flex">
      <Nav user={user} />
      <div className="flex justify-center items-center flex-1">
        <div className="w-full h-full p-10">{children}</div>
      </div>
    </div>
  )
}

export default Layout

import { NavLink, useSearchParams } from '@remix-run/react'

import React from 'react'
import { buildQueryStringFromSearchParams } from '../util/query-string'

interface Props {
  link: {
    label: string
    href: string
    hasPermission: boolean
    end?: boolean
  }
}

const commonForAll =
  'flex justify-center items-center text-center p-0 py-1 my-auto h-full text-gray-700 rounded bg-transparent border-0'

const activeClassNames = `${commonForAll} text-blue-700 active-nav-item`
const defaultClassNames = `${commonForAll} hover:text-blue-700`
const inactiveClassNames = `${commonForAll} text-gray-300`

const SecondaryNav: React.FC<Props> = ({ link }) => {
  const [searchParams] = useSearchParams()

  return (
    // <div className='items-center justify-center'></div>
    <li>
      {link.href ? (
        <NavLink
          to={`${link.href}?${buildQueryStringFromSearchParams(searchParams)}`}
          end={link.end !== undefined ? link.end : true}
        >
          {({ isActive }: { isActive: boolean }) => (
            <div
              className={
                !link.hasPermission
                  ? inactiveClassNames
                  : isActive
                  ? activeClassNames
                  : defaultClassNames
              }
            >
              <span className="px-2">{link.label}</span>
            </div>
          )}
        </NavLink>
      ) : (
        <div className={inactiveClassNames}>
          <span className="px-2">{link.label}</span>
        </div>
      )}
    </li>
  )
}

export default SecondaryNav

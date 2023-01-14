import type { Device } from '@prisma/client'
import { Form } from '@remix-run/react'
import { FixedSizeList as List } from 'react-window'
import React from 'react'

interface Props {
  devices: Device[]
}

const DeviceList: React.FC<Props> = ({ devices }) => {
  const Cell = ({ index, style }: { index: number; style: any }) => {
    return (
      <div
        className="flex items-center px-6 py-3 text-base text-left text-gray-500 bg-white border-b cursor-pointer hover:bg-slate-200 group"
        style={style}
      >
        <div style={{ width: 400 }}>{devices[index].name}</div>
        <div style={{ width: 100 }} className="text-center">
          <Form method="post">
            <input type="hidden" name="id" value={devices[index].id} />
            <button
              type="submit"
              className="px-2 py-1 text-xs font-light text-center text-red-700 border border-red-700 rounded-sm hover:bg-red-400 focus:ring-4 focus:outline-none focus:ring-red-300 hover:text-white"
            >
              X
            </button>
          </Form>
        </div>
      </div>
    )
  }

  const totalWidth = 500

  return (
    <div className="relative mt-10 overflow-y-scroll w-max">
      <div className="sticky top-0 z-10 flex px-6 py-3 text-xs font-medium uppercase text-slate-700 bg-gray-50 drop-shadow-lg">
        <div style={{ width: 400 - 24 }}>Name</div>
        <div style={{ width: 100 - 24 }}></div>
      </div>

      <List
        height={300}
        itemCount={devices.length}
        itemSize={45}
        width={totalWidth}
      >
        {Cell}
      </List>
    </div>
  )
}

export default DeviceList

/**
 * "Send a bot" on Meetings and Today. Desktop opens Tools › Bot (direction B).
 * Phone opens the send form in a sheet, and a launch opens the meeting page,
 * which shows the bot live (direction A).
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Key, useMediaQuery, PHONE_QUERY } from '../bench'
import SendBotForm from './SendBotForm'

export default function SendBotKey({ size, onDisplay, children = 'Send a bot' }) {
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Key size={size} onDisplay={onDisplay} onClick={() => (isPhone ? setOpen(true) : navigate('/bot'))}>{children}</Key>
      {isPhone && (
        <Drawer open={open} onClose={() => setOpen(false)} label="Send the bot" hideEscHint>
          <SendBotForm onLaunched={({ meetingId }) => { setOpen(false); navigate(`/meetings/${meetingId}`) }} />
        </Drawer>
      )}
    </>
  )
}

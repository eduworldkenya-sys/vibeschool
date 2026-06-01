'use client'

import { createContext, useContext } from 'react'

interface UserCtx { fullName: string; initials: string }
export const UserContext = createContext<UserCtx>({ fullName: '', initials: '' })
export const useUser = () => useContext(UserContext)

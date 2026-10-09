"use client";

import { createContext, useContext } from "react";

interface ToastCtx { showToast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface UserCtx { fullName: string; initials: string; school: string }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '', school: '' });
export const useUser = () => useContext(UserContext);

interface CreditCtx { creditBalance: number | null; refreshCredits: () => void }
const CreditContext = createContext<CreditCtx>({ creditBalance: null, refreshCredits: () => {} });
export const useCredits = () => useContext(CreditContext);

export { ToastContext, UserContext, CreditContext };

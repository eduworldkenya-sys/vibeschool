"use client";

import { createContext, useContext } from "react";
import type { TeacherTeachingIdentity } from "@/lib/teacher/teachingIdentity";


interface ToastCtx { showToast: (msg: string) => void }
const ToastContext = createContext<ToastCtx>({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

interface UserCtx { fullName: string; initials: string; school: string }
const UserContext = createContext<UserCtx>({ fullName: '', initials: '', school: '' });
export const useUser = () => useContext(UserContext);

interface CreditCtx { creditBalance: number | null; refreshCredits: () => void }
const CreditContext = createContext<CreditCtx>({ creditBalance: null, refreshCredits: () => {} });
export const useCredits = () => useContext(CreditContext);

/** Read-only identity metadata; no school/tuition write authority is granted. */
const TeachingIdentityContext = createContext<TeacherTeachingIdentity | null>(null);
export const useTeachingIdentity = () => useContext(TeachingIdentityContext);

export { ToastContext, UserContext, CreditContext, TeachingIdentityContext };

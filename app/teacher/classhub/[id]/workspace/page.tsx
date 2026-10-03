'use client';
import {Suspense} from 'react';
import ClassWorkspace from '@/components/teacher/classroom/ClassWorkspace';
export const dynamic='force-dynamic';
export default function Page(){return <Suspense fallback={<p role="status">Opening class workspace…</p>}><ClassWorkspace/></Suspense>;}

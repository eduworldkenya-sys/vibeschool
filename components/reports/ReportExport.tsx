"use client";
'use client'

import { useState } from 'react'
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/reports/exportUtils'

interface ReportExportProps {
  schoolId: string
  reportTitle: string
  generatedBy: string
  columns: string[]
  rows: (string | number | null)[][]
}

export default function ReportExport({
  schoolId,
  reportTitle,
  generatedBy,
  columns,
  rows,
}: ReportExportProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'pdf' | 'excel' | 'csv' | null>(null)

  async function handle(type: 'pdf' | 'excel' | 'csv') {
    setLoading(type)
    setOpen(false)
    try {
      if (type === 'pdf') {
        await exportToPDF({ schoolId, reportTitle, generatedBy, columns, rows })
      } else if (type === 'excel') {
        await exportToExcel({ schoolId, reportTitle, generatedBy, columns, rows })
      } else {
        exportToCSV({ reportTitle, columns, rows })
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={!!loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        {loading ? (
          <span className="animate-spin text-base">⏳</span>
        ) : (
          <span>⬇️</span>
        )}
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-40 rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-20 overflow-hidden">
            {(['pdf', 'excel', 'csv'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handle(type)}
                className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <span>
                  {type === 'pdf' ? '📄' : type === 'excel' ? '📊' : '📋'}
                </span>
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
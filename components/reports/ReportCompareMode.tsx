"use client";
'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export interface CompareDataPoint {
  label: string
  a: number
  b: number
}

interface ReportCompareModeProps {
  title: string
  labelA: string
  labelB: string
  data: CompareDataPoint[]
  metricLabel: string
  onLabelAChange?: (v: string) => void
  onLabelBChange?: (v: string) => void
  termOptions?: string[]
  classOptions?: string[]
  compareBy?: 'term' | 'class'
  onCompareByChange?: (v: 'term' | 'class') => void
}

export default function ReportCompareMode({
  title,
  labelA,
  labelB,
  data,
  metricLabel,
  onLabelAChange,
  onLabelBChange,
  termOptions = [],
  classOptions = [],
  compareBy = 'term',
  onCompareByChange,
}: ReportCompareModeProps) {
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart')

  const diff = (a: number, b: number) => {
    if (b === 0) return null
    const pct = (((a - b) / b) * 100).toFixed(1)
    return parseFloat(pct)
  }

  const options = compareBy === 'term' ? termOptions : classOptions

  return (
    <div className="w-full rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-200">{title} — Compare Mode</h3>
        {onCompareByChange && (
          <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
            {(['term', 'class'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => onCompareByChange(opt)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  compareBy === opt
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'A', value: labelA, onChange: onLabelAChange, color: 'text-indigo-400' },
          { label: 'B', value: labelB, onChange: onLabelBChange, color: 'text-emerald-400' },
        ].map(({ label, value, onChange, color }) => (
          <div key={label}>
            <p className={`text-xs font-semibold mb-1 ${color}`}>{label}</p>
            {onChange && options.length > 0 ? (
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2"
              >
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-slate-300 px-3 py-2 bg-slate-700 rounded-lg">{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs w-fit">
        {(['chart', 'table'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 capitalize transition-colors ${
              activeTab === tab
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chart */}
      {activeTab === 'chart' && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar dataKey="a" name={labelA} fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="b" name={labelB} fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Table */}
      {activeTab === 'table' && (
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/60">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">{metricLabel}</th>
                <th className="text-right px-3 py-2 text-indigo-400 font-medium">{labelA}</th>
                <th className="text-right px-3 py-2 text-emerald-400 font-medium">{labelB}</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">Δ%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const d = diff(row.a, row.b)
                return (
                  <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-slate-200">{row.label}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{row.a}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{row.b}</td>
                    <td className={`px-3 py-2 text-right font-medium ${
                      d === null ? 'text-slate-500' :
                      d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {d === null ? '—' : `${d > 0 ? '+' : ''}${d}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

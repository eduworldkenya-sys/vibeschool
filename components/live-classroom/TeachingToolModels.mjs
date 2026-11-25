/**
 * @typedef {[number, number]} Pair
 * @typedef {{label:string; subject:string; a:Pair; b:Pair; labels:[string,string]; initial:Pair; summary:(a:number,b:number)=>string}} Model
 */

const mathematics = 'Mathematics'
const science = 'Science and Technology'
const geography = 'Social Studies'
const business = 'Business Studies'
/** @param {number} value */
const round = (value) => Number(value.toFixed(2))
/** @param {number} value */
const ksh = (value) => 'KSh ' + round(value).toLocaleString('en-KE')

/**
 * @param {string} label
 * @param {string} subject
 * @param {Pair} a
 * @param {Pair} b
 * @param {[string,string]} labels
 * @param {Pair} initial
 * @param {Model['summary']} summary
 * @returns {Model}
 */
function model(label, subject, a, b, labels, initial, summary) {
  return {label, subject, a, b, labels, initial, summary}
}

export const TEACHING_TOOL_MODELS = {
  'counter-groups': model('Counters', mathematics, [0, 24], [0, 24], ['Group A', 'Group B'], [3, 5], (a,b) => `${a} + ${b} = ${a + b} counters`),
  'base-ten-blocks': model('Base-ten blocks', mathematics, [0, 9], [0, 9], ['Tens', 'Ones'], [2, 4], (a,b) => `${a} tens + ${b} ones = ${10 * a + b}`),
  'times-array': model('Multiplication array', mathematics, [1, 10], [1, 10], ['Rows', 'Columns'], [3, 4], (a,b) => `${a} × ${b} = ${a * b}`),
  'equal-groups': model('Division into groups', mathematics, [0, 36], [1, 9], ['Counters', 'Groups'], [14, 4], (a,b) => `${Math.floor(a / b)} per group · ${a % b} left over`),
  'percent-grid': model('Percentage grid', mathematics, [0, 100], [0, 0], ['Shaded squares', ''], [35, 0], a => `${a} out of 100 = ${a}%`),
  'rectangle-area': model('Rectangle area and perimeter', mathematics, [1, 12], [1, 8], ['Width (cm)', 'Height (cm)'], [7, 4], (a,b) => `Area ${a * b} cm² · perimeter ${2 * (a + b)} cm`),
  'triangle-area': model('Triangle area', mathematics, [1, 12], [1, 8], ['Base (cm)', 'Height (cm)'], [8, 5], (a,b) => `½ × ${a} × ${b} = ${a * b / 2} cm²`),
  'regular-polygon': model('Regular polygons', mathematics, [3, 12], [0, 359], ['Sides', 'Rotation (°)'], [5, 0], a => `${a} sides · each interior angle ${round((a - 2) * 180 / a)}°`),
  'bar-comparison': model('Bar chart comparison', mathematics, [0, 20], [0, 20], ['Category A', 'Category B'], [7, 12], (a,b) => `Total ${a + b} · difference ${Math.abs(a - b)}`),
  'linear-graph': model('Linear graph', mathematics, [-4, 4], [-4, 4], ['Gradient', 'y-intercept'], [2, 1], (a,b) => `y = ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}`),
  'clock-elapsed': model('Elapsed time', mathematics, [0, 1439], [0, 720], ['Start (minutes after midnight)', 'Minutes elapsed'], [540, 45], (a,b) => {
    const time = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    return `${time(a)} → ${time(a + b)}${a + b >= 1440 ? ' next day' : ''} · ${Math.floor(b / 60)} h ${b % 60} min`
  }),
  'fraction-equivalence': model('Equivalent fractions', mathematics, [1, 5], [1, 5], ['Shaded fifths', 'Scale factor'], [2, 3], (a,b) => `${a}/5 = ${a * b}/${5 * b}`),
  'change-calculator': model('Money and change', mathematics, [0, 500], [0, 500], ['Cash paid (KSh)', 'Price (KSh)'], [100, 65], (a,b) => a >= b ? `Change ${ksh(a - b)}` : `Still owed ${ksh(b - a)}`),
  'mass-scale': model('Weighing scale', science, [0, 100], [0, 100], ['Left mass (g)', 'Right mass (g)'], [30, 50], (a,b) => a === b ? 'Balanced' : `${a > b ? 'Left' : 'Right'} heavier by ${Math.abs(a - b)} g`),
  'volume-cylinder': model('Measuring cylinder', science, [0, 100], [0, 0], ['Volume (mL)', ''], [60, 0], a => `${a} mL`),
  'thermometer': model('Thermometer', science, [-20, 50], [0, 0], ['Temperature (°C)', ''], [25, 0], a => `${a} °C`),
  'water-states': model('States of water', science, [-20, 120], [0, 0], ['Temperature (°C)', ''], [30, 0], a => a < 0 ? 'Ice' : a === 0 ? 'Melting / freezing point (1 atm)' : a < 100 ? 'Liquid water' : a === 100 ? 'Boiling / condensation point (1 atm)' : 'Water vapour (1 atm)'),
  'shadow-length': model('Shadow length', science, [1, 10], [15, 90], ['Object height (m)', 'Sun elevation (°)'], [2, 45], (a,b) => `Shadow ${round(a / Math.tan(b * Math.PI / 180))} m on level ground`),
  'magnification': model('Microscope magnification', science, [5, 20], [4, 40], ['Eyepiece magnification', 'Objective magnification'], [10, 4], (a,b) => `${a}× × ${b}× = ${a * b}×`),
  'buoyancy': model('Floating and sinking', science, [200, 1600], [700, 1300], ['Object density (kg/m³)', 'Liquid density (kg/m³)'], [700, 1000], (a,b) => a > b ? 'Sinks' : a === b ? 'Neutral buoyancy' : `Floats · ${round(100 * a / b)}% submerged`),
  'ohms-law': model('Ohm’s law', science, [0, 24], [1, 24], ['Voltage (V)', 'Resistance (Ω)'], [6, 3], (a,b) => `Current ${round(a / b)} A`),
  'electrical-power': model('Electrical power', science, [0, 24], [0, 10], ['Voltage (V)', 'Current (A)'], [9, 2], (a,b) => `Power ${a * b} W`),
  'ideal-pulley': model('Ideal pulley', science, [0, 200], [1, 4], ['Load (N)', 'Supporting rope segments'], [100, 2], (a,b) => `Ideal effort ${round(a / b)} N (ignoring friction)`),
  'pendulum-period': model('Pendulum period', science, [10, 150], [0, 15], ['Length (cm)', 'Amplitude (°)'], [80, 10], a => `Small-angle period ≈ ${round(2 * Math.PI * Math.sqrt(a / 100 / 9.81))} s`),
  'average-speed': model('Average speed', science, [0, 120], [1, 60], ['Distance (m)', 'Time (s)'], [60, 12], (a,b) => `Average speed ${round(a / b)} m/s`),
  'compass-bearing': model('Compass bearings', geography, [0, 359], [0, 0], ['Bearing clockwise from north (°)', ''], [45, 0], a => `${String(a).padStart(3, '0')}° · ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8]}`),
  'population-density': model('Population density', geography, [0, 5000], [1, 100], ['Population', 'Area (km²)'], [1200, 20], (a,b) => `${round(a / b)} people per km²`),
  'rainfall-total': model('Rainfall comparison', geography, [0, 300], [0, 300], ['Month A (mm)', 'Month B (mm)'], [80, 120], (a,b) => `Two-month total ${a + b} mm · difference ${Math.abs(a - b)} mm`),
  'budget-balance': model('Budget balance', business, [0, 10000], [0, 10000], ['Income (KSh)', 'Expenses (KSh)'], [5000, 3500], (a,b) => a === b ? 'Balanced budget' : `${a > b ? 'Surplus' : 'Shortfall'} ${ksh(Math.abs(a - b))}`),
  'business-profit': model('Profit and loss', business, [0, 10000], [0, 10000], ['Revenue (KSh)', 'Total costs (KSh)'], [8000, 6000], (a,b) => a === b ? 'Break-even' : `${a > b ? 'Profit' : 'Loss'} ${ksh(Math.abs(a - b))}`),
  'unit-price': model('Unit price', business, [0, 1000], [1, 24], ['Total price (KSh)', 'Quantity'], [240, 6], (a,b) => `${ksh(a / b)} per unit`),
  'lap-distance': model('Lap distance', 'Physical Education', [50, 400], [1, 20], ['Track length (m)', 'Laps'], [400, 3], (a,b) => `${a * b} m · ${round(a * b / 1000)} km`),
  'rhythm-beats': model('Rhythm and tempo', 'Creative Arts', [1, 16], [30, 220], ['Beats in the phrase', 'Tempo (beats/min)'], [8, 120], (a,b) => `Phrase duration ${round(a * 60 / b)} s`),
  'irrigation-water': model('Irrigation water', 'Agriculture', [1, 20], [1, 10], ['Plants', 'Water per plant (L)'], [8, 2], (a,b) => `Total water ${a * b} L`),
}

/** @param {string} kind @returns {Model | undefined} */
export function teachingToolModel(kind) {
  return Object.hasOwn(TEACHING_TOOL_MODELS, kind) ? TEACHING_TOOL_MODELS[kind] : undefined
}

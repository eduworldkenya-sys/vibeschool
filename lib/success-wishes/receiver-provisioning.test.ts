import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmedGuardianPhone, requireGuardianLink, requireSchoolMinor } from './receiver-provisioning'

const today = new Date('2026-10-26T09:00:00Z')
const schoolId = '00000000-0000-4000-8000-000000000001'
const studentId = '00000000-0000-4000-8000-000000000002'
const link = { school_id: schoolId, student_id: studentId,
  relationship: 'guardian', is_primary: true, receives_alerts: true }

test('only school-recorded minors can use this enrollment path', () => {
  assert.doesNotThrow(() => requireSchoolMinor('2009-10-27', today))
  assert.throws(() => requireSchoolMinor('2008-10-26', today), /Adult/)
  assert.throws(() => requireSchoolMinor('2000-01-01', today), /Adult/)
  assert.throws(() => requireSchoolMinor(null, today), /date of birth/)
  assert.throws(() => requireSchoolMinor('2027-03-01', today), /invalid/)
  assert.throws(() => requireSchoolMinor('2009-02-30', today), /correction/)
})
test('reject wrong school, student, non-guardian, unapproved link', () => {
  assert.doesNotThrow(() => requireGuardianLink(link, schoolId, studentId))
  assert.throws(() => requireGuardianLink({ ...link, school_id: 'other' }, schoolId, studentId))
  assert.throws(() => requireGuardianLink({ ...link, student_id: 'other' }, schoolId, studentId))
  assert.throws(() => requireGuardianLink({ ...link, relationship: 'other' }, schoolId, studentId))
  assert.throws(() => requireGuardianLink({ ...link, is_primary: false }, schoolId, studentId))
  assert.throws(() => requireGuardianLink({ ...link, receives_alerts: false }, schoolId, studentId))
})
test('never use an unconfirmed or banned parent phone for student access', () => {
  const verified = { phone: '0712345678', phone_confirmed_at: '2026-01-02T00:00:00Z' }
  assert.equal(confirmedGuardianPhone(verified), '+254712345678')
  assert.throws(() => confirmedGuardianPhone({ ...verified, phone_confirmed_at: null }), /verified phone/)
  assert.throws(() => confirmedGuardianPhone({ ...verified, phone: '254123' }), /Kenyan mobile/)
  assert.throws(() => confirmedGuardianPhone({ ...verified, banned_until: '2099-01-01T00:00:00Z' }), /unavailable/)
})

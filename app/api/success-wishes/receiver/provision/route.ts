import { NextRequest } from 'next/server'
import { field, uuid, WishError } from '@/lib/success-wishes/contracts'
import { requireGuardianLink, requireSchoolMinor, confirmedGuardianPhone } from '@/lib/success-wishes/receiver-provisioning'
import { schoolAdmin } from '@/lib/success-wishes/staff'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// School-assisted pilot, independent of the public receiver/commerce flags.
function requireProvisioningFlag() {
  if (process.env.SUCCESS_WISHES_RECEIVER_PROVISIONING_ENABLED !== 'true')
    throw new WishError(503, 'School-assisted recipient registration is not open yet.')
}
type Link = {
  id: string; parent_id: string; student_id: string; school_id: string | null
  relationship: string; is_primary: boolean; receives_alerts: boolean
}
async function enrolledStudent(db: ReturnType<typeof database>, schoolId: string, studentId: string) {
  const { data: student, error: studentError } = await db.from('students')
    .select('id,name,date_of_birth,deleted_at').eq('id', studentId).maybeSingle()
  if (studentError) throw new WishError(503, 'Student verification is temporarily unavailable.')
  if (!student || student.deleted_at) throw new WishError(404, 'The school cannot verify this student.')
  requireSchoolMinor(student.date_of_birth)
  const { data: enrollment, error: enrollError } = await db.from('student_classes')
    .select('id,classes!inner(school_id)').eq('student_id', studentId).eq('school_id', schoolId)
    .eq('classes.school_id', schoolId).eq('is_current', true).is('left_at', null).limit(1)
  if (enrollError) throw new WishError(503, 'Enrollment verification is temporarily unavailable.')
  if (!enrollment?.length) throw new WishError(404, 'Current enrollment could not be verified.')
  return student
}
export async function GET(req: NextRequest) {
  try {
    requireProvisioningFlag()
    const schoolId = uuid(req.nextUrl.searchParams.get('schoolId'))
    const studentId = uuid(req.nextUrl.searchParams.get('studentId'))
    await schoolAdmin(req, schoolId)
    const db = database({ staffOnly: true })
    const student = await enrolledStudent(db, schoolId, studentId)
    const { data: links, error } = await db.from('parent_student_links')
      .select('id,parent_id,student_id,school_id,relationship,is_primary,receives_alerts')
      .eq('student_id', studentId).eq('school_id', schoolId).limit(25)
    if (error) throw new WishError(503, 'Guardian records are temporarily unavailable.')
    const guardians = ((links || []) as Link[]).filter(link => {
      try { requireGuardianLink(link, schoolId, studentId); return true } catch { return false }
    }).map(link => ({ id: link.id, relationship: link.relationship }))
    return reply({ student: { id: student.id, name: student.name }, guardians,
      note: 'A guardian link alone does not prove lawful guardianship. Verify the school record before provisioning.' })
  } catch (error) { return failure(error) }
}
export async function POST(req: NextRequest) {
  try {
    requireProvisioningFlag()
    const b = await json(req) as Record<string, unknown>
    const schoolId = uuid(b.schoolId)
    const studentId = uuid(b.studentId)
    const guardianLinkId = uuid(b.guardianLinkId)
    const recordRef = field(b.schoolRecordReference, 6, 120)
    if (b.schoolRecordChecked !== true)
      throw new WishError(400, 'The school administrator must verify the guardian against the school record.')
    const userDb = await schoolAdmin(req, schoolId)
    const { data: { user }, error: authError } = await userDb.auth.getUser()
    if (authError || !user) throw new WishError(401, 'Sign in as school administrator.')
    await limit('receiver-provision:' + schoolId + ':' + user.id, 10, 86400, true)
    const db = database({ staffOnly: true })
    await enrolledStudent(db, schoolId, studentId)
    const { data: link, error: linkError } = await db.from('parent_student_links')
      .select('id,parent_id,student_id,school_id,relationship,is_primary,receives_alerts')
      .eq('id', guardianLinkId).maybeSingle()
    if (linkError || !link) throw new WishError(404, 'The selected guardian link could not be verified.')
    requireGuardianLink(link as Link, schoolId, studentId)
    const { data: profile, error: profileError } = await db.from('profiles')
      .select('account_status,is_anonymized').eq('id', link.parent_id).maybeSingle()
    if (profileError || !profile || profile.account_status !== 'active' || profile.is_anonymized)
      throw new WishError(409, 'The linked guardian account is not active.')
    const { data: guardian, error: guardianError } = await db.auth.admin.getUserById(link.parent_id)
    if (guardianError || !guardian?.user) throw new WishError(409, 'The linked guardian identity is unavailable.')
    const phone = confirmedGuardianPhone(guardian.user)
    const { data: id, error: provisionError } = await db.rpc('success_wish_school_provision_minor', {
      p_school: schoolId, p_student: studentId, p_guardian_link: guardianLinkId,
      p_admin: user.id, p_phone: phone,
      p_reference_digest: hashSecret('success-wishes:school-record:' +
        schoolId + ':' + studentId + ':' + recordRef),
    })
    if (provisionError || typeof id !== 'string')
      throw new WishError(409, 'Recipient registration could not be completed. Review existing links and school records.')
    return reply({ receiverId: id, consentStatus: 'pending',
      message: 'Student record provisioned. Guardian OTP consent is still required before any wish can be opened.' }, 201)
  } catch (error) { return failure(error) }
}

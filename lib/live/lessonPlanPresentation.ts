import { parseLessonPlanBody, projectLessonDelivery, type LessonDeliveryProjection } from '../teaching/lessonPlanCodec'

/** Teacher-only Live reader over the canonical saved plan.
 * Never create learner-facing slides or infer publication from a teacher plan.
 * Teachers present independently approved Resources through the Live picker.
 */
export function teacherLivePlan(raw:string):LessonDeliveryProjection|null {
 const sections=parseLessonPlanBody(raw)
 return sections?projectLessonDelivery(sections):null
}

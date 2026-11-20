export const LEVELS=["ECDE","Primary","Junior School","Senior School"] as const;
export const QUALIFICATIONS=["Certificate","Diploma","Degree","Postgraduate"] as const;
export const EMPLOYMENT_TYPES=["Full-time","Part-time","Temporary / BOM"] as const;
export const REGISTRATION=["Registered","Pending","Not registered"] as const;
export const AVAILABILITY=["Immediately","Within one month","Negotiable"] as const;
export type EmploymentFields={levels:string[];subjects:string[];qualification:string;experience:number;registration:string;counties:string[];employment_types:string[];availability:string;bio:string;education:string;work_history:string};
export type Candidate=EmploymentFields & {id:string;display_name:string;published_at:string};
export type OwnListing=EmploymentFields & {id:string;teacher_id:string;status:"draft"|"published"|"paused";consented_at:string|null};
export type RecruitmentRequest={id:string;listing_id:string;school_id:string;school_name:string;message:string;status:"pending"|"accepted"|"declined";created_at:string};
export const EMPTY_EMPLOYMENT:EmploymentFields={levels:[],subjects:[],qualification:"",experience:0,registration:"",counties:[],employment_types:[],availability:"Immediately",bio:"",education:"",work_history:""};
export const DIRECTORY_FIELDS="id,display_name,levels,subjects,qualification,experience,registration,counties,employment_types,availability,bio,education,work_history,published_at";
export const REQUEST_FIELDS="id,listing_id,school_id,school_name,message,status,created_at";
export const MANAGE_URL="/teacher/marketplace/employment";
export const HIRE_URL="/teacher/marketplace?tab=hire";
export function splitSubjects(s:string){return [...new Set(s.split(",").map(v=>v.trim()).filter(Boolean))].slice(0,12)}
export function toggleOption(values:string[],value:string){return values.includes(value)?values.filter(v=>v!==value):[...values,value]}

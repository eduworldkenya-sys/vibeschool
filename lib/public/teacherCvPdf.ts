import type {EmploymentFields} from "./teacherEmployment";

export async function downloadTeacherCv(name:string,fields:EmploymentFields){
  const {jsPDF}=await import("jspdf");
  const pdf=new jsPDF({unit:"mm",format:"a4"});
  let y=22;
  const text=(value:string,size=11)=>{
    pdf.setFontSize(size);
    const lines=pdf.splitTextToSize(value,174) as string[];
    for(const line of lines){if(y>277){pdf.addPage();y=22}pdf.text(line,18,y);y+=size===11?5.5:8}
  };
  pdf.setTextColor(25,81,57);text(name,22);pdf.setTextColor(30,40,35);text("Professional teaching profile",13);y+=5;
  const section=(label:string,value:string)=>{if(!value.trim())return;if(y>263){pdf.addPage();y=22}pdf.setFont("helvetica","bold");text(label,13);pdf.setFont("helvetica","normal");text(value);y+=4};
  section("Teaching levels",fields.levels.join(", "));section("Subjects",fields.subjects.join(", "));section("Qualifications",fields.qualification);
  section("Experience",fields.experience===0?"Fresh graduate":fields.experience+" years");section("TSC registration",fields.registration+" (self-declared)");
  section("Preferred counties",fields.counties.join(", "));section("Employment preferences",fields.employment_types.join(", ")+" | "+fields.availability);
  section("Professional introduction",fields.bio);section("Education",fields.education);section("Work history",fields.work_history);
  section("Verification","This information is self-declared. Qualifications and credentials should be independently verified.");
  pdf.save("teacher-cv-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,70)+".pdf");
}

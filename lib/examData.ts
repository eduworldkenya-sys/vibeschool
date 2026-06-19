import { ExamForm, ExamSubject } from "@/lib/types"

export const MATH_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Numbers","Fractions","Decimals","Squares and Square Roots","Algebraic Expressions","Linear Equations","Commercial Arithmetic","Coordinates","Angles","Triangles","Geometrical Constructions","Scale Drawing"],
  "Form 2": ["Formulae and Variations","Sequences","Indices","Logarithms","Further Logarithms","Quadratic Expressions","Linear Inequalities","Statistics","Circles","Scale Drawing","Similarity and Enlargement","Pythagoras Theorem"],
  "Form 3": ["Quadratic Equations and Graphs","Approximations and Errors","Trigonometry","Surds","Further Trigonometry","Matrices","Formulae and Variations","Sequence and Series","Vectors","Binomial Expansion","Probability"],
  "Form 4": ["Matrices and Transformations","Statistics II","Loci","Longitudes and Latitudes","Linear Programming","Integration","Area Approximations","Probability","Compound Proportions","Differentiation","3D Geometry"],
}
export const ENGLISH_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Reading Comprehension","Grammar and Usage","Vocabulary Development","Functional Writing","Oral Skills","Poetry Appreciation","Punctuation and Spelling","Sentence Structure"],
  "Form 2": ["Comprehension Skills","Essay Writing","Literary Devices","Tense and Agreement","Reported Speech","Oral Literature","Letter Writing","Vocabulary in Context"],
  "Form 3": ["Intensive Reading","Argumentative Essays","Drama Analysis","Advanced Grammar","Novel Study","Listening Skills","Summary Writing","Register and Style"],
  "Form 4": ["KCSE Comprehension Strategies","Composition Writing","Set Book Analysis","Language Use","Oral Presentation","Creative Writing","Revision Grammar","Exam Technique"],
}
export const BIOLOGY_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to Biology","Cell Structure and Organisation","Classification of Living Things","Nutrition in Plants","Nutrition in Animals","Transport in Plants","Transport in Animals","Respiration"],
  "Form 2": ["Cell Division","Reproduction in Plants","Reproduction in Animals","Genetics","Growth and Development","Ecology","Pollution and Conservation","Diseases and Immunity"],
  "Form 3": ["Genetics and Heredity","Evolution","Hormonal Coordination","Nervous Coordination","Homeostasis","Support and Movement","Reproduction in Humans","Population Ecology"],
  "Form 4": ["DNA and Protein Synthesis","Cell Respiration","Photosynthesis","Excretion","Osmoregulation","Coordination and Response","Reproduction","KCSE Revision Topics"],
}
export const CHEMISTRY_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to Chemistry","States of Matter","Chemical Families","Acids, Bases and Salts","Structure of the Atom","The Mole","Chemical Equations","Water and Hydrogen"],
  "Form 2": ["Sulphur and Its Compounds","Chlorine and Halides","Nitrogen and Fertilisers","Carbon and Its Compounds","Rates of Reaction","Energy Changes","Electrochemistry","Metals and Reactivity"],
  "Form 3": ["Organic Chemistry Introduction","Alkanes and Alkenes","Alcohols","Carboxylic Acids","Polymers","Radioactivity","Analytical Chemistry","Industrial Chemistry"],
  "Form 4": ["Organic Reactions","Fertilisers and Agriculture","Oils and Fats","Detergents and Soaps","Electrochemistry Advanced","Metals Extraction","Environmental Chemistry","KCSE Revision Topics"],
}
export const PHYSICS_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to Physics","Measurement","Force","Pressure","Particulate Nature of Matter","Thermal Expansion","Heat Transfer","Rectilinear Propagation of Light"],
  "Form 2": ["Magnetism","Electrostatics","Cells and Simple Circuits","Waves","Sound","Fluid Flow","Reflection at Curved Surfaces","Refraction of Light"],
  "Form 3": ["Linear Motion","Newton's Laws of Motion","Work, Energy and Power","Current Electricity","Waves II","Electromagnetism","Electromagnetic Spectrum","Uniform Circular Motion"],
  "Form 4": ["Mains Electricity","Cathode Rays","X-Rays","Photoelectric Effect","Radioactivity","Electronics","Electromagnetism II","KCSE Revision Topics"],
}
export const GEOGRAPHY_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to Geography","Weather and Climate","Vegetation","Rocks and Minerals","Internal Land-Forming Processes","External Land-Forming Processes","Map Reading","Photograph Interpretation"],
  "Form 2": ["Soils","Agriculture","Fishing","Forestry","Mining","Energy Resources","Transport and Communication","Trade"],
  "Form 3": ["Population","Settlement","Industry","Statistical Methods","Field Study","Africa — Physical Geography","Africa — Human Geography","Regional Geography of Kenya"],
  "Form 4": ["World Regional Geography","Global Issues","Practical Geography","Environmental Issues","Tourism","Urbanisation","KCSE Revision Topics","Statistical Analysis"],
}
export const KISWAHILI_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Ufahamu wa Kusikia","Ufahamu wa Kusoma","Sarufi — Nomino","Sarufi — Vitenzi","Uandishi — Insha","Fasihi — Ushairi","Msamiati","Nahau na Methali"],
  "Form 2": ["Ufahamu wa Kina","Insha za Aina Mbalimbali","Sarufi — Vivumishi","Fasihi — Hadithi Fupi","Mazungumzo","Barua","Sarufi — Vihusishi","Fasihi — Tamthilia"],
  "Form 3": ["Uandishi wa Hoja","Fasihi — Riwaya","Sarufi ya Juu","Lugha ya Mazungumzo","Fasihi Simulizi","Uchanganuzi wa Mashairi","Makala","Ufahamu wa Kiwango cha Juu"],
  "Form 4": ["Mkakati wa Mtihani wa KCSE","Ufahamu — Mbinu za Kisasa","Uchambuzi wa Vitabu Teule","Matumizi ya Lugha","Uandishi wa Ubunifu","Sarufi ya Marejesho","Fasihi — Marudio","Mazoezi ya Mtihani"],
}
export const CRE_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to the Bible","Creation and the Fall","Abraham and the Covenant","Moses and the Law","Joshua and the Conquest","The Judges","The Kingdom of Israel","The Prophets"],
  "Form 2": ["The Divided Kingdom","Elijah and Elisha","The Exile","Return from Exile","New Testament Background","Birth and Early Life of Jesus","John the Baptist","Baptism and Temptation of Jesus"],
  "Form 3": ["Ministry of Jesus","Miracles of Jesus","Parables of Jesus","The Sermon on the Mount","The Passion Narrative","The Resurrection","The Holy Spirit and Early Church","Paul's Missionary Journeys"],
  "Form 4": ["Christian Living — Responsible Parenthood","Family Life","Work and Leisure","The Church in Kenya","Human Rights","Poverty and Wealth","Christian Response to Social Issues","KCSE Revision Topics"],
}
export const BUSINESS_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to Business","Trade","Commerce","Transport","Communication","Insurance","Warehousing","Consumer Education"],
  "Form 2": ["Wholesale and Retail Trade","Banking","Documents Used in Trade","Advertising","Entrepreneurship","Business Organisations","Government and Business","Accounting Concepts"],
  "Form 3": ["Accounting — Source Documents","Accounting — Double Entry","Final Accounts","Partnership Accounts","Company Accounts","Financial Analysis","Cost Accounting","Business Finance"],
  "Form 4": ["Economics — Demand and Supply","Market Structures","National Income","Money and Banking","International Trade","Development Economics","Kenya Economy","KCSE Revision Topics"],
}
export const HISTORY_DATA: Record<ExamForm, string[]> = {
  "Form 1": ["Introduction to History and Government","Early Man and Evolution","People and Cultures of Africa","Economic Activities in Pre-Colonial Africa","Social Relations in Pre-Colonial Africa","Political Organisations","Trade in Pre-Colonial Africa","Early Civilisations"],
  "Form 2": ["The Coming of Europeans","Colonial Administration","Economic Exploitation","Social Changes Under Colonialism","African Responses to Colonialism","Nationalism in Africa","Road to Independence","Pan-Africanism"],
  "Form 3": ["Government of Kenya","Democracy and Human Rights","African Unity","Cold War and International Relations","United Nations","Development in Africa","Regional Cooperation","Conflict Resolution"],
  "Form 4": ["Constitutional Development in Kenya","Political Developments","Social and Economic Development","Foreign Policy","Regional Integration","Global Relations","Devolution","KCSE Revision Topics"],
}

export const SUBJECT_DATA: Record<ExamSubject, Record<ExamForm, string[]>> = {
  "Mathematics":       MATH_DATA,
  "English":           ENGLISH_DATA,
  "Biology":           BIOLOGY_DATA,
  "Chemistry":         CHEMISTRY_DATA,
  "Physics":           PHYSICS_DATA,
  "Geography":         GEOGRAPHY_DATA,
  "Kiswahili":         KISWAHILI_DATA,
  "CRE":               CRE_DATA,
  "Business Studies":  BUSINESS_DATA,
  "History":           HISTORY_DATA,
}

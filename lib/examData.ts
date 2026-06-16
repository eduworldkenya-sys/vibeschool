import { ExamForm, ExamSubject } from "@/lib/types"

export const EXAM_DATA: Record<ExamForm, string[]> = {
  "Form 1": [
    "Numbers", "Fractions", "Decimals", "Squares and Square Roots",
    "Algebraic Expressions", "Linear Equations", "Commercial Arithmetic",
    "Coordinates", "Angles", "Triangles",
  ],
  "Form 2": [
    "Formulae and Variations", "Sequences", "Indices", "Logarithms",
    "Further Logarithms", "Quadratic Expressions", "Linear Inequalities",
    "Statistics", "Circles", "Scale Drawing",
  ],
  "Form 3": [
    "Quadratic Equations and Graphs", "Approximations and Errors",
    "Trigonometry", "Surds", "Further Trigonometry", "Matrices",
    "Formulae and Variations", "Sequence and Series", "Vectors",
  ],
  "Form 4": [
    "Matrices and Transformations", "Statistics II", "Loci",
    "Longitudes and Latitudes", "Linear Programming", "Integration",
    "Area Approximations", "Probability", "Compound Proportions",
  ],
}

export const ENGLISH_DATA: Record<ExamForm, string[]> = {
  "Form 1": [
    "Reading Comprehension", "Grammar and Usage", "Vocabulary Development",
    "Functional Writing", "Oral Skills", "Poetry Appreciation",
    "Punctuation and Spelling", "Sentence Structure",
  ],
  "Form 2": [
    "Comprehension Skills", "Essay Writing", "Literary Devices",
    "Tense and Agreement", "Reported Speech", "Oral Literature",
    "Letter Writing", "Vocabulary in Context",
  ],
  "Form 3": [
    "Intensive Reading", "Argumentative Essays", "Drama Analysis",
    "Advanced Grammar", "Novel Study", "Listening Skills",
    "Summary Writing", "Register and Style",
  ],
  "Form 4": [
    "KCSE Comprehension Strategies", "Composition Writing",
    "Set Book Analysis", "Language Use", "Oral Presentation",
    "Creative Writing", "Revision Grammar", "Exam Technique",
  ],
}

export const BIOLOGY_DATA: Record<ExamForm, string[]> = {
  "Form 1": [
    "Introduction to Biology", "Cell Structure and Organisation",
    "Classification of Living Things", "Nutrition in Plants",
    "Nutrition in Animals", "Transport in Plants", "Transport in Animals",
    "Respiration",
  ],
  "Form 2": [
    "Cell Division", "Reproduction in Plants", "Reproduction in Animals",
    "Genetics", "Growth and Development", "Ecology",
    "Pollution and Conservation", "Diseases and Immunity",
  ],
  "Form 3": [
    "Genetics and Heredity", "Evolution", "Hormonal Coordination",
    "Nervous Coordination", "Homeostasis", "Support and Movement",
    "Reproduction in Humans", "Population Ecology",
  ],
  "Form 4": [
    "DNA and Protein Synthesis", "Cell Respiration", "Photosynthesis",
    "Excretion", "Osmoregulation", "Coordination and Response",
    "Reproduction", "KCSE Revision Topics",
  ],
}

export const CHEMISTRY_DATA: Record<ExamForm, string[]> = {
  "Form 1": [
    "Introduction to Chemistry", "States of Matter", "Chemical Families",
    "Acids, Bases and Salts", "Structure of the Atom", "The Mole",
    "Chemical Equations", "Water and Hydrogen",
  ],
  "Form 2": [
    "Sulphur and Its Compounds", "Chlorine and Halides", "Nitrogen and Fertilisers",
    "Carbon and Its Compounds", "Rates of Reaction", "Energy Changes",
    "Electrochemistry", "Metals and Reactivity",
  ],
  "Form 3": [
    "Organic Chemistry Introduction", "Alkanes and Alkenes", "Alcohols",
    "Carboxylic Acids", "Polymers", "Radioactivity",
    "Analytical Chemistry", "Industrial Chemistry",
  ],
  "Form 4": [
    "Organic Reactions", "Fertilisers and Agriculture", "Oils and Fats",
    "Detergents and Soaps", "Electrochemistry Advanced", "Metals Extraction",
    "Environmental Chemistry", "KCSE Revision Topics",
  ],
}

export const HISTORY_DATA: Record<ExamForm, string[]> = {
  "Form 1": [
    "Introduction to History and Government", "Early Man and Evolution",
    "People and Cultures of Africa", "Economic Activities in Pre-Colonial Africa",
    "Social Relations in Pre-Colonial Africa", "Political Organisations",
    "Trade in Pre-Colonial Africa", "Early Civilisations",
  ],
  "Form 2": [
    "The Coming of Europeans", "Colonial Administration", "Economic Exploitation",
    "Social Changes Under Colonialism", "African Responses to Colonialism",
    "Nationalism in Africa", "Road to Independence", "Pan-Africanism",
  ],
  "Form 3": [
    "Government of Kenya", "Democracy and Human Rights", "African Unity",
    "Cold War and International Relations", "United Nations",
    "Development in Africa", "Regional Cooperation", "Conflict Resolution",
  ],
  "Form 4": [
    "Constitutional Development in Kenya", "Political Developments",
    "Social and Economic Development", "Foreign Policy",
    "Regional Integration", "Global Relations",
    "Devolution", "KCSE Revision Topics",
  ],
}

export const SUBJECT_DATA: Record<ExamSubject, Record<ExamForm, string[]>> = {
  "Mathematics": EXAM_DATA,
  "English":     ENGLISH_DATA,
  "Biology":     BIOLOGY_DATA,
  "Chemistry":   CHEMISTRY_DATA,
  "History":     HISTORY_DATA,
}

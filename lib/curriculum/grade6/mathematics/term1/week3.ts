import type { WeekContent } from "@/lib/curriculum/types"

const week3: WeekContent = {
  week: 3,
  strand: "Numbers",
  substrand: {
    name: "Converting mixed numbers to improper fractions",
    term: 1,
    week: 3,
    status: "complete",
    learning_outcomes: [
      "Learner can apply the conversion method to change mixed numbers into improper fractions.",
      "Learner can calculate the improper fraction equivalent of a given mixed number.",
      "Learner can solve problems involving conversion between mixed numbers and improper fractions.",
      "Learner can appreciate the use of mixed numbers and improper fractions in day-to-day life."
    ],
    teacher_mastery_notes: "Before You Teach: Confirm learners understand proper fractions, improper fractions, and mixed numbers. They should be confident with multiplication and addition of whole numbers.\n\nStep-by-Step Method:\n1. Identify the mixed number e.g. 2 3/4.\n2. Multiply the whole number by the denominator: 2 x 4 = 8.\n3. Add the numerator: 8 + 3 = 11.\n4. Place over original denominator: 11/4.\n\nThis method works because a mixed number is a whole plus a fraction. Practice converting 3 1/2, 4 2/3, and 5 3/4 yourself before teaching.",
    teaching_tips: [
      "Draw a number line on the board and mark mixed numbers like 2 1/2 then show it equals 5/2.",
      "Have learners fold exercise book pages to physically represent wholes and fractional parts before converting.",
      "Ask pairs of learners to convert one mixed number each and compare answers on the board."
    ],
    common_mistakes: [
      {
        mistake: "Adding the whole number and numerator only — 2 3/4 becomes 5/4",
        why_it_happens: "Learners forget to multiply the whole number by the denominator first.",
        how_to_correct: "Remind them: multiply whole by bottom number first, then add top. Use chapati: 2 whole chapatis plus 3/4."
      },
      {
        mistake: "Forgetting to keep the same denominator — writing 11 instead of 11/4",
        why_it_happens: "Confusion between the steps after a long day.",
        how_to_correct: "Emphasize: the bottom number never changes. Only the top changes."
      },
      {
        mistake: "Writing the answer as a mixed number again instead of improper fraction",
        why_it_happens: "Learners are more comfortable with mixed numbers from daily life like 1 1/2 litres of milk.",
        how_to_correct: "Clearly state the goal: we want everything on top of one fraction line."
      }
    ],
    worked_examples: [
      {
        problem: "Convert 3 1/2 sacks of maize into an improper fraction.",
        solution_steps: [
          "Step 1: Whole number is 3, fraction is 1/2.",
          "Step 2: Multiply whole by denominator: 3 x 2 = 6.",
          "Step 3: Add numerator: 6 + 1 = 7.",
          "Step 4: Write over original denominator: 7/2."
        ],
        answer: "7/2",
        kenyan_context: "Farmers in the Rift Valley count harvested sacks this way when reporting to buyers at the market."
      },
      {
        problem: "A mother bought 4 3/4 litres of milk. Convert this to an improper fraction.",
        solution_steps: [
          "Step 1: Whole number 4, fraction 3/4.",
          "Step 2: 4 x 4 = 16.",
          "Step 3: 16 + 3 = 19.",
          "Step 4: Write as 19/4."
        ],
        answer: "19/4",
        kenyan_context: "Common when measuring milk for chai or selling at the market in Kenyan homes."
      }
    ],
    practice_questions: {
      easy: [
        { question: "Convert 1 1/2 to an improper fraction.", answer: "3/2" },
        { question: "Convert 2 1/4 to an improper fraction.", answer: "9/4" },
        { question: "Convert 3 3/4 to an improper fraction.", answer: "15/4" }
      ],
      medium: [
        { question: "Convert 5 2/3 to an improper fraction.", answer: "17/3" },
        { question: "Convert 4 5/6 to an improper fraction.", answer: "29/6" },
        { question: "Convert 2 3/5 to an improper fraction.", answer: "13/5" }
      ],
      hard: [
        {
          question: "A matatu travels 6 3/4 km in one trip. Convert this distance to an improper fraction.",
          answer: "27/4 km",
          parent_note: "Answer: 27/4 km — show your child this after they try."
        },
        {
          question: "Convert 7 5/8 to an improper fraction.",
          answer: "61/8",
          parent_note: "Answer: 61/8 — show your child this after they try."
        },
        {
          question: "Mum mixed 8 2/5 kg of flour. Convert to an improper fraction.",
          answer: "42/5 kg",
          parent_note: "Answer: 42/5 kg — show your child this after they try."
        }
      ]
    },
    parent_summary: "Today your child learned how to change mixed numbers like 2 1/2 into improper fractions like 5/2. This is done by multiplying the whole number by the bottom number, adding the top number, and keeping the same bottom number. This skill is needed for adding and subtracting fractions in the next lesson.",
    parent_questions: [
      "Ask your child: how do you change 3 1/4 chapatis into one big fraction? Show me the steps.",
      "Ask your child: if we have 2 3/5 litres of milk, what is the improper fraction?",
      "Ask your child: convert 4 1/2 and explain each step like you are teaching me."
    ],
    home_activity: "While preparing ugali or githeri, point out measurements like 2 and a half cups of flour and ask your child to convert it to an improper fraction verbally while you cook together. No paper needed.",
    warning_signs: {
      classroom: [
        "Learner writes 2 3/4 as 5/4 instead of 11/4.",
        "Learner multiplies whole number by numerator instead of denominator.",
        "Learner leaves the answer without a denominator."
      ],
      home: [
        "Your child struggles to explain the multiplication step when converting measurements.",
        "Your child converts back to mixed number immediately instead of keeping the improper fraction.",
        "Your child adds the whole number directly to the fraction without multiplying."
      ]
    }
  }
}

export default week3

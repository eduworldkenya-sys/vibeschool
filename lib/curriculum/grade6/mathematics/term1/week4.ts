import type { WeekContent } from "@/lib/curriculum/types"

const week4: WeekContent = {
  week: 4,
  strand: "Numbers",
  substrand: {
    name: "Adding and subtracting fractions with unlike denominators using LCM",
    term: 1,
    week: 4,
    status: "complete",
    learning_outcomes: [
      "Learner can find the LCM of two denominators to create equivalent fractions.",
      "Learner can add fractions with unlike denominators accurately in real-life situations.",
      "Learner can subtract fractions with unlike denominators accurately in real-life situations.",
      "Learner can appreciate the use of fractions with unlike denominators in day-to-day life."
    ],
    teacher_mastery_notes: "Before You Teach: Confirm learners can identify proper fractions, find equivalent fractions, and convert mixed numbers to improper fractions (Week 3). Check multiplication tables up to 12.\n\nTeach in this order:\n1. Start with a chapati cut into 2 equal parts and another into 3 equal parts. Ask: can we add 1/2 and 1/3 directly? No — the pieces are not the same size.\n2. Explain LCM: the smallest number both denominators fit into exactly.\n3. Example: 1/2 + 1/3. Multiples of 2: 2,4,6. Multiples of 3: 3,6. LCM = 6.\n4. Convert: 1/2 = 3/6 because 2x3=6. 1/3 = 2/6 because 3x2=6.\n5. Add only numerators: 3/6 + 2/6 = 5/6. Denominator stays 6.\n6. Simplify if possible.\n7. For subtraction with mixed numbers: convert to improper fraction first.\n   Example: 2 1/2 - 3/4. Change 2 1/2 to 10/4. Then 10/4 - 3/4 = 7/4 = 1 3/4.\n\nKey rule: NEVER add denominators. Only add numerators after making denominators the same.",
    teaching_tips: [
      "Write multiples clearly on the board in two rows and circle the LCM so every learner can see the common number.",
      "Use bottle tops, maize seeds, or folded paper to show equal parts before adding fractions.",
      "Repeat the method with Kenyan examples from chapati, ugali, money, and matatu fare so learners connect the skill to daily life."
    ],
    common_mistakes: [
      {
        mistake: "Adding numerators and denominators directly — 1/2 + 1/3 = 2/5",
        why_it_happens: "Learners treat fractions like whole numbers and forget they represent parts of different-sized wholes.",
        how_to_correct: "Say: you cannot add different sized pieces. Find same size first using LCM. Demonstrate with chapati pieces on the board."
      },
      {
        mistake: "Changing the denominator to LCM but leaving the numerator unchanged",
        why_it_happens: "Learners copy the new bottom number but forget the top must also change.",
        how_to_correct: "Teach the rule: whatever you do to the bottom, do the same to the top. Use the same multiplication factor for both."
      },
      {
        mistake: "Using product of denominators instead of LCM — using 12 instead of 6 for 2 and 3",
        why_it_happens: "Confusion between any common multiple and the lowest one.",
        how_to_correct: "List multiples clearly every time and circle the smallest common one. Never jump straight to multiplying."
      },
      {
        mistake: "Forgetting to simplify the final answer — leaving 10/12 instead of 5/6",
        why_it_happens: "Learners stop after adding and do not check if numerator and denominator share common factors.",
        how_to_correct: "Always ask after every answer: can I divide top and bottom by the same number?"
      }
    ],
    worked_examples: [
      {
        problem: "A learner ate 1/2 of a mandazi in the morning and 1/3 of a mandazi at break time. How much mandazi did the learner eat altogether?",
        solution_steps: [
          "Write the fractions: 1/2 + 1/3",
          "Find LCM of 2 and 3. Multiples of 2: 2,4,6. Multiples of 3: 3,6. LCM = 6.",
          "Convert 1/2 to 3/6.",
          "Convert 1/3 to 2/6.",
          "Add numerators: 3/6 + 2/6 = 5/6.",
          "The denominator stays 6. The answer is already simplified."
        ],
        answer: "5/6 of a mandazi",
        kenyan_context: "A break-time snack situation in a Kenyan public primary school."
      },
      {
        problem: "Mama had 2 1/2 kg of maize flour. She used 3/4 kg to cook ugali. How much maize flour remained?",
        solution_steps: [
          "Convert 2 1/2 to an improper fraction: 2 1/2 = 5/2.",
          "Find LCM of 2 and 4. LCM = 4.",
          "Convert 5/2 to 10/4.",
          "Keep 3/4 as it is.",
          "Subtract numerators: 10/4 - 3/4 = 7/4.",
          "Convert 7/4 to a mixed number: 1 3/4."
        ],
        answer: "1 3/4 kg",
        kenyan_context: "Cooking ugali at home using maize flour bought from the posho mill."
      }
    ],
    practice_questions: {
      easy: [
        { question: "1/2 + 1/4 = ?", answer: "3/4" },
        { question: "1/3 + 1/6 = ?", answer: "1/2" },
        { question: "3/4 - 1/8 = ?", answer: "5/8" }
      ],
      medium: [
        { question: "2/3 + 1/5 = ?", answer: "13/15" },
        { question: "5/6 - 1/4 = ?", answer: "7/12" },
        { question: "1 1/2 + 2/3 = ?", answer: "2 1/6" }
      ],
      hard: [
        {
          question: "A farmer harvested 5 1/3 sacks of maize and 3 3/4 sacks of beans. How many sacks did he harvest altogether?",
          answer: "9 1/12 sacks",
          parent_note: "Answer: 9 1/12 sacks. Working: 16/3 + 15/4 = 64/12 + 45/12 = 109/12 = 9 1/12. Show your child this after they try."
        },
        {
          question: "John had 4 1/2 litres of milk. He sold 2 3/5 litres. How much milk is left?",
          answer: "1 9/10 litres",
          parent_note: "Answer: 1 9/10 litres. Show your child this after they try."
        },
        {
          question: "3 2/5 - 1 3/4 = ?",
          answer: "1 13/20",
          parent_note: "Answer: 1 13/20. Show your child this after they try."
        }
      ]
    },
    parent_summary: "Today your child learned how to add and subtract fractions that have different bottom numbers. The child first finds the smallest number both bottom numbers fit into — called the LCM. Then both fractions are changed into equal parts and only the top numbers are added or subtracted. This helps them solve real problems with chapati, ugali, money, and school items.",
    parent_questions: [
      "Ask your child: if one chapati is cut into 2 pieces and another into 3 pieces, how do we make the pieces the same size before adding them?",
      "Ask your child: if you ate 1/3 of a mandazi in the morning and 1/6 in the evening, how much did you eat altogether?",
      "Ask your child: why is 1/2 + 1/3 not equal to 2/5? Let them explain it to you.",
      "Ask your child: mama had 2 1/2 cups of uji and poured out 3/4 cup. How much is left?"
    ],
    home_activity: "At supper time, use a cup of uji or water. Say: this cup is 1/2 full. Then pour a little more and say: I added 1/3 of a cup. Ask your child to talk through how to add those two fractions correctly — no writing needed. Let them explain the steps while you listen.",
    warning_signs: {
      classroom: [
        "Learner writes 1/2 + 1/3 = 2/5 in their exercise book.",
        "Learner changes the denominator to LCM but leaves the numerator unchanged.",
        "Learner gives a correct answer but cannot explain why the denominator stayed the same."
      ],
      home: [
        "Your child adds top and bottom numbers separately when helping measure ingredients.",
        "Your child says the numbers are too different and gives up without trying to find LCM.",
        "Your child gives an answer quickly but gets confused when you ask them to explain the steps."
      ]
    }
  }
}

export default week4

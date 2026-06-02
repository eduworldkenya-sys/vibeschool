#!/bin/bash
set -euo pipefail

echo "📚 Populating Grade 6 Math Term 1 content..."

cat > lib/curriculum/grade6/mathematics/term1/week3.ts << 'EOF'
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
EOF

echo "✓ week3.ts"

cat > lib/curriculum/grade6/mathematics/term1/week4.ts << 'EOF'
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
EOF

echo "✓ week4.ts"

git add lib/curriculum/grade6/mathematics/term1/week3.ts
git add lib/curriculum/grade6/mathematics/term1/week4.ts
git commit -m "feat: populate Term 1 Week 3 and Week 4 Math content (CBC Grade 6 Fractions)"
git push

echo ""
echo "✅ Done. Week 3 and Week 4 are live."

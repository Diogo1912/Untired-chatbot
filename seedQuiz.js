// Script to seed fatigue quiz questions
const { addQuizQuestion, db } = require('./database');

async function seedQuiz() {
  const questions = [
    {
      question_text: "How would you rate your overall energy level right now?",
      question_order: 1,
      options: [
        { text: "Very high energy, feeling great", value: 0.1 },
        { text: "Good energy, feeling normal", value: 0.3 },
        { text: "Moderate energy, a bit tired", value: 0.5 },
        { text: "Low energy, quite tired", value: 0.7 },
        { text: "Very low energy, extremely tired", value: 0.9 }
      ],
      weight: 1.5
    },
    {
      question_text: "How difficult is it for you to complete daily activities?",
      question_order: 2,
      options: [
        { text: "Not difficult at all", value: 0.1 },
        { text: "Slightly difficult", value: 0.3 },
        { text: "Moderately difficult", value: 0.5 },
        { text: "Very difficult", value: 0.7 },
        { text: "Extremely difficult, can barely function", value: 0.9 }
      ],
      weight: 1.5
    },
    {
      question_text: "How would you describe your ability to concentrate?",
      question_order: 3,
      options: [
        { text: "Excellent, no problems focusing", value: 0.1 },
        { text: "Good, minor concentration issues", value: 0.3 },
        { text: "Moderate, some difficulty focusing", value: 0.5 },
        { text: "Poor, significant concentration problems", value: 0.7 },
        { text: "Very poor, can't concentrate at all", value: 0.9 }
      ],
      weight: 1.0
    },
    {
      question_text: "How has your sleep been affecting your fatigue?",
      question_order: 4,
      options: [
        { text: "Sleeping well, feel rested", value: 0.1 },
        { text: "Sleeping okay, mostly rested", value: 0.3 },
        { text: "Sleep is okay but not fully restorative", value: 0.5 },
        { text: "Poor sleep, feel tired", value: 0.7 },
        { text: "Very poor sleep, extremely tired", value: 0.9 }
      ],
      weight: 1.2
    },
    {
      question_text: "How much does fatigue interfere with your daily life?",
      question_order: 5,
      options: [
        { text: "Not at all", value: 0.1 },
        { text: "A little bit", value: 0.3 },
        { text: "Moderately", value: 0.5 },
        { text: "Quite a bit", value: 0.7 },
        { text: "Extremely, it's overwhelming", value: 0.9 }
      ],
      weight: 1.3
    }
  ];

  console.log('Seeding fatigue quiz questions...\n');

  for (const q of questions) {
    try {
      await addQuizQuestion(q.question_text, q.question_order, q.options, q.weight);
      console.log(`✅ Added: ${q.question_text}`);
    } catch (error) {
      console.error(`❌ Error adding question:`, error.message);
    }
  }

  console.log('\n✅ Quiz questions seeded!');
  db.close();
}

setTimeout(() => {
  seedQuiz().catch(console.error);
}, 1000);


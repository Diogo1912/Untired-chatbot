// Script to seed breathing exercises
const { addBreathingExercise, db } = require('./database');

async function seedBreathing() {
  const exercises = [
    {
      title: "4-7-8 Breathing",
      description: "A calming breathing technique that helps reduce stress and anxiety",
      duration: 120,
      pattern: "Breathe in for 4 counts, hold for 7, exhale for 8",
      embed_code: ""
    },
    {
      title: "Box Breathing",
      description: "Simple 4-count breathing pattern for relaxation",
      duration: 60,
      pattern: "Inhale 4, hold 4, exhale 4, hold 4",
      embed_code: ""
    },
    {
      title: "Deep Belly Breathing",
      description: "Gentle deep breathing to activate relaxation response",
      duration: 90,
      pattern: "Slow deep breaths, focusing on belly expansion",
      embed_code: ""
    }
  ];

  console.log('Seeding breathing exercises...\n');

  for (const ex of exercises) {
    try {
      await addBreathingExercise(ex.title, ex.description, ex.duration, ex.pattern, ex.embed_code);
      console.log(`✅ Added: ${ex.title}`);
    } catch (error) {
      console.error(`❌ Error adding exercise:`, error.message);
    }
  }

  console.log('\n✅ Breathing exercises seeded!');
  db.close();
}

setTimeout(() => {
  seedBreathing().catch(console.error);
}, 1000);


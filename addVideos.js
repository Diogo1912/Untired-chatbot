// Script to add videos to the database
const {
  addVideo,
  db
} = require('./database');

// Wait for database initialization
async function waitForDB() {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000); // Wait 1 second for DB to initialize
  });
}

async function addVideos() {
  // Wait for database to initialize
  await waitForDB();
  const videos = [
    {
      title: 'Deep Meditation',
      url: 'https://youtu.be/3-fESb8KTCk?si=IhFmOYcIOZ3j7e-w',
      embed_url: 'https://www.youtube.com/embed/3-fESb8KTCk',
      category: 'meditation',
      tags: 'meditation,deep,relaxation,stress-relief'
    },
    {
      title: 'Sleep Meditation',
      url: 'https://youtu.be/_n3kHdZrq7U?si=vzAKqPZ7uTIvrdoO',
      embed_url: 'https://www.youtube.com/embed/_n3kHdZrq7U',
      category: 'meditation',
      tags: 'meditation,sleep,relaxation,insomnia'
    },
    {
      title: 'Gentle Yoga',
      url: 'https://youtu.be/3X0hEHop8ec?si=GCHiPptYxr7oad2b',
      embed_url: 'https://www.youtube.com/embed/3X0hEHop8ec',
      category: 'yoga',
      tags: 'yoga,gentle,exercise,movement,wellness'
    },
    {
      title: 'Therapeutic ASMR',
      url: 'https://youtu.be/Fq1wR3UPG1I?si=iylKRu7QdgoX_rPu',
      embed_url: 'https://www.youtube.com/embed/Fq1wR3UPG1I',
      category: 'asmr',
      tags: 'asmr,therapeutic,relaxation,stress-relief,sleep'
    }
  ];

  console.log('Adding videos to database...\n');

  for (const video of videos) {
    try {
      const result = await addVideo(
        video.title,
        video.url,
        video.embed_url,
        video.category,
        video.tags
      );
      console.log(`✅ Added: ${video.title}`);
    } catch (error) {
      console.error(`❌ Error adding ${video.title}:`, error.message);
    }
  }

  console.log('\n✅ All videos added!');
  db.close();
}

addVideos().catch(console.error);


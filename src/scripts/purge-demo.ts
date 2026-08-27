import { db } from '../db.js';

async function purgeDemoData() {
  console.log('Purging demo literature posts and sample author accounts...');

  try {
    // Demo usernames generated in seed script
    const demoUsernames = ['nazrul', 'tagore', 'jibanananda', 'humayun', 'emily_d', 'rfrost'];

    // Delete all literature posts by demo authors or all sample literature posts
    const deletedLit = await db.literature.deleteMany({
      where: {
        OR: [
          { author: { username: { in: demoUsernames } } },
        ]
      }
    });

    console.log(`[SUCCESS] Deleted ${deletedLit.count} demo literature posts.`);

    // Delete demo author accounts
    const deletedAuthors = await db.user.deleteMany({
      where: {
        username: { in: demoUsernames }
      }
    });

    console.log(`[SUCCESS] Deleted ${deletedAuthors.count} demo author accounts.`);
    console.log('Real community user accounts (such as admin samir) remain untouched!');
  } catch (err) {
    console.error('Error purging demo data:', err);
  } finally {
    await db.$disconnect();
  }
}

purgeDemoData();

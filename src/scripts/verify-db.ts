import { db } from '../db.js';

async function main() {
  console.log('--- Connecting to Neon PostgreSQL ---');
  
  // 1. Test database connection
  await db.$connect();
  console.log('Successfully connected to PostgreSQL database.');

  // 2. Ensure partial unique indexes exist on likes table
  console.log('Applying partial unique indexes on likes table...');
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_user_like ON likes(literature_id, user_id) WHERE user_id IS NOT NULL;
  `);
  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_device_like ON likes(literature_id, device_hash) WHERE user_id IS NULL;
  `);
  console.log('Partial unique indexes applied successfully.');

  // 3. Verify tables present
  const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  `);
  console.log('Tables present in database:', tables.map(t => t.tablename).join(', '));

  // 4. Verify indexes present on likes table
  const indexes: Array<{ indexname: string; indexdef: string }> = await db.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'likes';
  `);
  console.log('Indexes on likes table:');
  indexes.forEach(idx => console.log(` - ${idx.indexname}: ${idx.indexdef}`));

  // 5. Test basic query operations
  const userCount = await db.user.count();
  const literatureCount = await db.literature.count();
  const likeCount = await db.like.count();
  const commentCount = await db.comment.count();
  const followCount = await db.follow.count();

  console.log('Database verification stats:');
  console.log({
    users: userCount,
    literature: literatureCount,
    likes: likeCount,
    comments: commentCount,
    follows: followCount
  });

  console.log('--- Database Verification Complete & Passed ---');
}

main()
  .catch((err) => {
    console.error('Database verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

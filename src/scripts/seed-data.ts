import { db } from '../db.js';
import bcrypt from 'bcryptjs';
import { generateSlug } from '../utils/helpers.js';

async function seedData() {
  console.log('====================================================');
  console.log('       STARTING SEED DATA GENERATION SCRIPT');
  console.log('====================================================\n');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Authors & Users Seed Data
  const authorsData = [
    {
      name: 'Kazi Nazrul Islam',
      username: 'nazrul',
      email: 'nazrul@poetry.org',
      bio: 'National Poet of Bangladesh, known for revolutionary poetry and ghazals.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      role: 'author'
    },
    {
      name: 'Rabindranath Tagore',
      username: 'tagore',
      email: 'tagore@poetry.org',
      bio: 'Nobel Laureate in Literature (1913), composer of national anthems, poet, and philosopher.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      role: 'author'
    },
    {
      name: 'Jibanananda Das',
      username: 'jibanananda',
      email: 'jibanananda@poetry.org',
      bio: 'Pioneer of modern Bengali surrealist poetry and lover of Bengal nature.',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
      role: 'author'
    },
    {
      name: 'Humayun Ahmed',
      username: 'humayun',
      email: 'humayun@literature.org',
      bio: 'Beloved novelist, dramatist, screenwriter, and filmmaker of modern Bangladesh.',
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
      role: 'author'
    },
    {
      name: 'Emily Dickinson',
      username: 'emily_d',
      email: 'emily@poetry.org',
      bio: 'Iconic American poet celebrated for unique verse structure and deep introspection.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      role: 'author'
    },
    {
      name: 'Robert Frost',
      username: 'rfrost',
      email: 'rfrost@poetry.org',
      bio: 'Four-time Pulitzer Prize winning American poet depicting rural life and human choice.',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
      role: 'author'
    }
  ];

  console.log('Seeding authors/users...');
  const seededAuthors: Record<string, any> = {};

  for (const author of authorsData) {
    const user = await db.user.upsert({
      where: { email: author.email },
      update: {
        name: author.name,
        username: author.username,
        bio: author.bio,
        avatarUrl: author.avatarUrl,
        role: author.role
      },
      create: {
        name: author.name,
        username: author.username,
        email: author.email,
        passwordHash: defaultPasswordHash,
        bio: author.bio,
        avatarUrl: author.avatarUrl,
        role: author.role
      }
    });
    seededAuthors[author.username] = user;
    console.log(`  [OK] Author user created/updated: ${user.name} (@${user.username})`);
  }

  // 2. Literature Seed Data
  const literatureItems = [
    // Bengali Poems
    {
      authorUsername: 'nazrul',
      title: 'বিদ্রোহী (Bidrohi)',
      category: 'poem',
      language: 'bn',
      readingTimeMin: 4,
      content: `বল বীর -
বল উন্নত মম শির!
শির নেহারি’ আমারি নতশির ঐ শিখর হিমাদ্রির!
বল বীর -
বল মহাবিশ্বের মহাকাশ ফাড়ি’
চন্দ্র সূর্য গ্রহ তারা চারি’
ভূলোক দ্যুলোক গোলক ভেদিয়া
খোদার আসন ‘আরশ’ ছেদিয়া,
উঠিয়াছি মহাবিপ্রব আমি এই বিশ্ব-বিধাত্রীর!
মম ললাটে রুদ্র-ভগবান জ্বলে রাজ-রাজটীকা দীপ্ত জয়শ্রীর!
বল বীর -
আমি চির-উন্নত শির!`
    },
    {
      authorUsername: 'tagore',
      title: 'নির্ঝরের স্বপ্নভঙ্গ',
      category: 'poem',
      language: 'bn',
      readingTimeMin: 3,
      content: `আজি এ প্রভাতে রবির কর
কেমনে পশিল প্রাণের পর,
কেমনে পশিল গুহার আঁধারে প্রভাতপাখির গান!
না জানি কেন রে এত দিন পরে জাগিয়া উঠিল প্রাণ।
জাগিয়া উঠেছে পরান,
ওরে উথলি উঠেছে বারি,
ওরে পরানের বাসনা পরান ঢালিয়া দিতে চায় রে!`
    },
    {
      authorUsername: 'jibanananda',
      title: 'বনলতা সেন',
      category: 'poem',
      language: 'bn',
      readingTimeMin: 2,
      content: `হাজার বছর ধরে আমি পথ হাঁটিতেছি পৃথিবীর পথে,
সিংহল সমুদ্র থেকে নিশীথের অন্ধকারে মালয় সাগরে
অনেক ঘুরেছি আমি; বিম্বিসার অশোকের ধূসর জগতে
সেখানে ছিলাম আমি; আরও দূর অন্ধকারে বিদর্ভ নগরে;
আমি ক্লান্ত প্রাণ এক, চারিপাশে জীবনের সমুদ্র ফেনিল,
আমারে দু-দণ্ড শান্তি দিয়েছিল নাটোরের বনলতা সেন।`
    },

    // Bengali Micro-poems
    {
      authorUsername: 'jibanananda',
      title: 'রাতের আঁধার অনুকথা',
      category: 'micro_poem',
      language: 'bn',
      readingTimeMin: 1,
      content: `নীরব রাতে নক্ষত্রের গান শুনি,
হৃদয় মাঝে স্মৃতির মুক্তা বুনি।`
    },
    {
      authorUsername: 'tagore',
      title: 'ক্ষুদ্র আলো',
      category: 'micro_poem',
      language: 'bn',
      readingTimeMin: 1,
      content: `একটি ছোট প্রদীপ জ্বালে
সারা রাতের আঁধার কাটে।`
    },

    // Bengali Stories
    {
      authorUsername: 'humayun',
      title: 'একাকী এক রিমঝিম রাত',
      category: 'story',
      language: 'bn',
      readingTimeMin: 6,
      content: `হিমু একলা রাস্তায় হাঁটছে। আকাশে ঘন মেঘ, যেকোনো মুহূর্তে বৃষ্টি নামবে। তার গায়ে হলুদ পাঞ্জাবি, পায়ে জুতো নেই। বৃষ্টিতে ভিজতে তার খুব ভালো লাগে। 

আজ রাতের রূপই আলাদা। রাস্তার সোডিয়াম লাইটের আলোয় বৃষ্টির ফোটাগুলো রুপালী সুতোর মতো দেখাচ্ছে। দূর থেকে ভেসে আসছে কদম্ব ফুলের মৃদু গন্ধ। হিমু ভাবল, রাতের এই নিস্তব্ধতা আর রূপময়তা মানুষকে কবি বানিয়ে দেয়।`
    },
    {
      authorUsername: 'tagore',
      title: 'একরাত্রি',
      category: 'story',
      language: 'bn',
      readingTimeMin: 5,
      content: `সুরবালা এবং আমি এক গ্রামেই বড় হয়েছিলাম। বাল্যকালে আমাদের মধ্যে খেলাধুলার যে সহজ সম্পর্ক ছিল, বয়সের সাথে সাথে তা দূরে সরে যায়। কিন্তু ঝড়ের সেই এক রাতে সমস্ত বাধা পেরিয়ে আমাদের আত্মা মুহূর্তের জন্য এক হয়ে উঠেছিল। সেই একরাত্রির স্মৃতি আমার বাকি জীবনের আলো হয়ে রইল।`
    },

    // English Poems
    {
      authorUsername: 'emily_d',
      title: 'Hope is the thing with feathers',
      category: 'poem',
      language: 'en',
      readingTimeMin: 2,
      content: `"Hope" is the thing with feathers -
That perches in the soul -
And sings the tune without the words -
And never stops - at all -

And sweetest - in the Gale - is heard -
And sore must be the storm -
That could abash the little Bird
That kept so many warm -

I've heard it in the chillest land -
And on the strangest Sea -
Yet - never - in Extremity,
It asked a crumb - of me.`
    },
    {
      authorUsername: 'rfrost',
      title: 'Stopping by Woods on a Snowy Evening',
      category: 'poem',
      language: 'en',
      readingTimeMin: 2,
      content: `Whose woods these are I think I know.   
His house is in the village though;   
He will not see me stopping here   
To watch his woods fill up with snow.   

My little horse must think it queer   
To stop without a farmhouse near   
Between the woods and frozen lake   
The darkest evening of the year.   

The woods are lovely, dark and deep,   
But I have promises to keep,   
And miles to go before I sleep,   
And miles to go before I sleep.`
    },

    // English Micro-poems
    {
      authorUsername: 'emily_d',
      title: 'Silent Whisper',
      category: 'micro_poem',
      language: 'en',
      readingTimeMin: 1,
      content: `A quiet thought upon the breeze,
Left floating through the autumn trees.`
    },

    // English Short Story
    {
      authorUsername: 'rfrost',
      title: 'The Road Chosen',
      category: 'story',
      language: 'en',
      readingTimeMin: 4,
      content: `Two paths diverged in a yellow wood. As the traveler stood at the junction, the morning mist was clearing over the fallen leaves. One path was well-trodden, marked by countless footsteps of travelers seeking the safe and familiar. The other path was grassy and wanted wear.

Taking a deep breath, the traveler stepped onto the less traveled path. Every step felt like a quiet declaration of freedom.`
    }
  ];

  console.log('\nSeeding literature pieces...');
  const createdLiteratures = [];

  for (const item of literatureItems) {
    const author = seededAuthors[item.authorUsername];
    if (!author) continue;

    const slug = generateSlug(item.title);

    const literature = await db.literature.create({
      data: {
        authorId: author.id,
        title: item.title,
        slug,
        content: item.content,
        category: item.category,
        language: item.language,
        readingTimeMin: item.readingTimeMin,
        viewsCount: Math.floor(Math.random() * 50) + 10
      }
    });

    createdLiteratures.push(literature);
    console.log(`  [OK] Literature created: "${literature.title}" (${literature.category}/${literature.language}) - Slug: ${literature.slug}`);
  }

  // 3. Seed Sample Likes, Comments, and Follows
  console.log('\nSeeding sample interactions (likes, comments, follows)...');

  const nazrul = seededAuthors['nazrul'];
  const tagore = seededAuthors['tagore'];
  const humayun = seededAuthors['humayun'];

  // Follow relationships
  if (nazrul && tagore) {
    await db.follow.upsert({
      where: { followerId_followingId: { followerId: nazrul.id, followingId: tagore.id } },
      update: {},
      create: { followerId: nazrul.id, followingId: tagore.id }
    });
    console.log(`  [OK] Nazrul followed Tagore`);
  }

  if (humayun && tagore) {
    await db.follow.upsert({
      where: { followerId_followingId: { followerId: humayun.id, followingId: tagore.id } },
      update: {},
      create: { followerId: humayun.id, followingId: tagore.id }
    });
    console.log(`  [OK] Humayun followed Tagore`);
  }

  if (tagore && nazrul) {
    await db.follow.upsert({
      where: { followerId_followingId: { followerId: tagore.id, followingId: nazrul.id } },
      update: {},
      create: { followerId: tagore.id, followingId: nazrul.id }
    });
    console.log(`  [OK] Tagore followed Nazrul`);
  }

  // Seed sample likes & comments on created literature
  for (const lit of createdLiteratures) {
    // Add user like from Tagore
    if (tagore && lit.authorId !== tagore.id) {
      await db.like.create({
        data: {
          literatureId: lit.id,
          userId: tagore.id,
          deviceHash: 'seed_device_tagore'
        }
      });
    }

    // Add guest like
    await db.like.create({
      data: {
        literatureId: lit.id,
        userId: null,
        deviceHash: 'seed_guest_device_hash_1'
      }
    });

    // Add guest comment
    await db.comment.create({
      data: {
        literatureId: lit.id,
        guestName: 'আবেগপ্রবণ পাঠক (Emotional Reader)',
        deviceHash: 'seed_guest_device_hash_1',
        content: 'অসাধারণ অনুভূতি! এই সাহিত্যকর্মটি বারবার পড়তে ইচ্ছে করে।'
      }
    });

    // Add author user comment
    if (nazrul && lit.authorId !== nazrul.id) {
      await db.comment.create({
        data: {
          literatureId: lit.id,
          userId: nazrul.id,
          deviceHash: 'seed_device_nazrul',
          content: 'চমৎকার উপস্থাপন এবং গভীর চিন্তার প্রকাশ।'
        }
      });
    }
  }

  console.log('\n====================================================');
  console.log('         SEED DATA COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

seedData()
  .catch((err) => {
    console.error('Seed script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

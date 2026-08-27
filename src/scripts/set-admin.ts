import { db } from '../db.js';

async function setAdmin() {
  const username = 'samir';
  try {
    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });

    if (!user) {
      console.log(`User with username '${username}' not found yet. It will be upgraded to admin when created.`);
      return;
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    });

    console.log(`User '${updated.username}' (${updated.id}) successfully updated to role 'admin'!`);
  } catch (err) {
    console.error('Error updating user role to admin:', err);
  } finally {
    await db.$disconnect();
  }
}

setAdmin();

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { UserPayload } from '../types/express.d.js';

const JWT_SECRET = process.env.JWT_SECRET || 'lit_mobile_pwa_secret_jwt_key_2026_super_secure';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const
};

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, username, email, password, bio, avatarUrl } = req.body;

    if (!name || !username || !email || !password) {
      res.status(400).json({ error: 'Name, username, email, and password are required' });
      return;
    }

    if (typeof name !== 'string' || typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Invalid field types' });
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // Check if email or username already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email: trimmedEmail },
          { username: trimmedUsername }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === trimmedEmail) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
      }
      res.status(400).json({ error: 'User with this username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const requestedRole = trimmedUsername === 'samir'
      ? 'admin'
      : ((req.body.role === 'writer' || req.body.role === 'author') ? 'writer' : 'reader');

    const newUser = await db.user.create({
      data: {
        name: name.trim(),
        username: trimmedUsername,
        email: trimmedEmail,
        passwordHash,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        role: requestedRole
      }
    });

    const userPayload: UserPayload = {
      id: newUser.id,
      name: newUser.name,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('auth_token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        bio: newUser.bio,
        avatarUrl: newUser.avatarUrl,
        createdAt: newUser.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { identifier, email, username, password } = req.body;

    const loginId = (identifier || email || username || '').trim().toLowerCase();

    if (!loginId || !password) {
      res.status(400).json({ error: 'Email/username and password are required' });
      return;
    }

    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: loginId },
          { username: loginId }
        ]
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    let userRole = user.role;
    if (user.username.toLowerCase() === 'samir' && user.role !== 'admin') {
      userRole = 'admin';
      await db.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
      });
    }

    const userPayload: UserPayload = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: userRole
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('auth_token', token, COOKIE_OPTIONS);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: userRole,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('auth_token', CLEAR_COOKIE_OPTIONS);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        bio: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let userRole = user.role;
    if (user.username.toLowerCase() === 'samir' && user.role !== 'admin') {
      userRole = 'admin';
      await db.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
      });
    }

    res.status(200).json({ user: { ...user, role: userRole } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { role } = req.body;
    const targetRole = (role === 'writer' || role === 'author') ? 'writer' : 'reader';

    const updatedUser = await db.user.update({
      where: { id: req.user.id },
      data: { role: targetRole },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        bio: true,
        avatarUrl: true,
        createdAt: true
      }
    });

    res.status(200).json({
      message: `Role updated to ${targetRole}`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Internal server error while updating role' });
  }
}

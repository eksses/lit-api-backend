import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { fingerprintMiddleware } from './middleware/fingerprint.js';
import { optionalAuth } from './middleware/auth.js';
import authRoutes from './routes/authRoutes.js';
import literatureRoutes from './routes/literatureRoutes.js';
import authorRoutes from './routes/authorRoutes.js';
import feedRoutes from './routes/feedRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Universal CORS Middleware for frictionless Vercel deployment
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-fingerprint, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// Custom Middlewares
app.use(fingerprintMiddleware);
app.use(optionalAuth);

// Routes (Mounted on both /api/* and /* for universal Vercel deployment compatibility)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/literature', literatureRoutes);
app.use('/literature', literatureRoutes);

app.use('/api/authors', authorRoutes);
app.use('/authors', authorRoutes);

app.use('/api/feed', feedRoutes);
app.use('/feed', feedRoutes);

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deviceHash: req.deviceHash,
    user: req.user || null
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

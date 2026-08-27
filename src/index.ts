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

// URL Normalizer Middleware for Vercel Serverless Function compatibility
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// Custom Middlewares
app.use(fingerprintMiddleware);
app.use(optionalAuth);

// Routes
app.use('/auth', authRoutes);
app.use('/literature', literatureRoutes);
app.use('/authors', authorRoutes);
app.use('/feed', feedRoutes);

app.get(['/', '/health'], (req, res) => {
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

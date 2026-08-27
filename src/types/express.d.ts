export interface UserPayload {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      deviceHash?: string;
      user?: UserPayload;
    }
  }
}

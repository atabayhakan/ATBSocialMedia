import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    backendToken?: string;
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    backendToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    backendToken?: string;
    role?: string;
  }
}

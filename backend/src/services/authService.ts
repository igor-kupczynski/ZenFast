import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/userRepository';
import { User } from '../types/models';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtSecret: string
  ) {}

  async createJWT(user: User): Promise<string> {
    const jwt = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(this.jwtSecret));

    return jwt;
  }

  async verifyJWT(token: string): Promise<AuthTokenPayload> {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(this.jwtSecret));
    return payload as unknown as AuthTokenPayload;
  }

  async authenticateUser(
    email: string,
    password: string
  ): Promise<{ user: User; token: string } | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    const token = await this.createJWT(user);
    return { user, token };
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = await this.verifyJWT(token);
      return await this.userRepository.findById(payload.sub);
    } catch {
      return null;
    }
  }

  async refreshToken(oldToken: string): Promise<string | null> {
    try {
      const payload = await this.verifyJWT(oldToken);
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        return null;
      }
      return await this.createJWT(user);
    } catch {
      return null;
    }
  }
}

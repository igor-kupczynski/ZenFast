import { User } from '../types/models';

export class UserRepository {
  constructor(private db: D1Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    return result as User | null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return result as User | null;
  }

  async create(user: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(
        'INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
      )
      .bind(user.id, user.email, user.name, user.password_hash, now, now)
      .first();
    return result as unknown as User;
  }

  async update(
    id: string,
    updates: Partial<Pick<User, 'name' | 'email' | 'password_hash'>>
  ): Promise<User | null> {
    const now = new Date().toISOString();
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    const result = await this.db
      .prepare(`UPDATE users SET ${fields}, updated_at = ? WHERE id = ? RETURNING *`)
      .bind(...values, now, id)
      .first();
    return result as User | null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    return result.success && result.meta.changes > 0;
  }
}

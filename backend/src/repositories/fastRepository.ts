import { Fast } from '../types/models';

export class FastRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<Fast | null> {
    const result = await this.db.prepare('SELECT * FROM fasts WHERE id = ?').bind(id).first();
    return result as Fast | null;
  }

  async findByUserId(userId: string, limit = 50, offset = 0): Promise<Fast[]> {
    const result = await this.db
      .prepare('SELECT * FROM fasts WHERE user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?')
      .bind(userId, limit, offset)
      .all();
    return result.results as unknown as Fast[];
  }

  async findCurrentFast(userId: string): Promise<Fast | null> {
    const result = await this.db
      .prepare(
        'SELECT * FROM fasts WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
      )
      .bind(userId)
      .first();
    return result as Fast | null;
  }

  async findByDate(userId: string, date: string): Promise<Fast | null> {
    const result = await this.db
      .prepare('SELECT * FROM fasts WHERE user_id = ? AND date(started_at) = ? LIMIT 1')
      .bind(userId, date)
      .first();
    return result as Fast | null;
  }

  async create(fast: Omit<Fast, 'created_at' | 'updated_at' | 'duration_hours'>): Promise<Fast> {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(
        'INSERT INTO fasts (id, user_id, started_at, ended_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
      )
      .bind(fast.id, fast.user_id, fast.started_at, fast.ended_at, now, now)
      .first();
    return result as unknown as Fast;
  }

  async update(
    id: string,
    updates: Partial<Pick<Fast, 'ended_at' | 'started_at'>>
  ): Promise<Fast | null> {
    const now = new Date().toISOString();
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    const result = await this.db
      .prepare(`UPDATE fasts SET ${fields}, updated_at = ? WHERE id = ? RETURNING *`)
      .bind(...values, now, id)
      .first();
    return result as Fast | null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM fasts WHERE id = ?').bind(id).run();
    return result.success && result.meta.changes > 0;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.db.prepare('DELETE FROM fasts WHERE user_id = ?').bind(userId).run();
    return result.success ? result.meta.changes : 0;
  }

  async getUserStats(userId: string): Promise<{
    totalFasts: number;
    averageDuration: number;
    longestFast: number;
    currentStreak: number;
  }> {
    const totalResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM fasts WHERE user_id = ? AND ended_at IS NOT NULL')
      .bind(userId)
      .first();

    const avgResult = await this.db
      .prepare(
        `
        SELECT AVG(
          CASE 
            WHEN ended_at IS NOT NULL 
            THEN (julianday(ended_at) - julianday(started_at)) * 24 
            ELSE NULL 
          END
        ) as avg_duration
        FROM fasts WHERE user_id = ? AND ended_at IS NOT NULL
      `
      )
      .bind(userId)
      .first();

    const longestResult = await this.db
      .prepare(
        `
        SELECT MAX(
          CASE 
            WHEN ended_at IS NOT NULL 
            THEN (julianday(ended_at) - julianday(started_at)) * 24 
            ELSE NULL 
          END
        ) as longest_duration
        FROM fasts WHERE user_id = ? AND ended_at IS NOT NULL
      `
      )
      .bind(userId)
      .first();

    return {
      totalFasts: (totalResult as { count: number })?.count || 0,
      averageDuration: (avgResult as { avg_duration: number })?.avg_duration || 0,
      longestFast: (longestResult as { longest_duration: number })?.longest_duration || 0,
      currentStreak: 0, // TODO: Implement streak calculation
    };
  }
}

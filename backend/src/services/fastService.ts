import { v4 as uuidv4 } from 'uuid';
import { FastRepository } from '../repositories/fastRepository';
import { Fast } from '../types/models';

export interface CreateFastRequest {
  started_at: string;
  ended_at?: string;
}

export interface UpdateFastRequest {
  ended_at?: string;
  started_at?: string;
}

export interface FastWithDuration extends Fast {
  duration_hours: number | null;
}

export class FastService {
  constructor(private fastRepository: FastRepository) {}

  async createFast(userId: string, request: CreateFastRequest): Promise<Fast> {
    // Validate that user doesn't already have a fast for this date
    const fastDate = new Date(request.started_at).toISOString().split('T')[0];
    const existingFast = await this.fastRepository.findByDate(userId, fastDate);
    if (existingFast) {
      throw new Error('User already has a fast for this date');
    }

    // Check if user has an active fast
    const currentFast = await this.fastRepository.findCurrentFast(userId);
    if (currentFast && !request.ended_at) {
      throw new Error('User already has an active fast');
    }

    // Validate start time is not in the future
    const startTime = new Date(request.started_at);
    if (startTime > new Date()) {
      throw new Error('Fast start time cannot be in the future');
    }

    // Validate end time if provided
    if (request.ended_at) {
      const endTime = new Date(request.ended_at);
      if (endTime <= startTime) {
        throw new Error('Fast end time must be after start time');
      }
      if (endTime > new Date()) {
        throw new Error('Fast end time cannot be in the future');
      }
    }

    const fast = await this.fastRepository.create({
      id: uuidv4(),
      user_id: userId,
      started_at: request.started_at,
      ended_at: request.ended_at || null,
    });

    return fast;
  }

  async getFastById(id: string, userId: string): Promise<FastWithDuration | null> {
    const fast = await this.fastRepository.findById(id);
    if (!fast || fast.user_id !== userId) {
      return null;
    }

    return this.addDurationToFast(fast);
  }

  async getUserFasts(userId: string, limit = 50, offset = 0): Promise<FastWithDuration[]> {
    const fasts = await this.fastRepository.findByUserId(userId, limit, offset);
    return fasts.map((fast) => this.addDurationToFast(fast));
  }

  async getCurrentFast(userId: string): Promise<FastWithDuration | null> {
    const fast = await this.fastRepository.findCurrentFast(userId);
    if (!fast) {
      return null;
    }

    return this.addDurationToFast(fast);
  }

  async updateFast(
    id: string,
    userId: string,
    updates: UpdateFastRequest
  ): Promise<FastWithDuration | null> {
    const existingFast = await this.fastRepository.findById(id);
    if (!existingFast || existingFast.user_id !== userId) {
      return null;
    }

    // Validate updates
    if (updates.started_at) {
      const startTime = new Date(updates.started_at);
      if (startTime > new Date()) {
        throw new Error('Fast start time cannot be in the future');
      }
    }

    if (updates.ended_at) {
      const endTime = new Date(updates.ended_at);
      const startTime = new Date(updates.started_at || existingFast.started_at);

      if (endTime <= startTime) {
        throw new Error('Fast end time must be after start time');
      }
      if (endTime > new Date()) {
        throw new Error('Fast end time cannot be in the future');
      }
    }

    const updatedFast = await this.fastRepository.update(id, updates);
    if (!updatedFast) {
      return null;
    }

    return this.addDurationToFast(updatedFast);
  }

  async deleteFast(id: string, userId: string): Promise<boolean> {
    const existingFast = await this.fastRepository.findById(id);
    if (!existingFast || existingFast.user_id !== userId) {
      return false;
    }

    return await this.fastRepository.delete(id);
  }

  async endCurrentFast(userId: string): Promise<FastWithDuration | null> {
    const currentFast = await this.fastRepository.findCurrentFast(userId);
    if (!currentFast) {
      return null;
    }

    const endTime = new Date().toISOString();
    const updatedFast = await this.fastRepository.update(currentFast.id, { ended_at: endTime });
    if (!updatedFast) {
      return null;
    }

    return this.addDurationToFast(updatedFast);
  }

  async getUserStats(userId: string) {
    return await this.fastRepository.getUserStats(userId);
  }

  private addDurationToFast(fast: Fast): FastWithDuration {
    let duration_hours: number | null = null;

    if (fast.ended_at) {
      const startTime = new Date(fast.started_at);
      const endTime = new Date(fast.ended_at);
      duration_hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    }

    return {
      ...fast,
      duration_hours,
    };
  }
}

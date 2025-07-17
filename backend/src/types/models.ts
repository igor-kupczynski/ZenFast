export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Fast {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_hours: number | null;
  created_at: string;
  updated_at: string;
}

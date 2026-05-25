export interface Player {
    id: number;
    username: string;
    password: string;
    creator_id: number | null;
    win_count: number;
    game_count: number;
    created_at: Date;
}

export interface SessionPlayer {
    id: number;
    username: string;
}
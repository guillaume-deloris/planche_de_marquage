declare module "express-session" {
    interface SessionData {
        player: {
            id: number;
            username: string;
        };
    }
}
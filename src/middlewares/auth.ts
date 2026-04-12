import { Request, Response, NextFunction } from "express";
import session = require("express-session");

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (!(req.session as any).player) {
        res.redirect("/login");
        return;
    }
    next();
};
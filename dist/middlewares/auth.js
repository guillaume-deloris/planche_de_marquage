"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const requireAuth = (req, res, next) => {
    if (!req.session.player) {
        res.redirect("/login");
        return;
    }
    next();
};
exports.requireAuth = requireAuth;

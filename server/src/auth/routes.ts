import { Router } from "express";
import { makeLoginUrl, randomState, exchangeCodeForTokens, refreshAccessToken } from "./spotifyOAuth.js";
import { getTokens, upsertTokens } from "./sessionStore.js";

export const authRouter = Router();

authRouter.get("/login", (_req, res) => {
  const state = randomState();
  // For solo local, we skip state persistence. If you want, store in cookie.
  const url = makeLoginUrl(state);
  res.redirect(url);
});

authRouter.get("/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  if (!code) return res.status(400).send("Missing code");

  const tokenRes = await exchangeCodeForTokens(code);
  if (!tokenRes.refresh_token) {
    return res.status(500).send("No refresh_token returned (did you already authorize without forcing?)");
  }

  const expiresAt = Date.now() + tokenRes.expires_in * 1000;

  upsertTokens({
    access_token: tokenRes.access_token,
    refresh_token: tokenRes.refresh_token,
    expires_at_ts_ms: expiresAt
  });

  // Send user back to client app
  res.redirect("http://localhost:5173/");
});

authRouter.get("/status", (_req, res) => {
  const t = getTokens();
  res.json({ authed: !!t, expires_at_ts_ms: t?.expires_at_ts_ms ?? null });
});

authRouter.post("/refresh", async (_req, res) => {
  const t = getTokens();
  if (!t) return res.status(401).json({ error: "Not authenticated" });

  const tokenRes = await refreshAccessToken(t.refresh_token);
  const expiresAt = Date.now() + tokenRes.expires_in * 1000;

  // refresh responses may omit refresh_token; keep old one
  upsertTokens({
    access_token: tokenRes.access_token,
    refresh_token: t.refresh_token,
    expires_at_ts_ms: expiresAt
  });

  res.json({ ok: true, expires_at_ts_ms: expiresAt });
});

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import YahooFinance from 'yahoo-finance2';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';

dotenv.config();

const yahooFinance = new YahooFinance();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google OAuth Helper
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set in environment variables.");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/auth/google/callback`
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Google Auth Routes
  app.get('/api/auth/google/url', (req, res) => {
    try {
      const oauth2Client = getOAuth2Client();
      const scopes = [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ];

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        prompt: 'consent'
      });

      res.json({ url });
    } catch (error: any) {
      console.error("Google Auth URL Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get(['/api/auth/google/callback', '/api/auth/google/callback/'], async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      console.error("Google Auth Error from provider:", error);
      return res.status(400).send(`Authentication failed: ${error}`);
    }

    if (!code) {
      return res.status(400).send("No authorization code provided");
    }

    try {
      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Store tokens in a cookie (SameSite=None, Secure=true for iframe)
      res.cookie('google_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.send(`
        <html>
          <body style="background: #0a0a0a; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center; padding: 40px; background: #141414; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
              <div style="width: 64px; height: 64px; background: #3b82f6; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <h2 style="margin: 0 0 8px 0; font-weight: 900; letter-spacing: -0.02em;">Success!</h2>
              <p style="color: #9ca3af; margin: 0; font-size: 14px;">Your calendar is now connected.</p>
              <p style="color: #4b5563; margin-top: 16px; font-size: 12px;">This window will close automatically...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }, '*');
                  setTimeout(() => window.close(), 1500);
                } else {
                  setTimeout(() => window.location.href = '/', 1500);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Google Auth Callback Error:", error);
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  app.get('/api/calendar/events', async (req, res) => {
    const tokensCookie = req.cookies.google_tokens;
    if (!tokensCookie) {
      return res.status(401).json({ error: "Not authenticated with Google" });
    }

    try {
      const oauth2Client = getOAuth2Client();
      const tokens = JSON.parse(tokensCookie);
      oauth2Client.setCredentials(tokens);

      // Handle token refresh automatically
      oauth2Client.on('tokens', (newTokens) => {
        if (newTokens.refresh_token) {
          // If we got a new refresh token, merge it with the old one
          tokens.refresh_token = newTokens.refresh_token;
        }
        const updatedTokens = { ...tokens, ...newTokens };
        res.cookie('google_tokens', JSON.stringify(updatedTokens), {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: 30 * 24 * 60 * 60 * 1000
        });
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      res.json(response.data.items || []);
    } catch (error: any) {
      console.error("Google Calendar API Error:", error);
      if (error.code === 401) {
        res.clearCookie('google_tokens');
        return res.status(401).json({ error: "Session expired. Please reconnect." });
      }
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('google_tokens', {
      secure: true,
      sameSite: 'none'
    });
    res.json({ success: true });
  });

  app.get('/api/auth/status', (req, res) => {
    const tokensCookie = req.cookies.google_tokens;
    res.json({ isAuthenticated: !!tokensCookie });
  });

  // Weather API Proxy
  app.get("/api/weather", async (req, res) => {
    const { location } = req.query;
    const searchLocation = (location as string) || "San Francisco";
    
    const fetchWithRetry = async (url: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              "Accept": "application/json"
            }
          });
          clearTimeout(timeout);
          return response;
        } catch (error: any) {
          clearTimeout(timeout);
          
          // If it's the last attempt, don't log "Retrying"
          if (i === retries - 1) throw error;
          
          // Only log if it's not a timeout (timeouts are common with wttr.in)
          if (error.name !== 'AbortError') {
            console.warn(`Weather fetch attempt ${i + 1} failed: ${error.message}. Retrying...`);
          }
          
          // Exponential backoff: 500ms, 1000ms, 2000ms
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 500));
        }
      }
    };

    try {
      // Try wttr.in with j1 format
      const response = await fetchWithRetry(`https://wttr.in/${encodeURIComponent(searchLocation)}?format=j1`);
      
      if (response && response.ok) {
        const data = await response.json();
        return res.json(data);
      }

      throw new Error(`wttr.in returned status ${response?.status}`);
    } catch (error) {
      console.error("Weather API Proxy Error:", error);
      
      // Fallback data if wttr.in is completely down
      const fallbackData = {
        current_condition: [{
          temp_C: "15",
          weatherDesc: [{ value: "Clear" }],
          humidity: "60",
          windspeedKmph: "12",
          FeelsLikeC: "14"
        }],
        nearest_area: [{
          areaName: [{ value: searchLocation }],
          country: [{ value: "Unknown" }]
        }]
      };
      
      console.log("Using fallback weather data for", searchLocation);
      res.json(fallbackData);
    }
  });

  // Stock API Proxy
  app.get("/api/stocks", async (req, res) => {
    const symbolsParam = (req.query.symbols as string) || "AAPL,GOOGL,MSFT,TSLA,BTC-USD";
    const symbols = symbolsParam.split(",");
    
    try {
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const quote: any = await yahooFinance.quote(symbol);
            return {
              symbol: quote.symbol,
              price: quote.regularMarketPrice,
              change: quote.regularMarketChange,
              changePercent: quote.regularMarketChangePercent,
              currency: quote.currency,
              name: quote.shortName || quote.longName || symbol,
              high: quote.regularMarketDayHigh,
              low: quote.regularMarketDayLow,
              volume: quote.regularMarketVolume,
              timestamp: Date.now()
            };
          } catch (e) {
            console.error(`Error fetching quote for ${symbol}:`, e);
            return null;
          }
        })
      );
      
      res.json(results.filter(r => r !== null));
    } catch (error) {
      console.error("Stock API Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch stock data" });
    }
  });

  // API 404 Handler - Prevent falling through to SPA HTML for missing API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Burnout AI Server running on http://localhost:${PORT}`);
  });
}

startServer();

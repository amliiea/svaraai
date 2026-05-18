/* ============================================
   SVARA AI — server.js
   ============================================ */

const express    = require('express');
const cors       = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// Bypass ngrok warning page
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// =============================================
// LIVEKIT CREDENTIALS
// =============================================
const API_KEY    = 'APIimEDHvajBBKh';
const API_SECRET = 'Hc80vSyMqzyDD9RI3FmEpZivOfUerUFdjejktA5qSHtA';
const LIVEKIT_URL = 'wss://amliiea-h2tnw8ub.livekit.cloud';

// =============================================
// GET TOKEN
// =============================================
app.get('/getToken', async (req, res) => {

    const roomName = req.query.room     || 'svara-room';
    const username = req.query.username || 'user-' + Date.now();

    if (!roomName || !username) {
        return res.status(400).json({ error: 'room dan username diperlukan' });
    }

    try {
        const at = new AccessToken(API_KEY, API_SECRET, {
            identity: username,
            ttl: '2h', // token berlaku 2 jam
        });

        at.addGrant({
            roomJoin:     true,
            room:         roomName,
            canPublish:   true,
            canSubscribe: true,
            canPublishData: true,
        });

        const token = await at.toJwt();

        console.log(`🎟️  Token dibuat untuk: ${username} → room: ${roomName}`);

        res.json({
            token,
            room:     roomName,
            username,
            livekit_url: LIVEKIT_URL,
        });

    } catch (err) {
        console.error('❌ Error buat token:', err);
        res.status(500).json({ error: 'Gagal buat token: ' + err.message });
    }
});

// =============================================
// HEALTH CHECK
// =============================================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Svara AI server jalan!' });
});

// =============================================
// START SERVER
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n⚡ Svara AI Server`);
    console.log(`✅ Jalan di http://localhost:${PORT}`);
    console.log(`🎯 Endpoint token: http://localhost:${PORT}/getToken?room=svara-room&username=Andi`);
    console.log(`🔗 LiveKit URL: ${LIVEKIT_URL}\n`);
});
const express = require('express');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

const API_KEY    = 'APIimEDHvajBBKh';
const API_SECRET = 'Hc80vSyMqzyDD9RI3FmEpZivOfUerUFdjejktA5qSHtA';
const LIVEKIT_URL = 'wss://amliiea-h2tnw8ub.livekit.cloud';

app.get('/getToken', async (req, res) => {
    const roomName = req.query.room || 'svara-room';
    const username = req.query.username || 'user-' + Date.now();

    try {
        const at = new AccessToken(API_KEY, API_SECRET, { identity: username, ttl: '2h' });
        at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });

        const token = await at.toJwt();
        res.json({ token, room: roomName, username, livekit_url: LIVEKIT_URL });
    } catch (err) {
        res.status(500).json({ error: 'Gagal buat token: ' + err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
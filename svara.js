'use strict';

// Helper
function el(id) { return document.getElementById(id); }

// Pages
const pages = {
    home: el('page-home'), join: el('page-join'), session: el('page-session'),
    code: el('page-code'), room: el('page-room'), quiz: el('page-quiz'), result: el('page-result'),
};

// Elemen
const usernameInput  = el('username');
const topicInput     = el('topic');
const joinUsername   = el('join-username');
const joinCode       = el('join-code');
const segNote        = el('seg-note');
const displayTopic   = el('display-topic');
const sidebarCode    = el('sidebar-room-code');
const displayCode    = el('display-room-code');
const codeTopic      = el('code-topic-display');
const timerEl        = el('timer');
const timerBar       = el('timer-bar');
const localVideo     = el('local-video');
const remoteVideo    = el('remote-video');
const remoteTile     = el('remote-tile');
const waitingBanner  = el('waiting-banner');
const videoGrid      = el('video-grid');
const roomStatus     = el('room-status');
const localAvatar    = el('local-avatar');
const optionsList    = el('options-list');
const quizProgress   = el('quiz-progress');
const quizLoading    = el('quiz-loading');
const scoreNum       = el('score-num');
const scoreCircle    = el('score-circle');
const scoreMsg       = el('score-msg');
const rangkumanText  = el('rangkuman-text');

const RAILWAY = 'https://svaraai-production-b7a0.up.railway.app';
const GEMINI  = 'AQ.Ab8RN6ItoRD3DPt35Vv7a-mcaZ1E8h7LVNhleNP8PQCRz_CWCw';

let state = { username: '', topic: '', roomCode: '', camOn: true, micOn: true };
let timerInterval = null;
const TIMER_TOTAL = 25 * 60;
let timerLeft = TIMER_TOTAL;
let lkRoom = null;
let quizList = [], quizIdx = 0, quizScore = 0, quizAnswered = false;
let rangkumanData = '';

/* === NAVIGASI === */
function goTo(name) {
    Object.values(pages).forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
    pages[name].classList.remove('hidden');
    pages[name].classList.add('active');
    window.scrollTo(0, 0);
}

/* === ROOM CODE === */
function makeCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'SVR-' + [0,1,2].map(() => c[Math.floor(Math.random()*c.length)]).join('');
}

/* === SEGMENT === */
document.querySelectorAll('.seg').forEach(s => {
    s.addEventListener('click', () => {
        document.querySelectorAll('.seg').forEach(x => x.classList.remove('active'));
        s.classList.add('active');
        segNote.textContent = s.dataset.val === '1' ? 'Belajar sendiri dengan timer Pomodoro.' : 'Belajar berdua — video call aktif.';
    });
});

/* === TIMER === */
function startTimer() {
    stopTimer();
    timerLeft = TIMER_TOTAL;
    renderTimer();
    timerInterval = setInterval(() => {
        timerLeft--;
        renderTimer();
        if (timerLeft <= 0) { stopTimer(); alert('Sesi selesai! Kerjakan kuis.'); endSession(); }
    }, 1000);
}

function stopTimer()  { clearInterval(timerInterval); timerInterval = null; }
function resetTimer() { stopTimer(); timerLeft = TIMER_TOTAL; renderTimer(); }

function renderTimer() {
    const m = Math.floor(timerLeft/60), s = timerLeft%60;
    timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const pct = (timerLeft/TIMER_TOTAL)*100;
    timerBar.style.width = pct + '%';
    timerBar.style.background = pct < 20 ? '#ef4444' : pct < 50 ? '#f59e0b' : '#3b82f6';
}

/* === VALIDASI === */
function validate() {
    if (!usernameInput.value.trim()) { alert('Nama belum diisi!'); usernameInput.focus(); return false; }
    if (!topicInput.value.trim())    { alert('Topik belum diisi!'); topicInput.focus();   return false; }
    return true;
}

/* === LIVEKIT === */
async function connectLiveKit(roomName) {
    if (typeof LivekitClient === 'undefined') { setStatus('LiveKit tidak tersedia'); return; }
    setStatus('Menghubungkan...');
    try {
        const res   = await fetch(`${RAILWAY}/getToken?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(state.username)}`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        const { token } = await res.json();

        lkRoom = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });

        lkRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track, pub, participant) => {
            if (track.kind === LivekitClient.Track.Kind.Video) attachRemote(track, participant.identity);
        });
        lkRoom.on(LivekitClient.RoomEvent.TrackUnsubscribed, t => { t.detach(); showPlaceholder(); });
        lkRoom.on(LivekitClient.RoomEvent.ParticipantDisconnected, () => { showPlaceholder(); setStatus('Peserta lain keluar'); });
        lkRoom.on(LivekitClient.RoomEvent.DataReceived, data => {
            try {
                const msg = JSON.parse(new TextDecoder().decode(data));
                if (msg.type === 'END') { alert('Peserta lain mengakhiri sesi!'); endSession(); }
            } catch(e) {}
        });

        await lkRoom.connect('wss://amliiea-h2tnw8ub.livekit.cloud', token);
        setStatus('Terhubung sebagai ' + state.username);
        await lkRoom.localParticipant.setCameraEnabled(true);
        await lkRoom.localParticipant.setMicrophoneEnabled(true);

        lkRoom.localParticipant.videoTrackPublications.forEach(pub => { if (pub.track) attachLocal(pub.track); });
        lkRoom.localParticipant.on(LivekitClient.ParticipantEvent.LocalTrackPublished, pub => {
            if (pub.track?.kind === LivekitClient.Track.Kind.Video) attachLocal(pub.track);
        });
        lkRoom.remoteParticipants.forEach(p => {
            p.videoTrackPublications.forEach(pub => { if (pub.isSubscribed && pub.track) attachRemote(pub.track, p.identity); });
        });
    } catch(err) {
        setStatus('Gagal: ' + err.message);
        alert('Gagal connect ke LiveKit:\n' + err.message);
    }
}

function attachLocal(track) {
    localVideo.querySelector('video')?.remove();
    const v = track.attach();
    v.muted = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:18px;';
    localVideo.appendChild(v);
    const ph = localVideo.querySelector('.video-placeholder');
    if (ph) ph.style.display = 'none';
}

function attachRemote(track, identity) {
    remoteTile.classList.remove('hidden');
    videoGrid.classList.add('duo');
    if (waitingBanner) waitingBanner.style.display = 'none';
    remoteVideo.querySelector('video')?.remove();
    const v = track.attach();
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:18px;';
    remoteVideo.appendChild(v);
    const ph = remoteVideo.querySelector('.video-placeholder');
    if (ph) ph.style.display = 'none';
    const lbl = el('remote-label-name');
    if (lbl) lbl.textContent = identity || 'User Lain';
    setStatus(identity + ' bergabung');
}

function showPlaceholder() {
    remoteTile.classList.add('hidden');
    videoGrid.classList.remove('duo');
    if (waitingBanner) waitingBanner.style.display = 'flex';
    remoteVideo.querySelector('video')?.remove();
    const ph = remoteVideo.querySelector('.video-placeholder');
    if (ph) ph.style.display = 'flex';
}

function setStatus(msg) { if (roomStatus) roomStatus.textContent = msg; }

async function toggleCam() {
    if (!lkRoom) return;
    state.camOn = !state.camOn;
    await lkRoom.localParticipant.setCameraEnabled(state.camOn);
    el('btn-toggle-cam').classList.toggle('off', !state.camOn);
    el('btn-toggle-cam').textContent = state.camOn ? 'Kamera' : 'Kamera Off';
}

async function toggleMic() {
    if (!lkRoom) return;
    state.micOn = !state.micOn;
    await lkRoom.localParticipant.setMicrophoneEnabled(state.micOn);
    el('btn-toggle-mic').classList.toggle('off', !state.micOn);
    el('btn-toggle-mic').textContent = state.micOn ? 'Mikrofon' : 'Mikrofon Off';
}

function disconnectLK() { if (lkRoom) { lkRoom.disconnect(); lkRoom = null; } }

async function broadcastEnd() {
    if (!lkRoom) return;
    try {
        const msg = new TextEncoder().encode(JSON.stringify({ type: 'END' }));
        await lkRoom.localParticipant.publishData(msg, { reliable: true });
        await new Promise(r => setTimeout(r, 500));
    } catch(e) {}
}

function enterRoom() {
    displayTopic.textContent = state.topic;
    sidebarCode.textContent  = state.roomCode;
    localAvatar.textContent  = state.username.charAt(0).toUpperCase();
    const ln = el('local-label-name');
    if (ln) ln.textContent = state.username;
    goTo('room');
    startTimer();
    connectLiveKit(state.roomCode);
}

async function endSession() {
    stopTimer();
    await broadcastEnd();
    disconnectLK();
    goTo('quiz');
    await loadQuiz();
}

/* === QUIZ (GEMINI) === */
async function loadQuiz() {
    quizIdx = 0; quizScore = 0; quizAnswered = false; quizList = [];
    quizLoading.classList.add('show');
    el('question-card').style.display = 'none';
    el('btn-next').style.display = 'none';

    try {
        const prompt = `Kamu adalah dosen. Buat 5 soal pilihan ganda faktual tentang "${state.topic}" untuk mahasiswa. Respons HANYA JSON array tanpa markdown: [{"q":"pertanyaan","opts":["A","B","C","D"],"ans":0}] dimana ans adalah index 0-3 jawaban benar.`;
        const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
        });
        const data = await res.json();
        console.log("QUIZ GEMINI:", data);
        const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        quizList   = JSON.parse(raw.replace(/```json|```/g, '').trim());
        if (!Array.isArray(quizList) || !quizList.length) throw new Error('invalid');
    } catch(e) {
        quizList = fallback();
    }

    quizLoading.classList.remove('show');
    el('question-card').style.display = 'block';
    el('btn-next').style.display = 'flex';
    el('q-total').textContent = quizList.length;
    renderQ();
}

function fallback() {
    return [
        { q: 'Apa manfaat utama teknik Pomodoro?', opts: ['Mengurangi waktu belajar','Meningkatkan fokus','Membuat cepat bosan','Tidak ada manfaat'], ans: 1 },
        { q: 'Metode belajar paling efektif adalah?', opts: ['Membaca pasif','Menghafal','Latihan aktif','Belajar semalam'], ans: 2 },
        { q: 'Apa yang sebaiknya dilakukan setelah belajar?', opts: ['Langsung tidur','Review singkat','Ganti topik','Abaikan materi'], ans: 1 },
        { q: 'Mengapa belajar konsisten penting?', opts: ['Tidak penting','Membangun pemahaman jangka panjang','Hanya untuk nilai','Agar cepat selesai'], ans: 1 },
        { q: 'Apa tujuan evaluasi setelah belajar?', opts: ['Formalitas saja','Mengukur pemahaman materi','Membuang waktu','Tidak ada tujuan'], ans: 1 },
    ];
}

function renderQ() {
    if (quizIdx >= quizList.length) { showResult(); return; }
    quizAnswered = false;
    el('btn-next').disabled = true;
    const q = quizList[quizIdx];
    el('q-num').textContent     = quizIdx + 1;
    el('q-correct').textContent = quizScore;
    el('q-text').textContent    = q.q;
    quizProgress.style.width   = `${(quizIdx/quizList.length)*100}%`;
    optionsList.innerHTML = '';
    q.opts.forEach((opt, i) => {
        const d = document.createElement('div');
        d.className = 'option-item';
        d.innerHTML = `<div class="option-radio"></div><span>${opt}</span>`;
        d.addEventListener('click', () => pilih(d, i, q.ans));
        optionsList.appendChild(d);
    });
}

function pilih(el2, chosen, correct) {
    if (quizAnswered) return;
    quizAnswered = true;
    optionsList.querySelectorAll('.option-item').forEach((item, i) => { if (i === correct) item.classList.add('correct'); });
    if (chosen === correct) { el2.classList.add('correct'); quizScore++; }
    else el2.classList.add('wrong');
    el('q-correct').textContent = quizScore;
    el('btn-next').disabled = false;
}

/* === RESULT === */
async function showResult() {
    const total = quizList.length;
    const skor  = Math.round((quizScore/total)*100);
    el('stat-benar').textContent = quizScore;
    el('stat-salah').textContent = total - quizScore;
    el('stat-total').textContent = total;
    if (skor >= 90)      scoreMsg.textContent = 'Luar biasa! Kamu sangat menguasai materi ini!';
    else if (skor >= 70) scoreMsg.textContent = 'Bagus! Kamu sudah paham sebagian besar materi.';
    else if (skor >= 50) scoreMsg.textContent = 'Lumayan! Ulangi materi yang kurang dipahami.';
    else                 scoreMsg.textContent = 'Jangan menyerah! Terus belajar ya!';
    goTo('result');
    const circ = 326.7;
    let cur = 0;
    const anim = setInterval(() => {
        cur = Math.min(cur+2, skor);
        scoreNum.textContent = cur;
        scoreCircle.style.strokeDashoffset = circ - (cur/100)*circ;
        if (cur >= skor) clearInterval(anim);
    }, 20);
    await buatRangkuman(skor);
}

async function buatRangkuman(skor) {
    rangkumanText.textContent = 'AI sedang membuat rangkuman...';
    try {
        const prompt = `Buatkan rangkuman belajar 3-4 paragraf tentang "${state.topic}" untuk mahasiswa yang baru menyelesaikan sesi 25 menit dengan skor ${skor}/100. Bahasa Indonesia yang mudah dipahami.`;
        const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        console.log("SUMMARY GEMINI:", data);
        rangkumanData = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        rangkumanText.textContent = rangkumanData;
    } catch(e) {
        rangkumanData = `Kamu telah menyelesaikan sesi belajar "${state.topic}" dengan skor ${skor}/100. Terus semangat!`;
        rangkumanText.textContent = rangkumanData;
    }
}

function downloadRangkuman() {
    const tgl    = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
    const konten = `RANGKUMAN BELAJAR - SVARA AI\n${'='.repeat(40)}\nNama  : ${state.username}\nTopik : ${state.topic}\nTgl   : ${tgl}\nSkor  : ${scoreNum.textContent}/100\n${'='.repeat(40)}\n\n${rangkumanData}`;
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([konten], { type: 'text/plain;charset=utf-8' }));
    a.download = `rangkuman-${state.topic.replace(/\s+/g,'-').toLowerCase()}.txt`;
    a.click();
}

function restart() {
    disconnectLK(); resetTimer();
    Object.assign(state, { username:'', topic:'', roomCode:'', camOn:true, micOn:true });
    usernameInput.value = ''; topicInput.value = '';
    quizIdx = 0; quizScore = 0; quizList = []; rangkumanData = '';
    showPlaceholder();
    goTo('home');
}

/* === EVENT LISTENERS === */
el('btn-start')?.addEventListener('click', () => goTo('session'));
el('btn-join-room')?.addEventListener('click', () => goTo('join'));
el('btn-back-join')?.addEventListener('click', () => goTo('home'));
el('btn-back-home')?.addEventListener('click', () => goTo('home'));
el('btn-back-home2')?.addEventListener('click', () => goTo('home'));

el('btn-do-join')?.addEventListener('click', async () => {
    const nama = joinUsername.value.trim();
    const kode = joinCode.value.trim().toUpperCase();
    if (!nama) { alert('Nama belum diisi!'); joinUsername.focus(); return; }
    if (kode.length < 6) { alert('Kode room tidak valid!'); joinCode.focus(); return; }
    state.username = nama;
    state.roomCode = kode;
    state.topic    = kode;
    displayTopic.textContent = kode;
    sidebarCode.textContent  = kode;
    localAvatar.textContent  = nama.charAt(0).toUpperCase();
    const ln = el('local-label-name');
    if (ln) ln.textContent = nama;
    goTo('room');
    startTimer();
    await connectLiveKit(kode);
});

el('btn-join')?.addEventListener('click', () => {
    if (!validate()) return;
    state.username = usernameInput.value.trim();
    state.topic    = topicInput.value.trim();
    state.roomCode = makeCode();
    displayCode.textContent = state.roomCode;
    codeTopic.textContent   = state.topic;
    goTo('code');
});

el('btn-copy-code')?.addEventListener('click', () => {
    navigator.clipboard.writeText(state.roomCode).then(() => {
        el('btn-copy-code').textContent = 'Tersalin!';
        setTimeout(() => el('btn-copy-code').textContent = 'Salin Kode', 2000);
    });
});

el('btn-enter-room')?.addEventListener('click', () => enterRoom());
el('btn-toggle-cam')?.addEventListener('click', toggleCam);
el('btn-toggle-mic')?.addEventListener('click', toggleMic);
el('btn-finish')?.addEventListener('click', async () => { if (!confirm('Yakin selesaikan sesi?')) return; endSession(); });
el('btn-next')?.addEventListener('click', () => { quizIdx++; if (quizIdx >= quizList.length) showResult(); else renderQ(); });
el('btn-download')?.addEventListener('click', downloadRangkuman);
el('btn-restart')?.addEventListener('click', restart);
el('btn-home-result')?.addEventListener('click', () => goTo('home'));

goTo('home');
'use strict';

const $ = id => document.getElementById(id);

const pages = {
    home:    $('page-home'),
    join:    $('page-join'),
    session: $('page-session'),
    code:    $('page-code'),
    room:    $('page-room'),
    quiz:    $('page-quiz'),
    result:  $('page-result'),
};

// Session
const btnStart      = $('btn-start');
const btnJoinRoom   = $('btn-join-room');
const btnBackHome   = $('btn-back-home');
const btnBackHome2  = $('btn-back-home2');
const btnBackJoin   = $('btn-back-join');
const btnJoin       = $('btn-join');
const btnDoJoin     = $('btn-do-join');
const btnEnterRoom  = $('btn-enter-room');
const btnCopyCode   = $('btn-copy-code');
const usernameInput = $('username');
const topicInput    = $('topic');
const segNote       = $('seg-note');
const joinUsername  = $('join-username');
const joinCode      = $('join-code');

// Room
const displayTopic    = $('display-topic');
const sidebarRoomCode = $('sidebar-room-code');
const displayRoomCode = $('display-room-code');
const codeTopicDisplay = $('code-topic-display');
const timerEl         = $('timer');
const timerBar        = $('timer-bar');
const localVideo      = $('local-video');
const remoteVideo     = $('remote-video');
const remoteTile      = $('remote-tile');
const waitingBanner   = $('waiting-banner');
const videoGrid       = $('video-grid');
const roomStatus      = $('room-status');
const localAvatar     = $('local-avatar');
const btnToggleCam    = $('btn-toggle-cam');
const btnToggleMic    = $('btn-toggle-mic');
const btnFinish       = $('btn-finish');

// Quiz
const qNum          = $('q-num');
const qTotal        = $('q-total');
const qCorrect      = $('q-correct');
const qText         = $('q-text');
const optionsList   = $('options-list');
const quizProgress  = $('quiz-progress');
const btnNext       = $('btn-next');
const quizLoading   = $('quiz-loading');

// Result
const scoreNum      = $('score-num');
const scoreCircle   = $('score-circle');
const scoreMsg      = $('score-msg');
const statBenar     = $('stat-benar');
const statSalah     = $('stat-salah');
const statTotal     = $('stat-total');
const rangkumanText = $('rangkuman-text');
const btnDownload   = $('btn-download');
const btnRestart    = $('btn-restart');

const RAILWAY_URL = 'https://svaraai-production-b7a0.up.railway.app';

let state = {
    username:  '',
    topic:     '',
    peserta:   1,
    roomCode:  '',
    camOn:     true,
    micOn:     true,
};

let timerInterval = null;
const timerTotal  = 25 * 60;
let timerLeft     = timerTotal;
let livekitRoom   = null;
let localCamTrack = null;
let localMicTrack = null;
let quizQuestions = [];
let quizIndex     = 0;
let quizScore     = 0;
let quizAnswered  = false;
let rangkumanData = '';


/* ============ NAVIGASI ============ */
function goTo(name) {
    Object.values(pages).forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
    });
    pages[name].classList.remove('hidden');
    pages[name].classList.add('active');
    window.scrollTo(0, 0);
}


/* ============ GENERATE KODE ROOM ============ */
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'SVR-';
    for (let i = 0; i < 3; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}


/* ============ SEGMENT CONTROL ============ */
document.querySelectorAll('.seg').forEach(seg => {
    seg.addEventListener('click', () => {
        document.querySelectorAll('.seg').forEach(s => s.classList.remove('active'));
        seg.classList.add('active');
        state.peserta = parseInt(seg.dataset.val);
        segNote.textContent = state.peserta === 1
            ? 'Belajar sendiri dengan timer Pomodoro.'
            : 'Belajar berdua — video call aktif.';
    });
});


/* ============ TIMER ============ */
function startTimer() {
    stopTimer();
    timerLeft = timerTotal;
    renderTimer();
    timerInterval = setInterval(() => {
        timerLeft--;
        renderTimer();
        if (timerLeft <= 0) {
            stopTimer();
            alert('⏱️ Sesi belajar selesai! Sekarang kerjakan kuis.');
            endSession();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    timerLeft = timerTotal;
    renderTimer();
}

function renderTimer() {
    const m = Math.floor(timerLeft / 60);
    const s = timerLeft % 60;
    timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const pct = (timerLeft / timerTotal) * 100;
    timerBar.style.width = `${pct}%`;
    timerBar.style.background = pct < 20 ? '#ef4444' : pct < 50 ? '#f59e0b' : '#3b82f6';
}


/* ============ VALIDASI ============ */
function validate() {
    const nama  = usernameInput.value.trim();
    const topik = topicInput.value.trim();
    if (!nama)  { alert('⚠️ Nama belum diisi!');  usernameInput.focus(); return false; }
    if (!topik) { alert('⚠️ Topik belum diisi!'); topicInput.focus();    return false; }
    return true;
}


/* ============ LIVEKIT ============ */
async function connectLiveKit(roomName) {
    if (typeof LivekitClient === 'undefined') {
        setStatus('⚠️ LiveKit tidak tersedia');
        return;
    }
    setStatus('Menghubungkan ke server...');

    try {
        const res = await fetch(
            `${RAILWAY_URL}/getToken?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(state.username)}`,
            { headers: { 'ngrok-skip-browser-warning': 'true' } }
        );
        if (!res.ok) throw new Error('Gagal ambil token dari server');
        const { token } = await res.json();

        livekitRoom = new LivekitClient.Room({
            adaptiveStream: true,
            dynacast: true,
        });

        livekitRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track, pub, participant) => {
            if (track.kind === LivekitClient.Track.Kind.Video) {
                attachRemoteVideo(track, participant.identity);
            }
        });

        livekitRoom.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
            track.detach();
            showRemotePlaceholder();
        });

        livekitRoom.on(LivekitClient.RoomEvent.ParticipantDisconnected, () => {
            showRemotePlaceholder();
            setStatus('Peserta lain keluar dari room');
        });

        await livekitRoom.connect('wss://amliiea-h2tnw8ub.livekit.cloud', token);
        setStatus(`✅ Terhubung sebagai ${state.username}`);

        await livekitRoom.localParticipant.enableCameraAndMicrophone();

        livekitRoom.localParticipant.videoTrackPublications.forEach(pub => {
            if (pub.track) attachLocalVideo(pub.track);
        });

        livekitRoom.localParticipant.on(
            LivekitClient.ParticipantEvent.LocalTrackPublished,
            pub => {
                if (pub.track?.kind === LivekitClient.Track.Kind.Video) {
                    attachLocalVideo(pub.track);
                    localCamTrack = pub.track;
                }
                if (pub.track?.kind === LivekitClient.Track.Kind.Audio) {
                    localMicTrack = pub.track;
                }
            }
        );

        livekitRoom.remoteParticipants.forEach(participant => {
            participant.videoTrackPublications.forEach(pub => {
                if (pub.isSubscribed && pub.track) {
                    attachRemoteVideo(pub.track, participant.identity);
                }
            });
        });

    } catch (err) {
        console.error('LiveKit error:', err);
        setStatus('❌ ' + err.message);
        alert('❌ Gagal connect ke LiveKit:\n' + err.message);
    }
}

function attachLocalVideo(track) {
    const existing = localVideo.querySelector('video');
    if (existing) existing.remove();
    const el = track.attach();
    el.muted = true;
    el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:18px;';
    localVideo.appendChild(el);
    const ph = localVideo.querySelector('.video-placeholder');
    if (ph) ph.style.display = 'none';
    localCamTrack = track;
}

function attachRemoteVideo(track, identity) {
    remoteTile.classList.remove('hidden');
    videoGrid.classList.add('duo');
    if (waitingBanner) waitingBanner.style.display = 'none';
    const existing = remoteVideo.querySelector('video');
    if (existing) existing.remove();
    const el = track.attach();
    el.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:18px;';
    remoteVideo.appendChild(el);
    const ph = remoteVideo.querySelector('.video-placeholder');
    if (ph) ph.style.display = 'none';
    const remoteLabel = $('remote-label-name');
    if (remoteLabel) remoteLabel.textContent = identity || 'User Lain';
    setStatus(`✅ ${identity} bergabung`);
}

function showRemotePlaceholder() {
    remoteTile.classList.add('hidden');
    videoGrid.classList.remove('duo');
    if (waitingBanner) waitingBanner.style.display = 'flex';
    const existing = remoteVideo.querySelector('video');
    if (existing) existing.remove();
    const ph = remoteVideo.querySelector('.video-placeholder');
    if (ph) ph.style.display = 'flex';
}

function setStatus(msg) {
    if (roomStatus) roomStatus.textContent = msg;
}

async function toggleCamera() {
    if (!livekitRoom) return;
    state.camOn = !state.camOn;
    await livekitRoom.localParticipant.setCameraEnabled(state.camOn);
    btnToggleCam.classList.toggle('off', !state.camOn);
    btnToggleCam.textContent = state.camOn ? '📹' : '📷';
}

async function toggleMic() {
    if (!livekitRoom) return;
    state.micOn = !state.micOn;
    await livekitRoom.localParticipant.setMicrophoneEnabled(state.micOn);
    btnToggleMic.classList.toggle('off', !state.micOn);
    btnToggleMic.textContent = state.micOn ? '🎙️' : '🔇';
}

function disconnectLiveKit() {
    if (livekitRoom) {
        livekitRoom.disconnect();
        livekitRoom = null;
    }
}

function enterRoom() {
    displayTopic.textContent    = state.topic;
    sidebarRoomCode.textContent = state.roomCode;
    localAvatar.textContent     = state.username.charAt(0).toUpperCase();
    const ln = $('local-label-name');
    if (ln) ln.textContent = state.username;
    goTo('room');
    startTimer();
    connectLiveKit(state.roomCode);
}


/* ============ END SESSION ============ */
async function endSession() {
    stopTimer();
    disconnectLiveKit();
    goTo('quiz');
    await loadQuiz();
}


/* ============ QUIZ ============ */
async function loadQuiz() {
    quizIndex = 0; quizScore = 0; quizAnswered = false; quizQuestions = [];
    quizLoading.classList.add('show');
    $('question-card').style.display = 'none';
    btnNext.style.display = 'none';

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `Buat 5 soal pilihan ganda tentang topik: "${state.topic}". Respons HANYA JSON array, tanpa markdown, tanpa teks lain:
[{"q":"pertanyaan?","opts":["A","B","C","D"],"ans":0}]
"ans" adalah index jawaban benar (0-3). Buat soal yang edukatif dalam Bahasa Indonesia.`
                }]
            })
        });
        const data    = await res.json();
        const raw     = data.content?.[0]?.text || '[]';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        quizQuestions = JSON.parse(cleaned);
    } catch (err) {
        quizQuestions = fallbackQuiz(state.topic);
    }

    quizLoading.classList.remove('show');
    $('question-card').style.display = 'block';
    btnNext.style.display = 'flex';
    qTotal.textContent = quizQuestions.length;
    renderQuestion();
}

function fallbackQuiz(topik) {
    return [
        { q: `Apa konsep utama dalam "${topik}"?`, opts: ['Dasar teori', 'Praktik langsung', 'Evaluasi hasil', 'Semua di atas'], ans: 3 },
        { q: 'Metode belajar paling efektif?', opts: ['Membaca pasif', 'Latihan aktif', 'Hanya menonton', 'Belajar semalam'], ans: 1 },
        { q: 'Manfaat teknik Pomodoro?', opts: ['Membuang waktu', 'Meningkatkan fokus', 'Membuat bosan', 'Tidak ada manfaat'], ans: 1 },
        { q: 'Yang dilakukan setelah belajar?', opts: ['Langsung tidur', 'Review singkat', 'Abaikan materi', 'Ganti topik'], ans: 1 },
        { q: `Mengapa "${topik}" penting?`, opts: ['Tidak penting', 'Relevan di dunia kerja', 'Hanya untuk ahli', 'Ketinggalan zaman'], ans: 1 },
    ];
}

function renderQuestion() {
    if (quizIndex >= quizQuestions.length) { showResult(); return; }
    quizAnswered = false;
    btnNext.disabled = true;
    const q   = quizQuestions[quizIndex];
    const pct = (quizIndex / quizQuestions.length) * 100;
    qNum.textContent         = quizIndex + 1;
    qCorrect.textContent     = quizScore;
    qText.textContent        = q.q;
    quizProgress.style.width = `${pct}%`;
    optionsList.innerHTML = '';
    q.opts.forEach((opt, i) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        div.innerHTML = `<div class="option-radio"></div><span>${opt}</span>`;
        div.addEventListener('click', () => pilihJawaban(div, i, q.ans));
        optionsList.appendChild(div);
    });
}

function pilihJawaban(el, chosen, correct) {
    if (quizAnswered) return;
    quizAnswered = true;
    optionsList.querySelectorAll('.option-item').forEach((item, i) => {
        if (i === correct) item.classList.add('correct');
    });
    if (chosen === correct) { el.classList.add('correct'); quizScore++; }
    else el.classList.add('wrong');
    qCorrect.textContent = quizScore;
    btnNext.disabled = false;
}


/* ============ RESULT ============ */
async function showResult() {
    const total = quizQuestions.length;
    const salah = total - quizScore;
    const skor  = Math.round((quizScore / total) * 100);
    statBenar.textContent = quizScore;
    statSalah.textContent = salah;
    statTotal.textContent = total;
    if (skor >= 90)      scoreMsg.textContent = '🏆 Luar biasa! Kamu sangat menguasai materi ini!';
    else if (skor >= 70) scoreMsg.textContent = '💪 Bagus! Kamu sudah paham sebagian besar materi.';
    else if (skor >= 50) scoreMsg.textContent = '📖 Lumayan! Ulangi materi yang masih kurang dipahami.';
    else                 scoreMsg.textContent = '😅 Jangan menyerah! Terus belajar ya!';
    goTo('result');
    const circ = 326.7;
    let cur = 0;
    const anim = setInterval(() => {
        cur = Math.min(cur + 2, skor);
        scoreNum.textContent = cur;
        scoreCircle.style.strokeDashoffset = circ - (cur / 100) * circ;
        if (cur >= skor) clearInterval(anim);
    }, 20);
    await buatRangkuman(skor);
}

async function buatRangkuman(skor) {
    rangkumanText.textContent = '⏳ AI sedang membuat rangkuman...';
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: `Buatkan rangkuman belajar (3-4 paragraf) tentang topik "${state.topic}" untuk pelajar yang baru menyelesaikan sesi 25 menit dengan skor ${skor}/100. Tulis dalam Bahasa Indonesia yang mudah dipahami.`
                }]
            })
        });
        const data = await res.json();
        rangkumanData = data.content?.[0]?.text || '';
        rangkumanText.textContent = rangkumanData;
    } catch (err) {
        rangkumanData = `Rangkuman Topik: ${state.topic}\n\nKamu telah menyelesaikan sesi belajar dengan skor ${skor}/100. Terus semangat!`;
        rangkumanText.textContent = rangkumanData;
    }
}

function downloadRangkuman() {
    const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const konten  = `RANGKUMAN BELAJAR — SVARA AI\n${'='.repeat(40)}\nNama    : ${state.username}\nTopik   : ${state.topic}\nTanggal : ${tanggal}\nSkor    : ${scoreNum.textContent}/100\n${'='.repeat(40)}\n\n${rangkumanData}\n\n${'='.repeat(40)}\nDibuat oleh Svara AI`;
    const blob = new Blob([konten], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `rangkuman-${state.topic.replace(/\s+/g,'-').toLowerCase()}.txt`;
    a.click(); URL.revokeObjectURL(url);
}

function restart() {
    disconnectLiveKit(); resetTimer();
    Object.assign(state, { username:'', topic:'', roomCode:'', camOn:true, micOn:true });
    usernameInput.value = ''; topicInput.value = '';
    quizIndex = 0; quizScore = 0; quizQuestions = []; rangkumanData = '';
    showRemotePlaceholder();
    goTo('home');
}


/* ============ EVENT LISTENERS ============ */

// Home
btnStart?.addEventListener('click', () => goTo('session'));
btnJoinRoom?.addEventListener('click', () => goTo('join'));

// Join dengan kode
btnBackJoin?.addEventListener('click', () => goTo('home'));
btnDoJoin?.addEventListener('click', async () => {
    const nama = joinUsername.value.trim();
    const kode = joinCode.value.trim().toUpperCase();
    if (!nama) { alert('⚠️ Nama belum diisi!'); joinUsername.focus(); return; }
    if (!kode || kode.length < 6) { alert('⚠️ Kode room tidak valid!'); joinCode.focus(); return; }
    state.username = nama;
    state.roomCode = kode;
    state.topic    = kode; // topic akan diisi dari room
    displayTopic.textContent    = kode;
    sidebarRoomCode.textContent = kode;
    localAvatar.textContent     = nama.charAt(0).toUpperCase();
    const ln = $('local-label-name');
    if (ln) ln.textContent = nama;
    goTo('room');
    startTimer();
    await connectLiveKit(kode);
});

// Session (buat room baru)
btnBackHome?.addEventListener('click',  () => goTo('home'));
btnBackHome2?.addEventListener('click', () => goTo('home'));

btnJoin?.addEventListener('click', () => {
    if (!validate()) return;
    state.username = usernameInput.value.trim();
    state.topic    = topicInput.value.trim();
    state.roomCode = generateRoomCode();
    displayRoomCode.textContent  = state.roomCode;
    codeTopicDisplay.textContent = state.topic;
    goTo('code');
});

// Halaman kode room
btnCopyCode?.addEventListener('click', () => {
    navigator.clipboard.writeText(state.roomCode).then(() => {
        btnCopyCode.textContent = '✅ Tersalin!';
        setTimeout(() => btnCopyCode.textContent = '📋 Salin Kode', 2000);
    });
});

btnEnterRoom?.addEventListener('click', () => enterRoom());

// Room controls
btnToggleCam?.addEventListener('click', toggleCamera);
btnToggleMic?.addEventListener('click', toggleMic);
btnFinish?.addEventListener('click', () => {
    if (!confirm('Yakin mau selesaikan sesi belajar?')) return;
    endSession();
});

// Quiz
btnNext?.addEventListener('click', () => {
    quizIndex++;
    if (quizIndex >= quizQuestions.length) showResult();
    else renderQuestion();
});

// Result
btnDownload?.addEventListener('click', downloadRangkuman);
btnRestart?.addEventListener('click',  restart);


/* ============ CSS TAMBAHAN INLINE ============ */
const style = document.createElement('style');
style.textContent = `
.home-btns { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.room-code-display { background: var(--bg3); border: 2px dashed var(--accent); border-radius: 18px; padding: 28px; margin: 24px 0; }
.rcd-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text3); margin-bottom: 12px; }
.rcd-code { font-family: var(--mono); font-size: 3rem; font-weight: 700; color: var(--accent2); letter-spacing: 0.1em; margin-bottom: 16px; }
.rcd-copy { background: var(--accent); color: #fff; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 600; transition: background 0.2s; }
.rcd-copy:hover { background: var(--accent2); }
.room-code-info { display: flex; flex-direction: column; gap: 8px; color: var(--text2); font-size: 0.9rem; }
.rci-item { background: var(--bg3); border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px; }
.rs-room-code { margin-bottom: 4px; }
.rs-code-val { font-family: var(--mono); font-size: 1.1rem; font-weight: 700; color: var(--accent2); }
.code-input { text-transform: uppercase; font-family: var(--mono); font-size: 1.2rem; letter-spacing: 0.1em; text-align: center; }
`;
document.head.appendChild(style);


/* ============ INIT ============ */
goTo('home');
console.log('✅ Svara AI ready!');
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

/* =========================================================
   STELLARS PULSE — ONE RANDOM POLL PER DAY
   Polling window: 09:30–13:00 Asia/Jakarta.
   The Firestore Rules enforce the voting window using server time.
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyD3ptwKTkLqFCmvrTVJFooFiVLE63mh83c",
    authDomain: "class-web-7241e.firebaseapp.com",
    projectId: "class-web-7241e",
    storageBucket: "class-web-7241e.firebasestorage.app",
    messagingSenderId: "167560389153",
    appId: "1:167560389153:web:f61f4f821275c48373f960",
    measurementId: "G-DTHTZNT135"
};

const TIME_ZONE = "Asia/Jakarta";
const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 13 * 60;

const ROSTER = ["Quinetta Aulya Winata","Darren Leinad Cahaya","Vianney Yovella Kristanto","Levinne Emerson Mulia","Delfina Calista Ciu Putri","Kelly Patricia Ongkodjojo","Felicia Zefanya","Nicke Mega Amelia Trijono","Tesalonika Uli Putri Silalahi","Ersya Fely","Shareen Tesalonika Setiawan","Marsha Setiawan","Anita Lestari Elisabet","Anjelie","Johanna Avrilla Hapsari Putri","Kevano Mareto","Vincent Farrelius","Elmarsha Hannabella","Kioko Rei","Raisya Thalita Jasmine","Ellie Margaretta","Jasper Vladino Alvis","Adeline Nadia Nicola","Andre Praditya Pratama","Carmella Wibowo Widhianto","Chairine Aretha Nathania","Danniel","Eilien Ardelia","Grace Abigail Wijaya","Gracielle Fellisca Tjoa","Hosea Bowie Immanuel","Jean Romeo Junior Sembiring","Keely Michiko Mulyanto","Maresha Majesty Wales","Maya Caroline","Pande Kadek Redita Julia Dewi","Patricia Devina","Putu Adelia Nariswari","Reynard Christian","Samantha Angel","Stevander Rusli","Stephanie Felita Widodo","Chantika Anastasia","Vivian Renata Chandra","Zalika Afarin Azura"].map(name => ({
    // Preserve historical poll IDs so existing Firestore vote documents and Rules remain compatible.
    id: name === "Nicke Mega Amelia Trijono" ? "nicke-amelia-trijono" :
        name === "Vincent Farrelius" ? "vincent-farellius" : slugify(name),
    name
}));

const INITIAL_30_DAY_QUESTIONS = [{"id":"monyet-king-queen","category":"KING/QUEEN OF MONYET 🐒","title":"Siapa yang paling cocok dapat gelar King/Queen of Monyet karena energinya nggak pernah habis?","prompt":"Yang paling aktif, paling spontan, dan susah diam. Pilih dengan sayang, bukan buat nge-roast."},{"id":"absurd-quotes","category":"THE ABSURD QUOTE AWARD","title":"Siapa yang paling absurd dan sering mengeluarkan kalimat yang bikin satu kelas mikir keras?","prompt":"Satu kalimatnya bisa jadi bahan diskusi sampai jam pulang."},{"id":"heboh-sekelas","category":"LOUDER THAN THE BELL","title":"Siapa yang paling heboh walaupun cuma ada kejadian sepele?","prompt":"Hal kecil pun bisa berubah jadi satu episode penuh."},{"id":"laughter-speaker","category":"THE HUMAN SPEAKER","title":"Siapa yang ketawanya paling kencang dan paling gampang menular?","prompt":"Begitu dia mulai ketawa, satu kelas ikut kena."},{"id":"meme-face","category":"MEME FACE OF THE YEAR","title":"Siapa yang ekspresinya paling memeable setiap kali ada foto kelas?","prompt":"Ekspresi spontan yang selalu punya potensi jadi stiker grup."},{"id":"power-napper","category":"POWER NAP CHAMPION","title":"Siapa yang paling jago menemukan posisi ternyaman buat tidur sebentar di kelas?","prompt":"Kalau ada jeda lima menit, dia sudah punya strategi istirahat."},{"id":"creative-late","category":"THE CREATIVE EXCUSE AWARD","title":"Siapa yang paling sering telat dengan alasan yang paling tidak terduga?","prompt":"Alasannya selalu punya plot twist. Tetap ingat, ini buat bercanda."},{"id":"instant-serious","category":"PROFESSIONAL ACTOR","title":"Siapa yang paling jago langsung pasang muka serius saat dosen lewat, padahal barusan ngelawak?","prompt":"Perubahan ekspresinya layak dapat penghargaan akting."},{"id":"where-are-you","category":"MISSING IN ACTION","title":"Siapa yang paling sulit ditemukan saat jam istirahat atau kerja kelompok?","prompt":"Dicari sebentar, tahu-tahu sudah muncul dari arah yang nggak disangka."},{"id":"notes-archive","category":"THE HUMAN ARCHIVE","title":"Siapa yang paling rajin mencatat sampai catatannya jadi penyelamat satu kelas?","prompt":"Sumber referensi andalan menjelang ujian."},{"id":"quiz-panic","category":"QUIZ PANIC MODE","title":"Siapa yang paling ekspresif kalau tiba-tiba ada kuis dadakan?","prompt":"Reaksi pertamanya selalu lebih heboh daripada soalnya."},{"id":"task-negotiator","category":"THE TASK NEGOTIATOR","title":"Siapa yang paling jago mencari kata-kata saat ditanya, “Tugasnya sudah dikerjain belum?”","prompt":"Jawabannya selalu punya gaya diplomasi tersendiri."},{"id":"overthinking-delegate","category":"DUTA OVERTHINKING","title":"Siapa yang paling cocok jadi duta overthinking se-angkatan?","prompt":"Satu keputusan kecil bisa punya banyak skenario."},{"id":"exam-or-not","category":"THE EXAM DETECTOR","title":"Siapa yang paling sering bertanya, “Ini masuk ujian nggak?”","prompt":"Pertanyaan wajib sebelum materi lanjut ke slide berikutnya."},{"id":"seriousness-resistant","category":"ANTI-SERIOUS MODE","title":"Siapa yang paling susah diajak serius meskipun suasananya lagi tegang?","prompt":"Selalu punya cara menyelipkan humor di waktu yang tidak terduga."},{"id":"loading-screen","category":"LOADING SCREEN AWARD","title":"Siapa yang paling sering butuh waktu ekstra untuk memproses cerita?","prompt":"Bukan nggak paham—mungkin sedang memuat semua detail."},{"id":"action-movie-leader","category":"THE ACTION MOVIE LEADER","title":"Siapa yang paling cocok jadi ketua geng kalau kelas ini berubah jadi film action komedi?","prompt":"Aura pemimpinnya paling terasa, bahkan dalam situasi absurd."},{"id":"snack-stealth","category":"SECRET SNACK SOCIETY","title":"Siapa yang paling jago ngemil diam-diam di tengah jam pelajaran?","prompt":"Persediaan camilannya selalu punya tempat rahasia."},{"id":"mood-plot-twist","category":"MOOD PLOT TWIST","title":"Siapa yang perubahan mood-nya paling penuh plot twist dalam sehari?","prompt":"Dari kalem ke heboh, semuanya bisa terjadi."},{"id":"future-billionaire","category":"FUTURE BILLIONAIRE","title":"Siapa yang paling berpotensi tiba-tiba sukses lewat jalur yang nggak terduga?","prompt":"Suatu hari nanti, kita mungkin malah minta tanda tangan atau lowongan."},{"id":"prank-reaction","category":"THE REACTION CHAMPION","title":"Siapa yang reaksinya paling ikonik kalau kena keisengan receh teman-teman?","prompt":"Yang dinilai reaksinya yang lucu, bukan seberapa sering orang mengerjainya."},{"id":"sleepyhead","category":"DO NOT DISTURB","title":"Siapa yang paling susah dibangunkan saat tidur atau diajak kumpul?","prompt":"Butuh satu tim khusus untuk memastikan dia sudah siap."},{"id":"awkwardness-fixer","category":"THE ICE BREAKER","title":"Siapa yang paling jago mencairkan suasana saat kelas mulai canggung?","prompt":"Satu celetukan darinya bisa membuat semua orang santai lagi."},{"id":"mystery-bag","category":"MARY POPPINS BAG","title":"Siapa yang paling mungkin membawa barang aneh atau tidak terduga di tasnya?","prompt":"Isi tasnya seperti kotak kejutan."},{"id":"class-organizer","category":"THE EVENT COMMANDER","title":"Siapa yang paling cocok jadi event organizer karena paling sigap mengatur acara kelas?","prompt":"Checklist, rundown, dan grup koordinasi—semua ada."},{"id":"campus-updater","category":"THE CAMPUS NEWS DESK","title":"Siapa yang paling update soal kabar dan info terbaru di kampus?","prompt":"Selalu tahu info menarik, tanpa perlu jadi detektif."},{"id":"quietly-chaotic","category":"QUIET OUTSIDE, CHAOTIC INSIDE","title":"Siapa yang kelihatan paling kalem, tetapi paling barbar kalau sudah akrab?","prompt":"Mode publik dan mode circle dekatnya beda universe."},{"id":"terserah-protester","category":"TERSERAH BUT NOT REALLY","title":"Siapa yang paling sering bilang “terserah”, tetapi ternyata punya banyak preferensi?","prompt":"Katanya bebas, tetapi ada revisi kecil setelahnya."},{"id":"drama-queen-king","category":"THE DRAMA STAR","title":"Siapa yang paling ekspresif sampai cocok jadi bintang drama kolosal?","prompt":"Setiap cerita dibawakan dengan ekspresi maksimal."},{"id":"missing-presence","category":"THE CLASSROOM HEARTBEAT","title":"Siapa yang kalau nggak masuk sehari saja, kelas langsung terasa lebih sepi?","prompt":"Kehadirannya punya warna tersendiri buat suasana kelas."}];

const FUTURE_QUESTIONS = [{"id":"groupwork-savior","category":"GROUPWORK SAVIOR","title":"Siapa yang paling mungkin menyelamatkan kelompok saat semua orang mulai bingung?","prompt":"Datang dengan satu ide, lalu semuanya mulai bergerak."},{"id":"campus-gps","category":"CAMPUS GPS","title":"Siapa yang paling hafal jalan pintas dan spot tersembunyi di kampus?","prompt":"Kalau tersesat, orang pertama yang dicari adalah dia."},{"id":"slide-magician","category":"SLIDE MAGICIAN","title":"Siapa yang paling bisa mengubah slide biasa jadi presentasi yang niat banget?","prompt":"Tata letak, font, dan warna selalu diperhatikan."},{"id":"deadline-sprinter","category":"DEADLINE SPRINTER","title":"Siapa yang justru paling produktif ketika deadline sudah dekat?","prompt":"Mode fokusnya aktif saat hitung mundur dimulai."},{"id":"playlist-curator","category":"THE PLAYLIST CURATOR","title":"Siapa yang paling bisa menyiapkan lagu yang cocok untuk setiap suasana?","prompt":"Satu playlist darinya bisa jadi soundtrack satu angkatan."},{"id":"budget-survivor","category":"BUDGET SURVIVOR","title":"Siapa yang paling jago bertahan seharian dengan budget terbatas?","prompt":"Strategi pengeluaran dan pilihan tempat makannya patut dipelajari."},{"id":"instant-presenter","category":"BORN TO PRESENT","title":"Siapa yang paling siap maju presentasi bahkan tanpa persiapan panjang?","prompt":"Diberi topik sebentar, langsung bisa mulai bicara."},{"id":"class-photographer","category":"THE MEMORY KEEPER","title":"Siapa yang paling sering memastikan momen kelas terdokumentasi?","prompt":"Kalau bukan dia yang foto, siapa lagi yang menyimpan kenangan?"},{"id":"charger-hero","category":"CHARGER HERO","title":"Siapa yang paling sering jadi penyelamat saat ada yang kehabisan baterai?","prompt":"Kabel dan charger seperti selalu tersedia di dekatnya."},{"id":"menu-decider","category":"MENU DEBATE CHAMPION","title":"Siapa yang paling lama menentukan mau makan apa, tetapi paling semangat saat makanan datang?","prompt":"Proses memilihnya panjang, hasil akhirnya selalu dinanti."},{"id":"side-hustle-starter","category":"SIDE HUSTLE FOUNDER","title":"Siapa yang paling mungkin tiba-tiba punya ide bisnis baru?","prompt":"Hari ini ide kecil, besok sudah jadi konsep usaha."},{"id":"explain-like-im-five","category":"THE SIMPLE EXPLAINER","title":"Siapa yang paling jago menjelaskan materi rumit dengan bahasa sederhana?","prompt":"Setelah dia menjelaskan, akhirnya semuanya terasa masuk akal."},{"id":"human-reminder","category":"THE HUMAN REMINDER","title":"Siapa yang paling sering mengingatkan jadwal, deadline, atau barang yang tertinggal?","prompt":"Pengingat berjalan yang menjaga semuanya tetap on track."},{"id":"spontaneous-trip","category":"SPONTANEOUS TRIP STARTER","title":"Siapa yang paling mungkin mengajak jalan spontan setelah kelas selesai?","prompt":"Rencana lima menit bisa berubah jadi petualangan."},{"id":"class-podcast","category":"THE CLASS PODCASTER","title":"Siapa yang paling cocok punya podcast sendiri karena ceritanya selalu menarik?","prompt":"Topik sederhana pun bisa jadi obrolan panjang."},{"id":"lost-in-thought","category":"THOUGHTS IN ORBIT","title":"Siapa yang paling sering tiba-tiba melontarkan pertanyaan filosofis di tengah obrolan biasa?","prompt":"Obrolan ringan mendadak berubah jadi diskusi semesta."},{"id":"connector","category":"THE CONNECTOR","title":"Siapa yang paling mudah akrab dengan orang dari kelompok mana pun?","prompt":"Kenalan baru baginya seperti teman lama."},{"id":"backup-plan","category":"PLAN B SPECIALIST","title":"Siapa yang selalu punya rencana cadangan ketika sesuatu tidak berjalan sesuai rencana?","prompt":"Kalau rencana A gagal, dia sudah siap sampai rencana C."},{"id":"fashion-detail","category":"DETAIL SPOTTER","title":"Siapa yang paling peka melihat detail kecil yang sering dilewatkan orang lain?","prompt":"Perubahan kecil pun bisa langsung ketahuan."},{"id":"voice-note-podcast","category":"VOICE NOTE PODCAST","title":"Siapa yang paling sering mengirim voice note yang berubah jadi mini podcast?","prompt":"Niatnya menjawab sebentar, ternyata ada beberapa episode."},{"id":"class-mediator","category":"THE DIPLOMAT","title":"Siapa yang paling jago mencari jalan tengah saat pendapat kelompok berbeda?","prompt":"Bisa mendengar semua sisi tanpa membuat suasana makin panas."},{"id":"one-more-photo","category":"ONE MORE TAKE","title":"Siapa yang paling sering bilang “satu foto lagi” saat sesi foto kelas?","prompt":"Sesi foto belum selesai sebelum hasilnya terasa pas."},{"id":"micro-celebrity","category":"CAMPUS MICRO-CELEBRITY","title":"Siapa yang paling mungkin dikenal banyak orang lintas kelas?","prompt":"Baru jalan sebentar, sudah ada yang menyapa."},{"id":"unexpected-expert","category":"UNEXPECTED EXPERT","title":"Siapa yang paling sering punya pengetahuan mendalam tentang hal yang tidak disangka?","prompt":"Topiknya random, tetapi penjelasannya lengkap."},{"id":"group-chat-responder","category":"FASTEST REPLIER","title":"Siapa yang paling cepat merespons pesan penting di grup kelas?","prompt":"Belum sempat pesan tenggelam, dia sudah muncul."},{"id":"human-calculator","category":"HUMAN CALCULATOR","title":"Siapa yang paling sering menghitung total patungan sampai angka terakhir?","prompt":"Selisih seribu rupiah pun tidak akan terlewat."},{"id":"idea-to-action","category":"IDEA INTO ACTION","title":"Siapa yang paling jago mengubah ide random menjadi sesuatu yang benar-benar dilakukan?","prompt":"Bukan cuma wacana—ada eksekusinya."},{"id":"comfort-person","category":"THE COMFORT PERSON","title":"Siapa yang paling bisa membuat teman merasa diterima saat sedang nggak pede?","prompt":"Punya cara sederhana untuk membuat orang lain merasa dilibatkan."},{"id":"last-minute-finder","category":"THE LAST-MINUTE FINDER","title":"Siapa yang paling mungkin menemukan solusi ketika semua orang sudah kehabisan ide?","prompt":"Saat situasi buntu, dia melihat kemungkinan lain."},{"id":"future-mentor","category":"FUTURE MENTOR","title":"Siapa yang paling mungkin suatu hari kembali ke kampus untuk berbagi pengalaman suksesnya?","prompt":"Pengalaman dan ceritanya kelak bisa jadi inspirasi adik tingkat."}];

const LEGACY_QUESTIONS = [{"id":"ceo","category":"TODAY'S CEO","title":"Who would you trust to run the STELLARS universe?","prompt":"Pick the Star with the most CEO energy."},{"id":"chaos-mascot","category":"TODAY'S CHAOS MASCOT 🐒","title":"Who brings the most chaotic-but-fun energy to the crew?","prompt":"The honorary mascot award. Keep it playful."},{"id":"alien-buddy","category":"FIRST CONTACT","title":"Who would befriend an alien first?","prompt":"Who would make an intergalactic bestie in five minutes?"},{"id":"human-calendar","category":"HUMAN CALENDAR","title":"Who somehow remembers every deadline?","prompt":"The person who always knows what's due and when."},{"id":"plot-twist","category":"PLOT TWIST","title":"Who is most likely to have the wildest plot twist?","prompt":"A surprise storyline is coming. Who's starring?"},{"id":"travel-guide","category":"UNOFFICIAL TOUR GUIDE","title":"Who would accidentally become the tour guide?","prompt":"The one who somehow knows where everything is."},{"id":"snack-ambassador","category":"SNACK AMBASSADOR","title":"Who always knows where the snacks are?","prompt":"Every great team needs a snack specialist."},{"id":"idea-machine","category":"IDEA MACHINE","title":"Who has seventeen ideas before breakfast?","prompt":"Choose the person whose brain never stops brainstorming."},{"id":"main-character","category":"MAIN CHARACTER ENERGY","title":"Who gives the strongest main-character energy?","prompt":"The camera somehow always finds this Star."},{"id":"future-millionaire","category":"FUTURE BUSINESS LEGEND","title":"Who is most likely to build a business empire?","prompt":"One day, we might all be asking them for business advice."},{"id":"tech-support","category":"UNOFFICIAL TECH SUPPORT","title":"Who would become everyone's go-to tech support?","prompt":"The friend who can probably fix the projector and your Wi-Fi."},{"id":"event-planner","category":"LAST-MINUTE LEGEND","title":"Who could organize an event at the very last minute?","prompt":"Give them a checklist and somehow it all works out."},{"id":"adventure","category":"SAY-GAS AWARD","title":"Who would say 'gas' to the most random plan?","prompt":"Spontaneous plans are their natural habitat."},{"id":"peacekeeper","category":"PEACEKEEPER","title":"Who would calm down any group chaos?","prompt":"The steady Star who keeps the crew grounded."},{"id":"fashion-icon","category":"EVERYDAY ICON","title":"Who can turn an ordinary day into a photoshoot?","prompt":"A little style, a little confidence, a whole lot of presence."},{"id":"random-facts","category":"RANDOM FACTS CHAMPION","title":"Who knows the most oddly specific facts?","prompt":"Ask one question and get a whole documentary."},{"id":"comedian","category":"THE ROOM-LIGHTENER","title":"Who can make the whole room laugh?","prompt":"The person who always has the perfect punchline."},{"id":"night-owl","category":"NIGHT OWL","title":"Who is most likely to reply at 2 AM?","prompt":"Some Stars apparently run on a different timezone."},{"id":"meme-dealer","category":"MEME DEALER","title":"Who would send the perfect meme at the perfect time?","prompt":"A highly respected role in every group chat."},{"id":"secret-talent","category":"SECRET TALENT","title":"Who probably has a hidden talent nobody expects?","prompt":"The next surprise performance might come from them."},{"id":"group-chat","category":"GROUP CHAT MVP","title":"Who keeps the group chat alive?","prompt":"Every quiet group chat has one legendary rescuer."},{"id":"overthinker","category":"PROFESSIONAL OVERTHINKER","title":"Who considers every possible outcome before deciding?","prompt":"No decision is made without a full internal committee."},{"id":"mystery-box","category":"MYSTERY BOX","title":"Who is the hardest person to predict?","prompt":"Every day brings a new plotline."},{"id":"good-vibes","category":"GOOD-VIBES GENERATOR","title":"Who brings the most uplifting energy?","prompt":"The Star who makes an ordinary day feel better."}];

// Keep old IDs available so existing Firestore polls and votes remain readable.
const QUESTIONS = [...INITIAL_30_DAY_QUESTIONS, ...FUTURE_QUESTIONS, ...LEGACY_QUESTIONS];

const PULSE_QUESTION_LAUNCH_DAY = "2026-11-29";


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const el = {
    phase: document.getElementById("pulsePhase"),
    clock: document.getElementById("pulseClock"),
    date: document.getElementById("pulseDate"),
    panel: document.getElementById("pulsePanel"),
    status: document.getElementById("pulseStatus")
};

let currentUser = null;
let currentProfile = null;
let activeDayKey = getJakartaDayKey();
let activePoll = null;
let currentVotes = [];
let ownVote = null;
let votePending = false;
let pendingCandidateId = "";
let unsubscribePoll = null;
let unsubscribeVotes = null;
let creatingPollFor = "";
let currentPollError = "";

const PULSE_ALLOWED_ROLES = ["student", "admin", "superAdmin", "super_admin"];

function hasPulseAccess() {
    return Boolean(
        currentUser &&
        currentProfile?.isActive === true &&
        PULSE_ALLOWED_ROLES.includes(currentProfile.role)
    );
}

function slugify(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getJakartaParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getJakartaClock(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getJakartaDayKey(date = new Date()) {
    const parts = getJakartaParts(date);
    return parts.year + "-" + parts.month + "-" + parts.day;
}

function getJakartaMinuteOfDay(date = new Date()) {
    const parts = getJakartaClock(date);
    return Number(parts.hour) * 60 + Number(parts.minute);
}

function getPollPhase() {
    const minute = getJakartaMinuteOfDay();
    if (minute < OPEN_MINUTE) return "waiting";
    if (minute < CLOSE_MINUTE) return "open";
    return "closed";
}

function getNextBoundary() {
    const now = new Date();
    const parts = getJakartaParts(now);
    const targetMinute = getPollPhase() === "waiting" ? OPEN_MINUTE : CLOSE_MINUTE;
    const hour = Math.floor(targetMinute / 60);
    const minute = targetMinute % 60;
    return Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        hour - 7,
        minute,
        0
    );
}

function formatDate() {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date());
}

function makeSeededRandom(seedText) {
    let hash = 2166136261;
    for (let index = 0; index < seedText.length; index++) {
        hash ^= seedText.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return function () {
        hash += 0x6D2B79F5;
        let value = hash;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleWithRandom(items, random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const target = Math.floor(random() * (index + 1));
        [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
}

function getQuestionForDay(dayKey) {
    const [year, month, day] = String(dayKey).split("-").map(Number);
    const dateValue = Date.UTC(year, month - 1, day);
    const [launchYear, launchMonth, launchDay] = PULSE_QUESTION_LAUNCH_DAY.split("-").map(Number);
    const launchValue = Date.UTC(launchYear, launchMonth - 1, launchDay);
    const dayOffset = Math.floor((dateValue - launchValue) / 86400000);

    if (dayOffset >= 0 && dayOffset < INITIAL_30_DAY_QUESTIONS.length) {
        return INITIAL_30_DAY_QUESTIONS[dayOffset];
    }

    const futureOffset = Math.max(0, dayOffset - INITIAL_30_DAY_QUESTIONS.length);
    const cycle = Math.floor(futureOffset / FUTURE_QUESTIONS.length);
    const position = futureOffset % FUTURE_QUESTIONS.length;
    const random = makeSeededRandom("stellars-pulse-future-bank|" + cycle);
    return shuffleWithRandom(FUTURE_QUESTIONS, random)[position];
}

function generateDailyPoll(dayKey) {
    const selectedQuestion = getQuestionForDay(dayKey);
    const random = makeSeededRandom("stellars-pulse-members|" + dayKey);
    const shuffledMembers = shuffleWithRandom(ROSTER, random);
    return {
        questionId: selectedQuestion.id,
        candidateIds: shuffledMembers.slice(0, 4).map(member => member.id)
    };
}

function getQuestion(poll) {
    return QUESTIONS.find(question => question.id === poll?.questionId) || null;
}

function getCandidates(poll) {
    return (poll?.candidateIds || [])
        .map(id => ROSTER.find(member => member.id === id))
        .filter(Boolean);
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderGate(message) {
    el.panel.replaceChildren();
    const gate = makeElement("div", "pulse-gate");
    gate.append(
        makeElement("span", "pulse-gate-icon", "✦"),
        makeElement("strong", "", message),
        makeElement("p", "", currentUser
            ? "This account is not registered as an active STELLARS class member."
            : "Sign in with an active STELLARS class account to participate and see the class results.")
    );
    if (!currentUser) {
        const button = makeElement("button", "pulse-signin-button", "Sign in to STELLARS");
        button.type = "button";
        button.addEventListener("click", () => {
            window.location.assign("index.html?login=1");
        });
        gate.append(button);
    }
    el.panel.append(gate);
}

function renderWaiting() {
    el.panel.replaceChildren();
    const waiting = makeElement("div", "pulse-waiting");
    waiting.append(
        makeElement("span", "pulse-panel-kicker", "THE DAILY RANDOMIZER"),
        makeElement("h3", "", "Today's question is getting ready."),
        makeElement("p", "", "Four random classmates. One unexpected question. Voting opens at 09:30 WIB.")
    );
    const countdown = makeElement("div", "pulse-countdown-note", "The random picks will appear here when voting opens.");
    waiting.append(countdown);
    el.panel.append(waiting);
}

function renderNotStarted() {
    el.panel.replaceChildren();
    const state = makeElement("div", "pulse-waiting");
    state.append(
        makeElement("span", "pulse-panel-kicker", "TODAY'S PULSE"),
        makeElement("h3", "", "No poll was opened today."),
        makeElement("p", "", "The daily poll appears when an active member opens STELLARS during the 09:30–13:00 voting window. Check back tomorrow for a fresh random draw.")
    );
    el.panel.append(state);
}

function renderPollError() {
    el.panel.replaceChildren();
    const error = makeElement("div", "pulse-waiting pulse-error");
    error.append(
        makeElement("span", "pulse-panel-kicker", "POLL UNAVAILABLE"),
        makeElement("h3", "", "STELLARS Pulse couldn't load."),
        makeElement("p", "", currentPollError || "Refresh the page and try again. If this continues, the latest Firestore Rules may need to be deployed.")
    );
    el.panel.append(error);
}

function renderVoting(poll) {
    const question = getQuestion(poll);
    const candidates = getCandidates(poll);
    if (!question || candidates.length !== 4) {
        currentPollError = "The daily poll configuration is incomplete.";
        renderPollError();
        return;
    }

    el.panel.replaceChildren();

    const top = makeElement("div", "pulse-question-top");
    top.append(
        makeElement("span", "pulse-panel-kicker", question.category),
        makeElement("span", "pulse-open-pill", "VOTING OPEN")
    );

    const heading = makeElement("h3", "pulse-question-title", question.title);
    const prompt = makeElement("p", "pulse-question-prompt", question.prompt);

    const options = makeElement("div", "pulse-candidate-grid");
    const labels = ["A", "B", "C", "D"];

    candidates.forEach((candidate, index) => {
        const button = makeElement("button", "pulse-candidate-button");
        button.type = "button";
        button.disabled = !!ownVote || votePending;
        button.setAttribute("aria-label", "Vote for " + candidate.name);

        const letter = makeElement("span", "pulse-option-letter", labels[index]);
        const name = makeElement("strong", "pulse-option-name", candidate.name);
        const action = makeElement("span", "pulse-option-action", ownVote ? (ownVote.candidateId === candidate.id ? "YOUR VOTE" : "VOTING LOCKED") : (votePending ? (pendingCandidateId === candidate.id ? "SUBMITTING…" : "PLEASE WAIT") : "CAST VOTE"));
        button.append(letter, name, action);
        if (ownVote?.candidateId === candidate.id) button.classList.add("is-voted");
        if (ownVote || votePending) button.classList.add("is-disabled");

        button.addEventListener("click", () => castVote(candidate));
        options.append(button);
    });

    const note = ownVote
        ? "Your vote is locked in. The winner will be revealed after 13:00 WIB."
        : "Choose one classmate. You can vote once per day.";
    const foot = makeElement("p", "pulse-vote-footnote", note);

    el.panel.append(top, heading, prompt, options, foot);
}

function renderResults(poll) {
    const question = getQuestion(poll);
    const candidates = getCandidates(poll);
    if (!question || candidates.length !== 4) {
        renderPollError();
        return;
    }

    el.panel.replaceChildren();
    const tally = new Map(candidates.map(candidate => [candidate.id, 0]));
    currentVotes.forEach(vote => {
        if (tally.has(vote.candidateId)) {
            tally.set(vote.candidateId, tally.get(vote.candidateId) + 1);
        }
    });

    const totalVotes = [...tally.values()].reduce((sum, count) => sum + count, 0);
    const maxVotes = Math.max(0, ...tally.values());
    const winners = candidates.filter(candidate => maxVotes > 0 && tally.get(candidate.id) === maxVotes);

    const top = makeElement("div", "pulse-question-top");
    top.append(
        makeElement("span", "pulse-panel-kicker", question.category),
        makeElement("span", "pulse-closed-pill", "VOTING CLOSED")
    );
    const questionTitle = makeElement("h3", "pulse-question-title", question.title);
    const resultsLabel = makeElement("p", "pulse-question-prompt", totalVotes + " vote" + (totalVotes === 1 ? "" : "s") + " counted today.");

    if (totalVotes === 0) {
        const noVotes = makeElement("div", "pulse-no-winner");
        noVotes.append(
            makeElement("span", "pulse-winner-caption", "TODAY'S SPOTLIGHT"),
            makeElement("strong", "", "No votes today."),
            makeElement("p", "", "The next random question opens tomorrow at 09:30 WIB.")
        );
        el.panel.append(top, questionTitle, resultsLabel, noVotes);
        return;
    }

    const winnersWrap = makeElement("div", "pulse-winners-wrap");
    const winnerCaption = makeElement("span", "pulse-winner-caption", winners.length > 1 ? "TODAY'S TIED WINNERS" : "TODAY'S SPOTLIGHT");
    const winnerNames = makeElement("div", "pulse-winner-names");
    winners.forEach(winner => winnerNames.append(makeElement("strong", "", winner.name)));
    const winnerVotes = makeElement("span", "pulse-winner-votes", maxVotes + " vote" + (maxVotes === 1 ? "" : "s"));
    winnersWrap.append(winnerCaption, winnerNames, winnerVotes);

    const resultList = makeElement("div", "pulse-result-list");
    candidates
        .map((candidate, index) => ({candidate, count: tally.get(candidate.id), index}))
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .forEach(item => {
            const row = makeElement("div", "pulse-result-row");
            const label = makeElement("div", "pulse-result-label");
            label.append(
                makeElement("strong", "", item.candidate.name),
                makeElement("span", "", item.count + " vote" + (item.count === 1 ? "" : "s"))
            );
            const track = makeElement("div", "pulse-result-track");
            const bar = makeElement("span", "pulse-result-bar");
            bar.style.width = (totalVotes ? (item.count / totalVotes) * 100 : 0) + "%";
            track.append(bar);
            row.append(label, track);
            resultList.append(row);
        });

    el.panel.append(top, questionTitle, resultsLabel, winnersWrap, resultList);
}

function renderPulse() {
    if (!hasPulseAccess()) {
        el.phase.textContent = "CLASS MEMBERS ONLY";
        return renderGate(currentUser
            ? "STELLARS Pulse is locked for this account."
            : "STELLARS Pulse is for active class members.");
    }

    const phase = getPollPhase();
    const dateText = formatDate();
    el.date.textContent = dateText;

    if (phase === "waiting") {
        el.phase.textContent = "POLL OPENS AT";
        return renderWaiting();
    }

    if (phase === "open") {
        el.phase.textContent = "VOTING CLOSES IN";
        if (!activePoll) {
            const loading = makeElement("div", "pulse-waiting");
            loading.append(
                makeElement("span", "pulse-panel-kicker", "STELLARS / DAILY POLL"),
                makeElement("h3", "", "Drawing today's random options…"),
                makeElement("p", "", "The same four names and question will appear for everyone.")
            );
            el.panel.replaceChildren(loading);
            return;
        }
        return renderVoting(activePoll);
    }

    el.phase.textContent = "TODAY'S RESULT";
    if (!activePoll) return renderNotStarted();
    return renderResults(activePoll);
}

let lastUiPhase = "";

function updateClock() {
    const phase = getPollPhase();
    if (phase === "closed") {
        el.clock.textContent = "CLOSED";
    } else {
        const remaining = Math.max(0, getNextBoundary() - Date.now());
        const seconds = Math.floor(remaining / 1000);
        const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
        const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
        const secs = String(seconds % 60).padStart(2, "0");
        el.clock.textContent = hours + ":" + minutes + ":" + secs;
    }

    const dayKey = getJakartaDayKey();
    if (dayKey !== activeDayKey) {
        activeDayKey = dayKey;
        activePoll = null;
        currentVotes = [];
        ownVote = null;
        currentPollError = "";
        creatingPollFor = "";
        lastUiPhase = "";
        startPollListener();
    }

    if (phase !== lastUiPhase) {
        lastUiPhase = phase;
        if (activePoll && currentUser && hasPulseAccess() && voteListenerMode !== phase) {
            startVoteListener();
        }
        renderPulse();
    }

    if (phase === "open" && currentUser && hasPulseAccess() && !activePoll) {
        ensureDailyPoll();
    }
}

function stopVoteListener() {
    if (unsubscribeVotes) {
        unsubscribeVotes();
        unsubscribeVotes = null;
    }
    voteListenerMode = "";
}

let voteListenerMode = "";

function startVoteListener() {
    stopVoteListener();
    currentVotes = [];
    ownVote = null;

    if (!currentUser) return;

    const phase = getPollPhase();
    voteListenerMode = phase;

    if (phase === "open") {
        // During voting, each member can read only their own vote document.
        const ownVoteRef = doc(db, "pulseDays", activeDayKey, "votes", currentUser.uid);
        unsubscribeVotes = onSnapshot(ownVoteRef, snapshot => {
            if (snapshot.exists()) {
                ownVote = snapshot.data();
                votePending = false;
                pendingCandidateId = "";
            } else if (!votePending) {
                ownVote = null;
            }
            renderPulse();
        }, error => {
            console.error("STELLARS Pulse own-vote listener failed:", error);
            currentPollError = "Your vote status could not be read. Check the latest Pulse Firestore Rules.";
            renderPollError();
        });
        return;
    }

    if (phase === "closed") {
        // The full vote collection becomes readable only after 13:00 WIB.
        const votesRef = collection(db, "pulseDays", activeDayKey, "votes");
        unsubscribeVotes = onSnapshot(votesRef, snapshot => {
            currentVotes = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));
            ownVote = currentVotes.find(vote => vote.uid === currentUser.uid) || null;
            renderPulse();
        }, error => {
            console.error("STELLARS Pulse results listener failed:", error);
            currentPollError = "The results are still locked by server time. Refresh after 13:00 WIB.";
            renderPollError();
        });
    }
}

function startPollListener() {
    if (unsubscribePoll) {
        unsubscribePoll();
        unsubscribePoll = null;
    }
    stopVoteListener();
    activePoll = null;
    currentVotes = [];
    ownVote = null;

    if (!hasPulseAccess()) {
        renderPulse();
        return;
    }

    const pollRef = doc(db, "pulseDays", activeDayKey);
    unsubscribePoll = onSnapshot(pollRef, snapshot => {
        if (!snapshot.exists()) {
            activePoll = null;
            stopVoteListener();
            renderPulse();
            if (getPollPhase() === "open") ensureDailyPoll();
            return;
        }

        activePoll = {
            dayKey: snapshot.id,
            ...snapshot.data()
        };
        currentPollError = "";
        startVoteListener();
        renderPulse();
    }, error => {
        console.error("STELLARS Pulse poll listener failed:", error);
        currentPollError = "The poll could not be loaded. Deploy the latest Firestore Rules and refresh.";
        renderPollError();
    });
}

async function ensureDailyPoll() {
    if (creatingPollFor === activeDayKey || activePoll || getPollPhase() !== "open") return;
    creatingPollFor = activeDayKey;
    const dayKey = activeDayKey;
    const generated = generateDailyPoll(dayKey);
    const pollRef = doc(db, "pulseDays", dayKey);

    try {
        await runTransaction(db, async transaction => {
            const snapshot = await transaction.get(pollRef);
            if (!snapshot.exists()) {
                transaction.set(pollRef, {
                    dayKey,
                    questionId: generated.questionId,
                    candidateIds: generated.candidateIds,
                    createdAt: serverTimestamp()
                });
            }
        });
    } catch (error) {
        console.error("Could not initialize today's STELLARS Pulse:", error);
        currentPollError = error?.code === "permission-denied"
            ? "Voting is only open from 09:30 to 13:00 WIB. Make sure the latest Pulse Firestore Rules are deployed."
            : "Today's random poll could not be initialized. Refresh and try again.";
        renderPollError();
    } finally {
        creatingPollFor = "";
    }
}

async function castVote(candidate) {
    if (!hasPulseAccess() || !activePoll) return;
    if (getPollPhase() !== "open") {
        renderPulse();
        return;
    }
    if (ownVote || votePending) return;

    votePending = true;
    pendingCandidateId = candidate.id;
    renderPulse();

    const buttons = el.panel.querySelectorAll(".pulse-candidate-button");
    buttons.forEach(button => { button.disabled = true; });

    try {
        const voteRef = doc(db, "pulseDays", activeDayKey, "votes", currentUser.uid);
        await setDoc(voteRef, {
            uid: currentUser.uid,
            dayKey: activeDayKey,
            questionId: activePoll.questionId,
            candidateId: candidate.id,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        votePending = false;
        pendingCandidateId = "";
        console.error("Could not cast STELLARS Pulse vote:", error);
        currentPollError = error?.code === "permission-denied"
            ? "Your vote was not accepted. Voting is open from 09:30 to 13:00 WIB, and each account gets one vote."
            : "Your vote could not be saved. Please try again.";
        renderPollError();
    }
}

function handleAuthChange(user) {
    currentUser = user;
    currentProfile = null;
    currentPollError = "";

    if (unsubscribePoll) {
        unsubscribePoll();
        unsubscribePoll = null;
    }
    stopVoteListener();
    activePoll = null;
    currentVotes = [];
    ownVote = null;
    renderPulse();

    if (!user) {
        return;
    }

    getDoc(doc(db, "users", user.uid))
        .then(snapshot => {
            if (auth.currentUser?.uid !== user.uid) return;
            const profile = snapshot.exists() ? snapshot.data() : null;

            currentProfile = profile || null;
            if (!hasPulseAccess()) {
                renderPulse();
                return;
            }

            startPollListener();
        })
        .catch(error => {
            console.error("Could not verify STELLARS Pulse membership:", error);
            currentPollError = "Your STELLARS membership could not be verified.";
            renderPollError();
        });
}

onAuthStateChanged(auth, handleAuthChange);

function tick() {
    updateClock();
}

updateClock();
setInterval(tick, 1000);
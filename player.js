/* ============================================================
   TVPLAYER — PLAYER IPTV AUTOMÁTICO
   M3U dinâmica + EPG XMLTV GZIP + Grupos automáticos
   Dropdown fixo à direita com ícones coloridos
   Timeline EPG + próximos programas + rádios
   ============================================================ */

const M3U_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u";
const EPG_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/EPG/epg-m3upt.xml.gz";

let channels = [];
let groups = {};
let epgData = {};
let currentGroup = null;

/* ============================================================
   1) CARREGAR M3U
   ============================================================ */

async function loadM3U() {
    const res = await fetch(M3U_URL);
    const text = await res.text();
    parseM3U(text);
}

function parseM3U(text) {
    const lines = text.split("\n");
    let temp = {};

    for (let line of lines) {
        line = line.trim();

        if (line.startsWith("#EXTINF")) {
            const name = line.match(/,(.*)$/)?.[1] || "Sem nome";
            const logo = line.match(/tvg-logo="(.*?)"/)?.[1] || "";
            const group = line.match(/group-title="(.*?)"/)?.[1] || "Outros";
            const tvgid = line.match(/tvg-id="(.*?)"/)?.[1] || "";

            temp = { name, logo, group, tvgid };
        } else if (line.startsWith("http")) {
            temp.url = line;

            if (!groups[temp.group]) groups[temp.group] = [];
            groups[temp.group].push(temp);

            channels.push(temp);
            temp = {};
        }
    }
}

/* ============================================================
   2) CARREGAR EPG (XMLTV GZIP)
   ============================================================ */

async function loadEPG() {
    const res = await fetch(EPG_URL);
    const ds = new DecompressionStream("gzip");
    const decompressed = res.body.pipeThrough(ds);
    const text = await new Response(decompressed).text();

    parseEPG(text);
}

function parseEPG(xmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");

    const programmes = xml.getElementsByTagName("programme");

    for (let p of programmes) {
        const channel = p.getAttribute("channel");
        const start = p.getAttribute("start");
        const stop = p.getAttribute("stop");
        const title = p.getElementsByTagName("title")[0]?.textContent || "";
        const desc = p.getElementsByTagName("desc")[0]?.textContent || "";

        if (!epgData[channel]) epgData[channel] = [];
        epgData[channel].push({ start, stop, title, desc });
    }

    console.log("EPG carregado:", Object.keys(epgData).length, "canais");
}

/* ============================================================
   3) DROPDOWN DE GRUPOS (COM ÍCONES COLORIDOS)
   ============================================================ */

const groupIcons = {
    "Generalistas": "📺",
    "Notícias": "📰",
    "Desporto": "⚽",
    "Filmes & Séries": "🎬",
    "Música": "🎵",
    "Infantis": "👶",
    "Cultura": "📚",
    "Internacionais": "🌍",
    "Adultos": "🔞",
    "Rádios": "📻",
    "4K": "🖥️",
    "Outros": "📦"
};

function buildGroupDropdown() {
    const dropdown = document.getElementById("groupDropdown");

    dropdown.innerHTML = "";

    Object.keys(groups).forEach(group => {
        if (groups[group].length === 0) return;

        const option = document.createElement("option");
        option.value = group;
        option.textContent = `${groupIcons[group] || "📦"} ${group}`;
        dropdown.appendChild(option);
    });

    dropdown.onchange = () => {
        currentGroup = dropdown.value;
        buildChannelList();
    };

    currentGroup = dropdown.value;
}

/* ============================================================
   4) LISTA DE CANAIS
   ============================================================ */

function buildChannelList() {
    const list = document.getElementById("channel-list");
    list.innerHTML = "";

    const groupChannels = groups[currentGroup] || [];

    groupChannels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";

        div.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}">
            <div class="channel-name">${ch.name}</div>
        `;

        div.onclick = () => loadChannel(ch);

        list.appendChild(div);
    });
}

/* ============================================================
   5) CARREGAR CANAL (HLS + RÁDIOS)
   ============================================================ */

function loadChannel(ch) {
    const video = document.getElementById("videoPlayer");
    const radioOverlay = document.getElementById("radioOverlay");
    const radioLogo = document.getElementById("radioLogo");

    const isRadio = ch.group.toLowerCase().includes("rádio") ||
                    ch.group.toLowerCase().includes("radio") ||
                    ch.url.endsWith(".mp3") ||
                    ch.url.endsWith(".aac") ||
                    ch.url.endsWith(".ogg");

    if (isRadio) {
        video.style.display = "none";
        radioOverlay.style.display = "flex";

        if (ch.logo && ch.logo.trim() !== "") {
            radioLogo.src = ch.logo;
            radioLogo.classList.remove("no-logo");
        } else {
            radioLogo.src = "";
            radioLogo.classList.add("no-logo");
        }
    } else {
        radioOverlay.style.display = "none";
        video.style.display = "block";

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(ch.url);
            hls.attachMedia(video);
        } else {
            video.src = ch.url;
        }
    }

    loadEPGForChannel(ch);
}

/* ============================================================
   6) EPG DO CANAL ATUAL + TIMELINE + PRÓXIMOS
   ============================================================ */

function loadEPGForChannel(ch) {
    const epgBox = document.getElementById("epg");
    const timeline = document.getElementById("epgTimeline");
    const nextBox = document.getElementById("epgNext");

    if (timeline) timeline.innerHTML = "";
    if (nextBox) nextBox.innerHTML = "";

    let channelEPG = [];

    // 1) Tenta pelo tvg-id
    if (ch.tvgid && epgData[ch.tvgid]) {
        channelEPG = epgData[ch.tvgid];
    }

    // 2) Fallback por nome aproximado
    if (channelEPG.length === 0) {
        const key = Object.keys(epgData).find(k =>
            k.toLowerCase().includes(ch.name.toLowerCase())
        );
        if (key) channelEPG = epgData[key];
    }

    if (channelEPG.length === 0) {
        epgBox.innerHTML = "Sem EPG disponível";
        return;
    }

    const now = Date.now();

    // Programa atual
    const current = channelEPG.find(p => {
        const start = parseEPGDate(p.start);
        const stop = parseEPGDate(p.stop);
        return now >= start && now <= stop;
    });

    if (!current) {
        epgBox.innerHTML = "Sem programa atual";
        return;
    }

    const start = parseEPGDate(current.start);
    const stop = parseEPGDate(current.stop);
    const progress = ((now - start) / (stop - start)) * 100;

    epgBox.innerHTML = `
        <strong>${current.title}</strong><br>
        ${current.desc}<br>
        <div class="epg-progress">
            <div class="epg-progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div>
        </div>
    `;

    /* ===========================
       TIMELINE HORIZONTAL
       =========================== */

    if (timeline) {
        channelEPG.forEach(p => {
            const s = parseEPGDate(p.start);
            const e = parseEPGDate(p.stop);

            const block = document.createElement("div");
            block.className = "epg-block";

            block.innerHTML = `
                <div class="epg-block-title">${p.title}</div>
                <div>${new Date(s).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                 - ${new Date(e).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
            `;

            if (now >= s && now <= e) {
                const pct = ((now - s) / (e - s)) * 100;
                block.innerHTML += `
                    <div class="epg-progress">
                        <div class="epg-progress-bar" style="width:${Math.max(0, Math.min(100, pct))}%"></div>
                    </div>
                `;
            }

            timeline.appendChild(block);
        });
    }

    /* ===========================
       PRÓXIMOS PROGRAMAS
       =========================== */

    if (nextBox) {
        const next = channelEPG
            .filter(p => parseEPGDate(p.start) > now)
            .slice(0, 5);

        next.forEach(p => {
            const s = parseEPGDate(p.start);
            const e = parseEPGDate(p.stop);

            const div = document.createElement("div");
            div.innerHTML = `
                <strong>${p.title}</strong><br>
                ${new Date(s).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                - ${new Date(e).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            `;
            nextBox.appendChild(div);
        });
    }
}

/* ============================================================
   7) PARSE DE DATA DO EPG
   ============================================================ */

function parseEPGDate(str) {
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    const d = str.substring(6, 8);
    const hh = str.substring(8, 10);
    const mm = str.substring(10, 12);
    const ss = str.substring(12, 14);

    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`).getTime();
}

/* ============================================================
   8) INICIAR TUDO
   ============================================================ */

(async () => {
    await loadM3U();
    await loadEPG();
    buildGroupDropdown();
    buildChannelList();
})();
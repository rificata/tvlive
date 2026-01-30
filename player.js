/* ============================================================
   VIBE.PT — PLAYER IPTV AUTOMÁTICO
   M3U dinâmica + EPG XMLTV GZIP + Subcategorias dentro de "TV"
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

            temp = { name, logo, group };
        }

        else if (line.startsWith("http")) {
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
}

/* ============================================================
   3) ÍCONES DAS SUBCATEGORIAS
   ============================================================ */

const categoryIcons = {
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

/* Ordem fixa */
const categoryOrder = [
    "Generalistas",
    "Notícias",
    "Desporto",
    "Filmes & Séries",
    "Música",
    "Infantis",
    "Cultura",
    "Internacionais",
    "Rádios",
    "Adultos",
    "4K",
    "Outros"
];

/* ============================================================
   4) DROPDOWN DE GRUPOS
   ============================================================ */

function buildGroupDropdown() {
    const dropdown = document.getElementById("groupDropdown");

    dropdown.innerHTML = "";

    Object.keys(groups).forEach(group => {
        if (groups[group].length === 0) return;

        const option = document.createElement("option");
        option.value = group;
        option.textContent = group;
        dropdown.appendChild(option);
    });

    dropdown.onchange = () => {
        currentGroup = dropdown.value;
        buildChannelList();
    };

    currentGroup = dropdown.value;
}

/* ============================================================
   5) LISTA DE CANAIS COM SUBCATEGORIAS
   ============================================================ */

function buildChannelList() {
    const list = document.getElementById("channel-list");
    list.innerHTML = "";

    const groupChannels = groups[currentGroup] || [];

    if (currentGroup === "TV") {
        const categories = {};

        groupChannels.forEach(ch => {
            const cat = ch.group || "Outros";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(ch);
        });

        categoryOrder.forEach(cat => {
            if (!categories[cat]) return;

            const header = document.createElement("div");
            header.className = "category-header";
            header.innerHTML = `
                <div class="category-title">${categoryIcons[cat] || "📦"} ${cat}</div>
                <div class="category-line"></div>
            `;
            list.appendChild(header);

            categories[cat].forEach(ch => {
                const div = document.createElement("div");
                div.className = "channel";

                div.innerHTML = `
                    <img src="${ch.logo}" alt="${ch.name}">
                    <div class="channel-name">${ch.name}</div>
                `;

                div.onclick = () => loadChannel(ch);

                list.appendChild(div);
            });
        });

        return;
    }

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
   6) CARREGAR CANAL
   ============================================================ */

function loadChannel(ch) {
    const video = document.getElementById("videoPlayer");

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(ch.url);
        hls.attachMedia(video);
    } else {
        video.src = ch.url;
    }

    loadEPGForChannel(ch);
}

/* ============================================================
   7) EPG DO CANAL
   ============================================================ */

function loadEPGForChannel(ch) {
    const epgBox = document.getElementById("epg");

    const channelEPG = epgData[ch.name] || epgData[ch.tvgid] || [];

    if (channelEPG.length === 0) {
        epgBox.innerHTML = "Sem EPG disponível";
        return;
    }

    const now = Date.now();

    const current = channelEPG.find(p => {
        const start = parseEPGDate(p.start);
        const stop = parseEPGDate(p.stop);
        return now >= start && now <= stop;
    });

    if (!current) {
        epgBox.innerHTML = "Sem programa atual";
        return;
    }

    epgBox.innerHTML = `
        <strong>${current.title}</strong><br>
        ${current.desc}
    `;
}

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
   8) INICIAR
   ============================================================ */

(async () => {
    await loadM3U();
    await loadEPG();
    buildGroupDropdown();
    buildChannelList();
})();

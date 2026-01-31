/* ============================================================
   PLAYER IPTV — BASE LIMPA E MODULAR
   ============================================================ */

const M3U_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u";
const EPG_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/EPG/epg-m3upt.xml.gz";

let channels = [];
let groups = {};
let epgData = {};
let currentGroup = null;
let currentIndex = 0;

/* ============================
   CARREGAR M3U
   ============================ */

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

/* ============================
   CARREGAR EPG
   ============================ */

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

/* ============================
   BARRA FIXA: CATEGORIAS + CANAIS
   ============================ */

function buildTopBar() {
    const select = document.getElementById("categorySelect");

    Object.keys(groups).forEach(group => {
        const opt = document.createElement("option");
        opt.value = group;
        opt.textContent = group;
        select.appendChild(opt);
    });

    select.onchange = () => {
        currentGroup = select.value;
        currentIndex = 0;
        buildChannelScroller();
        const ch = groups[currentGroup][currentIndex];
        loadChannel(ch);
    };

    currentGroup = select.value;
    buildChannelScroller();

    // Carregar primeiro canal do grupo inicial
    const firstChannel = groups[currentGroup][0];
    loadChannel(firstChannel);
}

function buildChannelScroller() {
    const scroller = document.getElementById("channelScroller");
    scroller.innerHTML = "";

    const groupChannels = groups[currentGroup];

    groupChannels.forEach((ch, i) => {
        const div = document.createElement("div");
        div.className = "channelItem";

        div.innerHTML = `
            <img src="${ch.logo}" alt="">
            <span>${ch.name}</span>
        `;

        div.onclick = () => {
            currentIndex = i;
            loadChannel(ch);
        };

        scroller.appendChild(div);

        if (i < groupChannels.length - 1) {
            const sep = document.createElement("span");
            sep.className = "separator";
            sep.textContent = "|";
            scroller.appendChild(sep);
        }
    });
}

/* ============================
   PLAYER
   ============================ */

function loadChannel(ch) {
    const video = document.getElementById("videoPlayer");
    const logo = document.getElementById("playerLogo");
    const name = document.getElementById("playerName");

    video.pause();
    video.src = "";

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(ch.url);
        hls.attachMedia(video);
    } else {
        video.src = ch.url;
    }

    logo.src = ch.logo || "";
    name.textContent = ch.name || "";

    loadEPGForChannel(ch);
}

/* ============================
   EPG: PROGRAMA ATUAL + CARTÕES
   ============================ */

function loadEPGForChannel(ch) {
    const title = document.getElementById("epgTitle");
    const desc = document.getElementById("epgDesc");
    const list = document.getElementById("epgList");
    const progressBar = document.getElementById("playerProgressBar");

    title.textContent = "";
    desc.textContent = "";
    list.innerHTML = "";
    progressBar.style.width = "0%";

    let channelEPG = [];

    if (ch.tvgid && epgData[ch.tvgid]) {
        channelEPG = epgData[ch.tvgid];
    } else {
        // fallback: tentar por nome
        const key = Object.keys(epgData).find(k =>
            k.toLowerCase().includes(ch.name.toLowerCase())
        );
        if (key) channelEPG = epgData[key];
    }

    if (channelEPG.length === 0) {
        title.textContent = "Sem EPG disponível";
        return;
    }

    const now = Date.now();

    // Programa atual
    const current = channelEPG.find(p => {
        const s = parseEPGDate(p.start);
        const e = parseEPGDate(p.stop);
        return now >= s && now <= e;
    });

    if (current) {
        const s = parseEPGDate(current.start);
        const e = parseEPGDate(current.stop);
        const pct = ((now - s) / (e - s)) * 100;

        title.textContent = current.title;
        desc.textContent = current.desc || "";
        progressBar.style.width = Math.min(Math.max(pct, 0), 100) + "%";
    } else {
        title.textContent = "Sem programa atual";
        desc.textContent = "";
    }

    // Programação completa (cartões)
    channelEPG.forEach(p => {
        const s = parseEPGDate(p.start);
        const e = parseEPGDate(p.stop);

        const card = document.createElement("div");
        card.className = "epgCard";

        card.innerHTML = `
            <span class="epgTime">
                ${new Date(s).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                -
                ${new Date(e).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            </span>

            <strong>${p.title}</strong><br>

            <span>${p.desc || ""}</span>
        `;

        list.appendChild(card);
    });
}

/* ============================
   PARSE DATA EPG
   ============================ */

function parseEPGDate(str) {
    return new Date(
        `${str.substring(0,4)}-${str.substring(4,6)}-${str.substring(6,8)}T${str.substring(8,10)}:${str.substring(10,12)}:${str.substring(12,14)}`
    ).getTime();
}

/* ============================
   ZAPPING (ANTERIOR / SEGUINTE)
   ============================ */

document.getElementById("prevBtn").onclick = () => zap(-1);
document.getElementById("nextBtn").onclick = () => zap(1);

function zap(dir) {
    const groupChannels = groups[currentGroup];
    currentIndex = (currentIndex + dir + groupChannels.length) % groupChannels.length;
    const ch = groupChannels[currentIndex];
    loadChannel(ch);
}

/* ============================
   INICIAR
   ============================ */

(async () => {
    await loadM3U();
    await loadEPG();
    buildTopBar();
})();
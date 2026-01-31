/* ============================================================
   PLAYER IPTV ULTRA PREMIUM — C2‑A (Dark Glass)
   ============================================================ */

const M3U_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u";
const EPG_URL = "https://raw.githubusercontent.com/LITUATUI/M3UPT/main/EPG/epg-m3upt.xml.gz";

let channels = [];
let groups = {};
let epgData = {};
let currentGroup = null;
let currentIndex = 0;

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
   2) CARREGAR EPG
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
   3) DROPDOWN DE GRUPOS
   ============================================================ */

function buildGroupDropdown() {
    const dropdown = document.getElementById("groupDropdown");

    dropdown.innerHTML = "";

    Object.keys(groups).forEach(group => {
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
   4) LISTA DE CANAIS
   ============================================================ */

function buildChannelList() {
    const list = document.getElementById("channel-list");
    list.innerHTML = "";

    const groupChannels = groups[currentGroup] || [];

    groupChannels.forEach((ch, i) => {
        const div = document.createElement("div");
        div.className = "channel";

        div.innerHTML = `
            <img src="${ch.logo}">
            <div class="channel-name">${ch.name}</div>
        `;

        div.onclick = () => {
            currentIndex = i;
            loadChannel(ch);
        };

        list.appendChild(div);
    });
}

/* ============================================================
   5) CARREGAR CANAL
   ============================================================ */

function loadChannel(ch) {
    const video = document.getElementById("videoPlayer");
    const logoOverlay = document.getElementById("channelLogoOverlay");
    const infoOverlay = document.getElementById("channelInfoOverlay");

    video.pause();
    video.src = "";

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(ch.url);
        hls.attachMedia(video);
    } else {
        video.src = ch.url;
    }

    logoOverlay.src = ch.logo || "";
    infoOverlay.innerHTML = `${ch.name}`;

    loadEPGForChannel(ch);
}

/* ============================================================
   6) MINI‑EPG + TIMELINE + PRÓXIMOS
   ============================================================ */

function loadEPGForChannel(ch) {
    const mini = document.getElementById("miniEPG");
    const timeline = document.getElementById("epgTimeline");
    const nextBox = document.getElementById("epgNext");

    mini.innerHTML = "";
    timeline.innerHTML = "";
    nextBox.innerHTML = "";

    let channelEPG = [];

    if (ch.tvgid && epgData[ch.tvgid]) channelEPG = epgData[ch.tvgid];

    if (channelEPG.length === 0) {
        const key = Object.keys(epgData).find(k =>
            k.toLowerCase().includes(ch.name.toLowerCase())
        );
        if (key) channelEPG = epgData[key];
    }

    if (channelEPG.length === 0) {
        mini.innerHTML = "Sem EPG disponível";
        return;
    }

    const now = Date.now();

    const current = channelEPG.find(p => {
        const s = parseEPGDate(p.start);
        const e = parseEPGDate(p.stop);
        return now >= s && now <= e;
    });

    if (!current) {
        mini.innerHTML = "Sem programa atual";
        return;
    }

    const s = parseEPGDate(current.start);
    const e = parseEPGDate(current.stop);
    const pct = ((now - s) / (e - s)) * 100;

    document.getElementById("progressBar").style.width = pct + "%";

    mini.innerHTML = `
        <strong>${current.title}</strong><br>
        ${current.desc}
    `;

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

        timeline.appendChild(block);
    });

    const next = channelEPG.filter(p => parseEPGDate(p.start) > now).slice(0, 5);

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

/* ============================================================
   7) PARSE DE DATA
   ============================================================ */

function parseEPGDate(str) {
    return new Date(
        `${str.substring(0,4)}-${str.substring(4,6)}-${str.substring(6,8)}T${str.substring(8,10)}:${str.substring(10,12)}:${str.substring(12,14)}`
    ).getTime();
}

/* ============================================================
   8) ZAPPING
   ============================================================ */

document.getElementById("btnPrev").onclick = () => zap(-1);
document.getElementById("btnNext").onclick = () => zap(1);

function zap(dir) {
    const groupChannels = groups[currentGroup];
    currentIndex = (currentIndex + dir + groupChannels.length) % groupChannels.length;
    loadChannel(groupChannels[currentIndex]);
}

/* ============================================================
   9) INICIAR
   ============================================================ */

(async () => {
    await loadM3U();
    await loadEPG();
    buildGroupDropdown();
    buildChannelList();
})();

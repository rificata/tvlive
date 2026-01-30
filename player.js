window.onload = () => {
    const list = document.getElementById("channel-list");
    const container = document.getElementById("player-area");

    let currentHLS = null; // instância ativa do HLS.js

    // ============================
    // FUNÇÃO: Obter programa atual do EPG
    // ============================
    function getCurrentProgram(channelName) {
        if (!epg[channelName]) return "Sem informação disponível";

        const now = new Date();

        for (const prog of epg[channelName]) {
            const start = new Date(prog.start.replace(" +0000", "Z"));
            const stop = new Date(prog.stop.replace(" +0000", "Z"));

            if (now >= start && now <= stop) {
                return prog.title;
            }
        }

        return "Sem programação neste momento";
    }

    // ============================
    // FUNÇÃO: Carregar stream HLS (.m3u8)
    // ============================
    function loadHLS(url, div) {
        unloadYouTube(); // garantir que não há iframe ativo

        const video = document.getElementById("tv-player");

        // Remover destaque anterior
        document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
        if (div) div.classList.add("active");

        // Atualizar EPG
        document.getElementById("epg-now").innerText =
            getCurrentProgram(div.dataset.name);

        // Destruir instância anterior
        if (currentHLS) {
            currentHLS.destroy();
            currentHLS = null;
        }

        if (Hls.isSupported()) {
            currentHLS = new Hls({
                maxBufferLength: 10,
                liveSyncDuration: 3,
                enableWorker: true
            });

            currentHLS.loadSource(url);
            currentHLS.attachMedia(video);

            video.play().catch(() => {});
        } else {
            // Safari
            video.src = url;
            video.play().catch(() => {});
        }
    }

    // ============================
    // FUNÇÃO: Carregar YouTube
    // ============================
    function loadYouTube(embedUrl, div) {
        // Remover destaque anterior
        document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
        if (div) div.classList.add("active");

        // Atualizar EPG
        document.getElementById("epg-now").innerText =
            getCurrentProgram(div.dataset.name);

        container.innerHTML = `
            <iframe id="yt-frame"
                src="${embedUrl}"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen>
            </iframe>
        `;
    }

    // ============================
    // FUNÇÃO: Voltar ao player normal
    // ============================
    function unloadYouTube() {
        container.innerHTML = `<video id="tv-player" controls autoplay></video>`;
    }

    // ============================
    // CRIAR LISTA DE CANAIS
    // ============================
    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        div.dataset.name = ch.name;

        div.innerHTML = `
            <img src="${ch.logo}" alt="${ch.name}">
            <div class="channel-name">${ch.name}</div>
        `;

        div.onclick = () => {
            if (ch.type === "youtube") {
                loadYouTube(ch.url, div);
            } else {
                loadHLS(ch.url, div);
            }
        };

        list.appendChild(div);
    });

    // ============================
    // CARREGAR AUTOMATICAMENTE O PRIMEIRO CANAL
    // ============================
    if (channels.length > 0) {
        const first = channels[0];
        const firstDiv = document.querySelector(".channel");

        if (first.type === "youtube") {
            loadYouTube(first.url, firstDiv);
        } else {
            loadHLS(first.url, firstDiv);
        }
    }
};
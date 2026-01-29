window.onload = () => {
    const player = document.getElementById("tv-player");

    // Carregar o primeiro canal automaticamente
    if (channels.length > 0) {
        if (channels[0].type === "youtube") {
            loadYouTube(channels[0].url);
        } else {
            player.src = channels[0].url;
            player.play();
        }
    }

    const list = document.getElementById("channel-list");

    channels.forEach(ch => {
        const div = document.createElement("div");
        div.className = "channel";
        div.dataset.name = ch.name;

        div.innerHTML = `<img src="${ch.logo}" alt="${ch.name}">`;

div.onclick = () => {
    if (ch.type === "youtube") {
        loadYouTube(ch.url);
        return;
    }

    unloadYouTube();

    const video = document.getElementById("tv-player");

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(ch.url);
        hls.attachMedia(video);
        video.play();
    } else {
        // fallback para Safari
        video.src = ch.url;
        video.play();
    }
};


        list.appendChild(div);
    });
};

// Função para carregar YouTube no player
function loadYouTube(embedUrl) {
    const container = document.getElementById("player-area");
    container.innerHTML = `<iframe id="yt-frame" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
}

// Voltar ao player normal
function unloadYouTube() {
    const container = document.getElementById("player-area");
    container.innerHTML = `<video id="tv-player" controls autoplay></video>`;
}

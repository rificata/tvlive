window.onload = () => {
    const player = document.getElementById("tv-player");

    // Carregar o primeiro canal automaticamente
    if (channels.length > 0) {
        player.src = channels[0].url;
        player.play();
    }
};

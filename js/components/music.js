// Nhạc nền từ YouTube — YouTube IFrame API, ẩn iframe
import { $, toast } from '../core/utils.js';

let player = null;
let on = false;
let ready = false;
const YT_ID = 'v-92I1wtJV4';

function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
}

function createPlayer() {
  const div = document.createElement('div');
  div.id = 'yt-music-player';
  div.style.cssText = 'position:fixed;bottom:-999px;left:-999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
  document.body.appendChild(div);

  player = new YT.Player('yt-music-player', {
    videoId: YT_ID,
    playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: YT_ID, volume: 30 },
    events: {
      onReady: () => { ready = true; },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) player.seekTo(0, true);
      }
    }
  });
}

export function initMusic() {
  const mount = () => {
    const btn = $('#music-fab');
    if (!btn || btn.dataset.ready) return;
    btn.style.display = '';
    btn.innerHTML = '<i class="fa-solid fa-music"></i>';
    btn.title = 'Nhạc nền thư giãn';
    btn.dataset.ready = '1';

    btn.addEventListener('click', async () => {
      on = !on;
      btn.classList.toggle('on', on);

      if (on) {
        if (!player) {
          toast('Đang tải nhạc...', 'info');
          await loadYT();
          createPlayer();
          await new Promise(r => setTimeout(r, 1500));
        }
        if (ready) {
          player.unMute();
          player.setVolume(30);
          player.playVideo();
          toast('Đã bật nhạc nền ♪');
        }
      } else {
        if (player) { player.pauseVideo(); player.mute(); }
        toast('Đã tắt nhạc nền');
      }
    });
  };

  mount();
  window.addEventListener('fabstack:ready', mount);
}

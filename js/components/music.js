// Nhạc nền lo-fi nhẹ bằng WebAudio (không cần file mp3)
import { $, toast } from '../core/utils.js';

let ctx = null;
let nodes = [];
let on = false;

// hợp âm Am7 - Fmaj7 nhẹ nhàng, loop bằng scheduler đơn giản
const CHORDS = [
  [220.00, 261.63, 329.63], // A3 C4 E4
  [174.61, 220.00, 261.63], // F3 A3 C4
  [196.00, 246.94, 293.66], // G3 B3 D4
  [164.81, 207.65, 246.94]  // E3 G#3 B3
];

function start() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 2);

  let chordIdx = 0;
  const playChord = () => {
    if (!on) return;
    CHORDS[chordIdx % CHORDS.length].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() * 8) - 4;
      g.gain.value = 0.35 / (i + 1);
      osc.connect(g).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 7.6);
    });
    chordIdx++;
  };
  playChord();
  nodes.push(master, setInterval(playChord, 8000));
}

function stop() {
  const [master, interval] = nodes;
  clearInterval(interval);
  if (master && ctx) {
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    setTimeout(() => master.disconnect(), 900);
  }
  nodes = [];
}

export function initMusic() {
  const mount = () => {
    const stack = document.querySelector('.fab-stack');
    const btn = $('#music-fab');
    if (!stack || !btn || btn.dataset.ready) return;
    btn.style.display = '';
    btn.innerHTML = '<i class="fa-solid fa-music"></i>';
    btn.title = 'Nhạc nền thư giãn';
    btn.dataset.ready = '1';

    btn.addEventListener('click', () => {
      on = !on;
      btn.classList.toggle('on', on);
      if (on) { start(); toast('Đã bật nhạc nền thư giãn ♪'); }
      else { stop(); toast('Đã tắt nhạc nền'); }
    });
  };

  mount();
  window.addEventListener('fabstack:ready', mount);
}

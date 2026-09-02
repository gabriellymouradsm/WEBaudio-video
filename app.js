// Global State & Audio Context setup
let audioCtx = null;
let mediaElement = null;
let mediaSource = null;
let analyserNode = null;
let mainGainNode = null;

// Frequency Generator State
let toneOscillator = null;
let toneGainNode = null;
let isToneActive = false;
let toneFrequency = 432;
let toneVolume = 0.3;
let toneWaveType = 'sine';

// App State
let loadedFile = null;
let mediaType = 'audio'; // 'audio' or 'video'
let animationFrameId = null;
let visualizerMode = 'bars'; // 'bars', 'waveform', 'circle'

// DOM Elements
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const uploadSection = document.getElementById('upload-section');
const mediaSection = document.getElementById('media-section');
const fileNameDisplay = document.getElementById('file-name');
const btnChangeFile = document.getElementById('btn-change-file');

const audioEl = document.getElementById('audio-element');
const videoEl = document.getElementById('video-element');
const canvas = document.getElementById('spectrum-canvas');
const canvasCtx = canvas.getContext('2d');
const visualizerPlaceholder = document.getElementById('visualizer-placeholder');

const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const playBtnText = document.getElementById('play-btn-text');

const seekBar = document.getElementById('seek-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');

const btnMute = document.getElementById('btn-mute');
const iconVolume = document.getElementById('icon-volume');
const volumeBar = document.getElementById('volume-bar');

const visualizerModeSelect = document.getElementById('visualizer-mode');

// Therapy Controls
const toggleFrequency = document.getElementById('toggle-frequency');
const presetBtns = document.querySelectorAll('.preset-btn');
const customFreqInput = document.getElementById('custom-freq-input');
const freqSlider = document.getElementById('freq-slider');
const freqVolumeSlider = document.getElementById('freq-volume');
const freqVolValue = document.getElementById('freq-vol-value');
const waveTypeSelect = document.getElementById('wave-type-select');

// Export Controls
const btnExportAudio = document.getElementById('btn-export-audio');
const exportStatus = document.getElementById('export-status');
const exportSpinner = document.getElementById('export-spinner');
const exportStatusText = document.getElementById('export-status-text');

// Initialize Web Audio Context on user interaction
function initAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtx();

    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256; // 128 frequency bins
    analyserNode.smoothingTimeConstant = 0.8;

    mainGainNode = audioCtx.createGain();
    mainGainNode.gain.value = parseFloat(volumeBar.value);

    analyserNode.connect(mainGainNode);
    mainGainNode.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Attach source to Web Audio pipeline
function connectMediaSource(element) {
  if (mediaSource) {
    try {
      mediaSource.disconnect();
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
  }
  mediaSource = audioCtx.createMediaElementSource(element);
  mediaSource.connect(analyserNode);
}

/* File Input Handling */
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelect(e.target.files[0]);
  }
});

btnChangeFile.addEventListener('click', () => {
  pauseMedia();
  uploadSection.classList.remove('hidden');
  mediaSection.classList.add('hidden');
  fileInput.value = '';
});

// Drag & Drop
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
  }, false);
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt.files && dt.files[0]) {
    handleFileSelect(dt.files[0]);
  }
});

function handleFileSelect(file) {
  loadedFile = file;
  fileNameDisplay.textContent = file.name;

  const objectURL = URL.createObjectURL(file);
  mediaType = file.type.startsWith('video') ? 'video' : 'audio';

  uploadSection.classList.add('hidden');
  mediaSection.classList.remove('hidden');

  if (mediaType === 'video') {
    videoEl.classList.remove('hidden');
    videoEl.src = objectURL;
    mediaElement = videoEl;
    audioEl.src = '';
  } else {
    videoEl.classList.add('hidden');
    videoEl.src = '';
    audioEl.src = objectURL;
    mediaElement = audioEl;
  }

  // Media event listeners
  mediaElement.onloadedmetadata = () => {
    timeTotal.textContent = formatTime(mediaElement.duration);
    seekBar.value = 0;
  };

  mediaElement.ontimeupdate = () => {
    if (mediaElement.duration) {
      seekBar.value = (mediaElement.currentTime / mediaElement.duration) * 100;
      timeCurrent.textContent = formatTime(mediaElement.currentTime);
    }
  };

  mediaElement.onended = () => {
    setPlayState(false);
    stopVisualizer();
  };

  visualizerPlaceholder.classList.remove('hidden');
  resizeCanvas();
}

function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth * window.devicePixelRatio || container.clientWidth;
  canvas.height = container.clientHeight * window.devicePixelRatio || container.clientHeight;
}

window.addEventListener('resize', resizeCanvas);

/* Play / Pause Controls */
btnPlayPause.addEventListener('click', togglePlay);

function togglePlay() {
  if (!mediaElement) return;

  initAudioContext();

  if (!mediaSource) {
    connectMediaSource(mediaElement);
  }

  if (mediaElement.paused) {
    playMedia();
  } else {
    pauseMedia();
  }
}

function playMedia() {
  if (!mediaElement) return;
  mediaElement.play().then(() => {
    setPlayState(true);
    visualizerPlaceholder.classList.add('hidden');
    startVisualizer();
    if (isToneActive) {
      startTone();
    }
  }).catch(err => {
    console.error('Play error:', err);
  });
}

function pauseMedia() {
  if (!mediaElement) return;
  mediaElement.pause();
  setPlayState(false);
  stopTone();
}

function setPlayState(isPlaying) {
  if (isPlaying) {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    playBtnText.textContent = 'Pausar';
  } else {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    playBtnText.textContent = 'Reproduzir';
  }
}

/* Timeline & Volume */
seekBar.addEventListener('input', () => {
  if (mediaElement && mediaElement.duration) {
    mediaElement.currentTime = (seekBar.value / 100) * mediaElement.duration;
  }
});

volumeBar.addEventListener('input', () => {
  const val = parseFloat(volumeBar.value);
  if (mainGainNode) {
    mainGainNode.gain.value = val;
  }
  if (mediaElement) {
    mediaElement.volume = 1; // Master gain handles volume
  }
});

btnMute.addEventListener('click', () => {
  if (mainGainNode) {
    if (mainGainNode.gain.value > 0) {
      mainGainNode.gain.value = 0;
      volumeBar.value = 0;
    } else {
      mainGainNode.gain.value = 1;
      volumeBar.value = 1;
    }
  }
});

visualizerModeSelect.addEventListener('change', (e) => {
  visualizerMode = e.target.value;
});

/* Visualizer Rendering Engine */
function startVisualizer() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  renderFrame();
}

function stopVisualizer() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function renderFrame() {
  animationFrameId = requestAnimationFrame(renderFrame);

  if (!analyserNode) return;

  const width = canvas.width;
  const height = canvas.height;

  canvasCtx.clearRect(0, 0, width, height);

  if (visualizerMode === 'bars') {
    renderBars(width, height);
  } else if (visualizerMode === 'waveform') {
    renderWaveform(width, height);
  } else if (visualizerMode === 'circle') {
    renderCircle(width, height);
  }
}

function renderBars(width, height) {
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteFrequencyData(dataArray);

  const barWidth = (width / bufferLength) * 1.5;
  let barHeight;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    barHeight = (dataArray[i] / 255) * height;

    const gradient = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#a855f7');
    gradient.addColorStop(1, '#10b981');

    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

    x += barWidth + 1;
  }
}

function renderWaveform(width, height) {
  const bufferLength = analyserNode.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteTimeDomainData(dataArray);

  canvasCtx.lineWidth = 3;
  canvasCtx.strokeStyle = '#10b981';
  canvasCtx.beginPath();

  const sliceWidth = width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * height) / 2;

    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  canvasCtx.lineTo(width, height / 2);
  canvasCtx.stroke();
}

function renderCircle(width, height) {
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteFrequencyData(dataArray);

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.4;

  canvasCtx.beginPath();
  canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  canvasCtx.strokeStyle = '#334155';
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * (radius * 1.2);
    const rad = (i * 2 * Math.PI) / bufferLength;

    const x1 = centerX + Math.cos(rad) * radius;
    const y1 = centerY + Math.sin(rad) * radius;
    const x2 = centerX + Math.cos(rad) * (radius + barHeight);
    const y2 = centerY + Math.sin(rad) * (radius + barHeight);

    canvasCtx.beginPath();
    canvasCtx.moveTo(x1, y1);
    canvasCtx.lineTo(x2, y2);
    canvasCtx.strokeStyle = `hsl(${(i / bufferLength) * 280 + 160}, 100%, 60%)`;
    canvasCtx.lineWidth = 3;
    canvasCtx.stroke();
  }
}

/* Frequency / Tone Generator Implementation */
toggleFrequency.addEventListener('change', (e) => {
  isToneActive = e.target.checked;
  initAudioContext();

  if (isToneActive) {
    startTone();
  } else {
    stopTone();
  }
});

function startTone() {
  if (!audioCtx || !isToneActive) return;

  stopTone(); // Ensure clean state

  toneOscillator = audioCtx.createOscillator();
  toneGainNode = audioCtx.createGain();

  toneOscillator.type = toneWaveType;
  toneOscillator.frequency.setValueAtTime(toneFrequency, audioCtx.currentTime);

  toneGainNode.gain.setValueAtTime(toneVolume, audioCtx.currentTime);

  toneOscillator.connect(toneGainNode);
  toneGainNode.connect(analyserNode); // Connect to analyser so it displays on visualizer too!

  toneOscillator.start();
}

function stopTone() {
  if (toneOscillator) {
    try {
      toneOscillator.stop();
      toneOscillator.disconnect();
    } catch (e) {}
    toneOscillator = null;
  }
  if (toneGainNode) {
    try {
      toneGainNode.disconnect();
    } catch (e) {}
    toneGainNode = null;
  }
}

function updateToneParams() {
  if (toneOscillator && audioCtx) {
    toneOscillator.frequency.setValueAtTime(toneFrequency, audioCtx.currentTime);
    toneOscillator.type = toneWaveType;
  }
  if (toneGainNode && audioCtx) {
    toneGainNode.gain.setValueAtTime(toneVolume, audioCtx.currentTime);
  }
}

// Presets Handler
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const freq = parseFloat(btn.dataset.freq);
    toneFrequency = freq;
    customFreqInput.value = freq;
    freqSlider.value = freq;

    updateToneParams();
  });
});

customFreqInput.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value) || 432;
  toneFrequency = val;
  freqSlider.value = val;
  updateToneParams();
});

freqSlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  toneFrequency = val;
  customFreqInput.value = val;
  updateToneParams();
});

freqVolumeSlider.addEventListener('input', (e) => {
  toneVolume = parseFloat(e.target.value);
  freqVolValue.textContent = `${Math.round(toneVolume * 100)}%`;
  updateToneParams();
});

waveTypeSelect.addEventListener('change', (e) => {
  toneWaveType = e.target.value;
  updateToneParams();
});

/* Audio Processing & Export (Offline Audio Processing) */
btnExportAudio.addEventListener('click', async () => {
  if (!loadedFile) {
    alert('Por favor, carregue um arquivo de áudio ou vídeo primeiro.');
    return;
  }

  exportStatus.classList.remove('hidden');
  exportSpinner.classList.remove('hidden');
  exportStatusText.textContent = 'Decodificando áudio para processamento...';
  btnExportAudio.disabled = true;

  try {
    const arrayBuffer = await loadedFile.arrayBuffer();
    const tempAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await tempAudioCtx.decodeAudioData(arrayBuffer);
    tempAudioCtx.close();

    exportStatusText.textContent = 'Renderizando novo arquivo de áudio com a frequência...';

    // Render via OfflineAudioContext for fast offline processing
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Source 1: Original audio track
    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Source 2: Tone frequency oscillator (if enabled)
    if (isToneActive) {
      const osc = offlineCtx.createOscillator();
      const oscGain = offlineCtx.createGain();

      osc.type = toneWaveType;
      osc.frequency.setValueAtTime(toneFrequency, offlineCtx.currentTime);
      oscGain.gain.setValueAtTime(toneVolume, offlineCtx.currentTime);

      osc.connect(oscGain);
      oscGain.connect(offlineCtx.destination);
      osc.start(0);
      osc.stop(audioBuffer.duration);
    }

    sourceNode.connect(offlineCtx.destination);
    sourceNode.start(0);

    const renderedBuffer = await offlineCtx.startRendering();

    exportStatusText.textContent = 'Gerando arquivo WAV...';
    const wavBlob = audioBufferToWav(renderedBuffer);

    // Trigger download
    const downloadUrl = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    const baseName = loadedFile.name.substring(0, loadedFile.name.lastIndexOf('.')) || loadedFile.name;
    a.download = `${baseName}_${isToneActive ? toneFrequency + 'Hz' : 'processed'}.wav`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    }, 100);

    exportStatusText.textContent = 'Download concluído com sucesso!';
    exportSpinner.classList.add('hidden');
  } catch (error) {
    console.error('Erro na exportação:', error);
    exportStatusText.textContent = 'Erro ao processar o áudio. Tente novamente.';
    exportSpinner.classList.add('hidden');
  } finally {
    btnExportAudio.disabled = false;
  }
});

/* WAV Encoder Helper function */
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, numChannels, sampleRate, bitDepth);
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function encodeWAV(samples, numChannels, sampleRate, bitDepth) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);

  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

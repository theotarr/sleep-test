class EnhancedAdaptiveSleepNoise {
  constructor() {
    // Core properties
    this.audioContext = null;
    this.isPlaying = false;
    this.currentNoiseType = "white";

    // Audio nodes
    this.masterGain = null;
    this.noiseGain = null;
    this.breathGain = null;
    this.noiseNode = null;
    this.noiseFilter = null;
    this.breathOscillator1 = null;
    this.breathOscillator2 = null;
    this.breathLFO = null;
    this.breathFilter = null;

    // Rhythmic pulse nodes
    this.heartPulseLFO = null;
    this.heartPulseDepth = null;

    // Tempo slowdown properties
    this.slowdownDuration = 15 * 60 * 1000; // 15 minutes in ms
    this.slowdownIntervalId = null;
    this.startTime = 0;

    // Dynamic rate properties
    this.restingHeartRate = 70;
    this.currentHeartRate = 70;
    this.restingBreathRate = 15;
    this.currentBreathRate = 15;

    // Waveform visualization
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.wavePhase = 0;
    this.heartPhase = 0;

    // Noise generation state
    this.brownLastOut = 0;
    this.pinkB0 = 0;
    this.pinkB1 = 0;
    this.pinkB2 = 0;
    this.pinkB3 = 0;
    this.pinkB4 = 0;
    this.pinkB5 = 0;
    this.pinkB6 = 0;

    this.initializeControls();
    this.setupCanvas();
  }

  setupCanvas() {
    this.canvas = document.getElementById("waveformCanvas");
    this.ctx = this.canvas.getContext("2d");
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.animateWaveform();
  }

  animateWaveform() {
    if (!this.canvas || !this.ctx || !this.isPlaying) {
      this.animationId = requestAnimationFrame(() => this.animateWaveform());
      return;
    }

    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, width, height);

    const oceanWaveAmplitude = height * 0.4;
    const centerY = height / 2;

    // Use the audio context's clock as the single source of truth for timing.
    const elapsedTime = this.audioContext.currentTime - this.startTime;
    const currentFreq = this.currentBreathRate / 60; // Hz
    // The phase is 2 * PI * f * t. We divide by 2 because one full sine cycle (2*PI) should correspond to two breaths (inhale, exhale).
    const phase = elapsedTime * Math.PI * currentFreq;
    const oscillation = Math.sin(phase);

    // Draw ocean wave
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.isPlaying
      ? "#4facfe"
      : "rgba(79, 172, 254, 0.3)";
    this.ctx.lineWidth = 3;

    for (let x = 0; x < width; x++) {
      const angle = (x / width) * Math.PI; // Create a half wave shape
      const waveShape = Math.sin(angle);
      const y = centerY + waveShape * oscillation * oceanWaveAmplitude;
      x === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Draw center line and text
    this.ctx.beginPath();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    this.ctx.font = "12px Arial";
    this.ctx.textAlign = "left";
    this.ctx.fillText(
      `🌊 Breathing Rate: ${Math.round(this.currentBreathRate)} BPM`,
      10,
      20
    );

    this.animationId = requestAnimationFrame(() => this.animateWaveform());
  }

  initializeControls() {
    document.getElementById("heartRate").addEventListener("input", (e) => {
      document.getElementById("heartRateValue").textContent = e.target.value;
      if (!this.isPlaying) this.updateAlgorithmInfo();
    });
    document.getElementById("breathRate").addEventListener("input", (e) => {
      document.getElementById("breathRateValue").textContent = e.target.value;
      if (!this.isPlaying) this.updateAlgorithmInfo();
    });
    document.getElementById("noiseVolume").addEventListener("input", (e) => {
      document.getElementById("noiseVolumeValue").textContent = e.target.value;
      if (this.isPlaying) this.updateVolume();
    });
    document.getElementById("breathVolume").addEventListener("input", (e) => {
      document.getElementById("breathVolumeValue").textContent = e.target.value;
      if (this.isPlaying) this.updateVolume();
    });
    document.querySelectorAll(".noise-type").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (this.currentNoiseType === e.target.dataset.type) {
          return;
        }
        document
          .querySelectorAll(".noise-type")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.currentNoiseType = e.target.dataset.type;
        this.resetNoiseState();
      });
    });
    document
      .getElementById("playBtn")
      .addEventListener("click", () => this.startSleepMode());
    document
      .getElementById("stopBtn")
      .addEventListener("click", () => this.stopSleepMode());
  }

  resetNoiseState() {
    this.brownLastOut = 0;
    this.pinkB0 = 0;
    this.pinkB1 = 0;
    this.pinkB2 = 0;
    this.pinkB3 = 0;
    this.pinkB4 = 0;
    this.pinkB5 = 0;
    this.pinkB6 = 0;
  }

  async startSleepMode() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      await this.audioContext.resume();

      // Set initial and target rates
      this.restingHeartRate = parseInt(
        document.getElementById("heartRate").value
      );
      this.restingBreathRate = parseInt(
        document.getElementById("breathRate").value
      );
      this.currentHeartRate = this.restingHeartRate * 1.25;
      this.currentBreathRate = this.restingBreathRate * 1.25;
      this.startTime = this.audioContext.currentTime;

      this.resetNoiseState();
      this.createAudioNodes();
      this.updateVolume();

      this.isPlaying = true;
      document.getElementById("playBtn").style.display = "none";
      document.getElementById("stopBtn").style.display = "block";
      document.getElementById("heartRate").disabled = true;
      document.getElementById("breathRate").disabled = true;

      // Start processes
      this.startSlowdown();

      // Update UI
      document.getElementById("status-line").textContent =
        "Algorithm Status: Active";
      document.getElementById("heartStatus").textContent = "Active";
      document.getElementById("breathStatus").textContent = "Active";
      this.updateAlgorithmInfo();
    } catch (error) {
      console.error("Error starting audio:", error);
      document.getElementById(
        "status"
      ).innerHTML = `<div>Error: Could not start audio.</div>`;
    }
  }

  stopSleepMode() {
    if (this.slowdownIntervalId) clearInterval(this.slowdownIntervalId);
    this.slowdownIntervalId = null;

    if (this.audioContext) {
      this.audioContext.close().then(() => {
        this.audioContext = null;
      });
    }

    this.isPlaying = false;
    document.getElementById("playBtn").style.display = "block";
    document.getElementById("stopBtn").style.display = "none";
    document.getElementById("heartRate").disabled = false;
    document.getElementById("breathRate").disabled = false;

    // Reset current rates to resting for the visualization
    this.currentHeartRate = parseInt(
      document.getElementById("heartRate").value
    );
    this.currentBreathRate = parseInt(
      document.getElementById("breathRate").value
    );

    document.getElementById("heartStatus").textContent = "Ready";
    document.getElementById("breathStatus").textContent = "Ready";
    document.getElementById("status-line").textContent =
      "Algorithm Status: Stopped";
    document.getElementById("algorithmInfo").innerHTML = `Sweet dreams! 🌙`;
  }

  createAudioNodes() {
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    this.noiseGain = this.audioContext.createGain();
    this.breathGain = this.audioContext.createGain();
    this.noiseGain.connect(this.masterGain);
    this.breathGain.connect(this.masterGain);

    this.createNoiseLayer();
    this.createNoisePulseLayer();
    this.createOceanWaveLayer();
  }

  createNoiseLayer() {
    const bufferSize = 4096;
    this.noiseNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    this.noiseNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        switch (this.currentNoiseType) {
          case "white":
            output[i] = white;
            break;
          case "pink":
            this.pinkB0 = 0.99886 * this.pinkB0 + white * 0.0555179;
            this.pinkB1 = 0.99332 * this.pinkB1 + white * 0.0750759;
            this.pinkB2 = 0.969 * this.pinkB2 + white * 0.153852;
            this.pinkB3 = 0.8665 * this.pinkB3 + white * 0.3104856;
            this.pinkB4 = 0.55 * this.pinkB4 + white * 0.5329522;
            this.pinkB5 = -0.7616 * this.pinkB5 - white * 0.016898;
            output[i] =
              this.pinkB0 +
              this.pinkB1 +
              this.pinkB2 +
              this.pinkB3 +
              this.pinkB4 +
              this.pinkB5 +
              this.pinkB6 +
              white * 0.5362;
            output[i] *= 0.11; // (roughly) compensate for gain
            this.pinkB6 = white * 0.115926;
            break;
          case "brown":
            output[i] = (this.brownLastOut + 0.02 * white) / 1.02;
            this.brownLastOut = output[i];
            output[i] *= 3.5; // (roughly) compensate for gain
            break;
        }
      }
    };
    this.noiseFilter = this.audioContext.createBiquadFilter();
    this.noiseFilter.type = "lowpass";
    this.noiseFilter.frequency.setValueAtTime(
      2000,
      this.audioContext.currentTime
    );
    this.noiseNode.connect(this.noiseFilter).connect(this.noiseGain);
  }

  createNoisePulseLayer() {
    this.heartPulseLFO = this.audioContext.createOscillator();
    this.heartPulseLFO.type = "sine";
    this.heartPulseLFO.frequency.setValueAtTime(
      this.currentHeartRate / 60,
      this.audioContext.currentTime
    );

    this.heartPulseDepth = this.audioContext.createGain();
    // This controls the depth of the pulse. A small value makes it subtle.
    this.heartPulseDepth.gain.setValueAtTime(
      0.08,
      this.audioContext.currentTime
    );

    this.heartPulseLFO.connect(this.heartPulseDepth);
    // The LFO's output is ADDED to the gain's base value.
    this.heartPulseDepth.connect(this.noiseGain.gain);

    this.heartPulseLFO.start();
  }

  createOceanWaveLayer() {
    this.breathOscillator1 = this.audioContext.createOscillator();
    this.breathOscillator2 = this.audioContext.createOscillator();
    this.breathLFO = this.audioContext.createOscillator();

    this.breathOscillator1.type = "sine";
    this.breathOscillator2.type = "sine";
    this.breathLFO.type = "sine";

    this.breathOscillator1.frequency.setValueAtTime(
      80,
      this.audioContext.currentTime
    );
    this.breathOscillator2.frequency.setValueAtTime(
      120,
      this.audioContext.currentTime
    );
    this.breathLFO.frequency.setValueAtTime(
      this.currentBreathRate / 60,
      this.audioContext.currentTime
    );

    const wave1Gain = this.audioContext.createGain();
    const wave2Gain = this.audioContext.createGain();
    const lfoGain = this.audioContext.createGain();
    wave1Gain.gain.value = 0.4;
    wave2Gain.gain.value = 0.6;
    lfoGain.gain.value = 1.0;

    this.breathFilter = this.audioContext.createBiquadFilter();
    this.breathFilter.type = "bandpass";
    this.breathFilter.frequency.setValueAtTime(
      400,
      this.audioContext.currentTime
    );
    this.breathFilter.Q.setValueAtTime(0.8, this.audioContext.currentTime);

    this.breathOscillator1.connect(wave1Gain);
    this.breathOscillator2.connect(wave2Gain);
    this.breathLFO.connect(lfoGain).connect(this.breathGain.gain);
    wave1Gain.connect(this.breathFilter);
    wave2Gain.connect(this.breathFilter);
    this.breathFilter.connect(this.breathGain);

    this.breathOscillator1.start();
    this.breathOscillator2.start();
    this.breathLFO.start();
  }

  startSlowdown() {
    this.slowdownIntervalId = setInterval(() => {
      if (!this.audioContext) return;
      const elapsedTime =
        (this.audioContext.currentTime - this.startTime) * 1000;
      if (elapsedTime >= this.slowdownDuration) {
        this.currentHeartRate = this.restingHeartRate;
        this.currentBreathRate = this.restingBreathRate;
        clearInterval(this.slowdownIntervalId);
        this.slowdownIntervalId = null;
      } else {
        const progress = elapsedTime / this.slowdownDuration;
        const startHeartRate = this.restingHeartRate * 1.25;
        const startBreathRate = this.restingBreathRate * 1.25;
        this.currentHeartRate =
          startHeartRate - (startHeartRate - this.restingHeartRate) * progress;
        this.currentBreathRate =
          startBreathRate -
          (startBreathRate - this.restingBreathRate) * progress;
      }

      // Update audio param frequencies smoothly
      const transitionTime = 1; // 1 second for smooth transition
      if (this.heartPulseLFO) {
        this.heartPulseLFO.frequency.setTargetAtTime(
          this.currentHeartRate / 60,
          this.audioContext.currentTime,
          transitionTime
        );
      }
      if (this.breathLFO) {
        this.breathLFO.frequency.setTargetAtTime(
          this.currentBreathRate / 60,
          this.audioContext.currentTime,
          transitionTime
        );
      }
      this.updateAlgorithmInfo();
    }, 1000); // Update every second
  }

  updateVolume() {
    if (!this.isPlaying) return;
    const noiseVolume =
      parseInt(document.getElementById("noiseVolume").value) / 100;
    const breathVolume =
      parseInt(document.getElementById("breathVolume").value) / 100;

    const noiseBaseVol = noiseVolume * 0.5;
    const pulseDepth = noiseVolume * 0.08; // Proportional pulse depth
    const breathVol = breathVolume * 0.6;

    this.noiseGain.gain.setTargetAtTime(
      noiseBaseVol,
      this.audioContext.currentTime,
      0.1
    );

    if (this.heartPulseDepth) {
      this.heartPulseDepth.gain.setTargetAtTime(
        pulseDepth,
        this.audioContext.currentTime,
        0.1
      );
    }

    this.breathGain.gain.setTargetAtTime(
      breathVol,
      this.audioContext.currentTime,
      0.1
    );
  }

  updateAlgorithmInfo() {
    const info = this.getAlgorithmDescription();
    const algorithmInfoElement = document.getElementById("algorithmInfo");
    if (algorithmInfoElement) {
      algorithmInfoElement.innerHTML = info;
    }
  }

  getAlgorithmDescription() {
    if (!this.isPlaying) {
      return `Set your resting rates and press Start to begin the 15-minute sleep sequence.`;
    }
    const startHeartRate = Math.round(this.restingHeartRate * 1.25);
    let description = `<strong>Sleep Sequence Active:</strong><br>`;
    description += `Gradually slowing pulse from <strong>${startHeartRate} BPM</strong> down to <strong>${this.restingHeartRate} BPM</strong> over 15 minutes.<br>`;
    description += `Current Target: <strong>${Math.round(
      this.currentHeartRate
    )} BPM</strong>`;
    return description;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new EnhancedAdaptiveSleepNoise();
});

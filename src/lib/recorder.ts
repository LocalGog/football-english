/**
 * Records a few seconds of the player's voice so it can be played back next to the model
 * pronunciation. Everything stays in the browser's memory: nothing is uploaded or stored.
 */
export const canRecord = (): boolean =>
  typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];

  /** Rejects if the microphone is missing or permission was refused. */
  async start(): Promise<void> {
    this.release();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  /** Resolves to an object URL of the recording, or null if nothing was captured. */
  stop(): Promise<string | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.release();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.release();
        resolve(blob.size > 0 ? URL.createObjectURL(blob) : null);
      };
      recorder.stop();
    });
  }

  /** Turns the microphone off. Safe to call at any time. */
  release(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      /* already stopped */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recorder = null;
    this.stream = null;
  }
}

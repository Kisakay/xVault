<script lang="ts">
  import jsQR from 'jsqr';

  let {
    onresult,
    onmessage,
  }: {
    onresult: (text: string) => void;
    onmessage: (message: string | null) => void;
  } = $props();

  let videoEl: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | null = null;
  let frameId = 0;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const stopStream = (): void => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };

  const scanLoop = (): void => {
    frameId = requestAnimationFrame(scanLoop);
    if (!videoEl || !context || videoEl.readyState < 2) {
      return;
    }
    if (canvas.width !== videoEl.videoWidth) {
      canvas.width = videoEl.videoWidth;
    }
    if (canvas.height !== videoEl.videoHeight) {
      canvas.height = videoEl.videoHeight;
    }
    context.drawImage(videoEl, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (result?.data) {
      cancelAnimationFrame(frameId);
      stopStream();
      onresult(result.data);
    }
  };

  $effect(() => {
    let cancelled = false;

    const start = async (): Promise<void> => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled || !videoEl) {
          stopStream();
          return;
        }
        videoEl.srcObject = stream;
        await videoEl.play();
        onmessage(null);
        scanLoop();
      } catch (error) {
        console.error('Camera access failed:', error);
        stopStream();
        onmessage('Camera access denied or unavailable.');
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stopStream();
    };
  });
</script>

<div class="scanner-surface">
  <video bind:this={videoEl} class="scanner-video" autoplay playsinline muted></video>
  <div class="scanner-frame" aria-hidden="true"></div>
</div>
